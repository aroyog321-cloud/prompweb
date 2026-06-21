import { NextResponse } from 'next/server';
import type { OptimizeRequest, OptimizeResponse } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize } from '@promptly/prompt-engine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY_PREMIUM = process.env.GEMINI_API_KEY_PREMIUM || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";

function getLevelConfig(level: string, isCritique: boolean = false) {
  if (isCritique) return { temperature: 0.3, maxOutputTokens: 2048 };
  switch (level) {
    case "light": return { temperature: 0.2, maxOutputTokens: 512 };
    case "medium": return { temperature: 0.4, maxOutputTokens: 1024 };
    case "aggressive": return { temperature: 0.6, maxOutputTokens: 2048 };
    case "expert": return { temperature: 0.7, maxOutputTokens: 2048 };
    default: return { temperature: 0.7, maxOutputTokens: 2048 };
  }
}

async function makeGeminiCall(systemPrompt: string, userPrompt: string, stream: boolean, config: { temperature: number, maxOutputTokens: number }, apiKey: string = GEMINI_API_KEY!) {
  const endpoint = stream 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: config.temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: config.maxOutputTokens,
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  return response;
}

function createOpenAIStream(response: Response, logData?: { user: any, body: any, platform: string, supabase: any, supabaseUrl: string }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              const errorChunk = {
                choices: [{
                  delta: { content: `\n[API Error: ${data.error.message || 'Unknown error during stream'}]` }
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
              continue;
            }
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const content = data.candidates[0].content.parts[0].text;
              accumulatedText += content;
              const openAIChunk = {
                choices: [{
                  delta: { content }
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    },
    async flush() {
      if (logData && logData.user && !logData.supabaseUrl.includes('placeholder')) {
        const { error: insertError } = await logData.supabase.from('PromptHistory').insert({
          userId: logData.user.id,
          originalPrompt: logData.body.text,
          optimizedPrompt: accumulatedText.trim(),
          platformUsed: logData.platform || "api",
          promptMode: logData.body.mode.replace(/-/g, '_').toUpperCase(),
          rewriteLevel: logData.body.level.toUpperCase(),
        });
        if (insertError) console.error("Failed to log prompt history (streamed):", insertError);
      }
    }
  });

  const readable = response.body?.pipeThrough(transformStream);
  if (!readable) return new Response("Failed to start stream", { status: 500 });

  const customReadable = new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
    async cancel() {
      // Client disconnected early — persist what we have so far!
      if (accumulatedText.trim().length > 10 && logData && logData.user && !logData.supabaseUrl.includes('placeholder')) {
        logData.supabase.from('PromptHistory').insert({
          userId: logData.user.id,
          originalPrompt: logData.body.text,
          optimizedPrompt: accumulatedText.trim() + " [truncated]",
          platformUsed: logData.platform || "api",
          promptMode: logData.body.mode.replace(/-/g, '_').toUpperCase(),
          rewriteLevel: logData.body.level.toUpperCase(),
        }).then(() => {});
      }
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    let body: OptimizeRequest;
    try {
      body = JSON.parse(bodyText) as OptimizeRequest;
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body.text || !body.mode || !body.level) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing or invalid Promptly Access Token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      // Allow fallback if we are in local development without Supabase configured
      if (supabaseUrl.includes('placeholder')) {
        console.warn("Using placeholder Supabase URL. Bypassing auth for development.");
      } else {
        return NextResponse.json({ error: "Invalid Access Token. Please log in again at promptly.com." }, { status: 401 });
      }
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    let tier = 'free';
    if (user && !supabaseUrl.includes('placeholder')) {
      // Mock tracking schema implementation
      const { data: profile } = await supabaseUserClient.from('usage_stats').select('*').eq('id', user.id).single();
      tier = profile?.tier || 'free';
      const totalRequestsToday = profile?.total_requests_today || 0;
      const aggressiveExpertToday = profile?.aggressive_expert_today || 0;
      const regenerationsToday = profile?.regenerations_today || 0;
      
      const isRegeneration = !!body.refinement || !!body.previousPrompt;
      const hasContextMemory = !!body.context && Object.values(body.context).some(v => !!v);

      if (tier === 'free') {
        if (totalRequestsToday >= 10) {
          return NextResponse.json({ error: "Free tier daily limit reached (10/10). Upgrade to Pro for more." }, { status: 403 });
        }
        if ((body.level === 'aggressive' || body.level === 'expert') && aggressiveExpertToday >= 2) {
          return NextResponse.json({ error: "Free tier Aggressive/Expert limit reached (2/2). Upgrade to Pro." }, { status: 403 });
        }
        if (isRegeneration && regenerationsToday >= 4) {
          return NextResponse.json({ error: "Free tier regeneration limit reached (4/4). Upgrade to Pro." }, { status: 403 });
        }
        if (hasContextMemory) {
          return NextResponse.json({ error: "Context Memory is locked in the Free tier. Upgrade to Expert." }, { status: 403 });
        }
      } else if (tier === 'pro') {
        if (totalRequestsToday >= 25) {
          return NextResponse.json({ error: "Pro tier daily limit reached (25/25). Upgrade to Expert for unlimited." }, { status: 403 });
        }
        if (isRegeneration && regenerationsToday >= 2) {
          return NextResponse.json({ error: "Pro tier regeneration limit reached (2/2). Upgrade to Expert." }, { status: 403 });
        }
        if (hasContextMemory) {
          return NextResponse.json({ error: "Context Memory is locked in the Pro tier. Upgrade to Expert." }, { status: 403 });
        }
      }
      
      // Note: We would increment usage here in a real production system using an RPC call or edge function
      // supabase.rpc('increment_usage', { user_id: user.id, is_advanced: body.level === 'aggressive' || body.level === 'expert' });
    }

    if (!GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Falling back to local template.");
      if (body.stream) {
        return NextResponse.json({ error: "Streaming not supported for local fallback" }, { status: 400 });
      }
      return NextResponse.json<OptimizeResponse>({
        optimized: localOptimize(body),
        source: "local-fallback"
      });
    }

    const platform = request.headers.get("origin") || undefined;
    const systemPrompt = buildSystemPrompt(body.mode, body.level, platform);
    const userPrompt = buildUserPrompt(body);

    const isTwoPass = body.level === "aggressive" || body.level === "expert";
    const activeApiKey = isTwoPass ? GEMINI_API_KEY_PREMIUM : GEMINI_API_KEY;

    // Increment usage manually without RPC
    if (user && !supabaseUrl.includes('placeholder')) {
      const { data: stats } = await supabaseUserClient
        .from('usage_stats')
        .select('total_requests_today, aggressive_expert_today, regenerations_today')
        .eq('id', user.id)
        .single();
        
      if (stats) {
        const { error: usageError } = await supabaseUserClient
          .from('usage_stats')
          .update({
            total_requests_today: (stats.total_requests_today || 0) + 1,
            aggressive_expert_today: (stats.aggressive_expert_today || 0) + (isTwoPass ? 1 : 0),
            regenerations_today: (stats.regenerations_today || 0) + ((!!body.refinement || !!body.previousPrompt) ? 1 : 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        if (usageError) console.error("Failed to increment usage:", usageError);
      }
    }

    if (isTwoPass) {
      // Pass 1: Draft (always non-streaming)
      const draftRes = await makeGeminiCall(systemPrompt, userPrompt, false, getLevelConfig(body.level, false), activeApiKey);
      const draftData = await draftRes.json();
      const draftText = draftData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!draftText) {
        throw new Error("Failed to generate draft in pass 1");
      }

      // Pass 2: Critique
      const critiquePrompt = `Apply this rubric point-by-point to the draft below. If any check fails, output a REVISED version that fixes the issues. If it already passes all checks, output it unchanged. Do not explain.

RUBRIC:
- ROLE: Specific expert persona with concrete skills (not "an expert" / "an assistant")
- CONTEXT: Names who, what, why — concrete, not generic
- OBJECTIVE: Single sharp deliverable with measurable criteria
- CONSTRAINTS: ≥2 negative constraints (Do NOT / Avoid)
- OUTPUT FORMAT: Exact structure (sections, length, format)
- SUCCESS CRITERIA: What "done well" looks like
${body.level === "expert" ? "- EDGE CASES: Failure modes the model should watch for" : ""}

DRAFT:
${draftText}`;
      
      const finalRes = await makeGeminiCall(systemPrompt, critiquePrompt, !!body.stream, getLevelConfig(body.level, true), activeApiKey);
      
      if (body.stream) {
        return createOpenAIStream(finalRes, { user, body, platform: platform || "api", supabase: supabaseUserClient, supabaseUrl });
      } else {
        const finalData = await finalRes.json();
        const optimizedText = finalData.candidates[0].content.parts[0].text.trim();
        
        // Log to Supabase
        if (user && !supabaseUrl.includes('placeholder')) {
          const { error: insertError } = await supabaseUserClient.from('PromptHistory').insert({
            userId: user.id,
            originalPrompt: body.text,
            optimizedPrompt: optimizedText,
            platformUsed: platform || "api",
            promptMode: body.mode.replace(/-/g, '_').toUpperCase(),
            rewriteLevel: body.level.toUpperCase(),
          });
          if (insertError) console.error("Failed to log prompt history:", insertError);
        }

        return NextResponse.json<OptimizeResponse>({
          optimized: optimizedText,
          source: "api"
        });
      }
    } else {
      // 1-Pass
      const finalRes = await makeGeminiCall(systemPrompt, userPrompt, !!body.stream, getLevelConfig(body.level, false), activeApiKey);
      
      if (body.stream) {
        return createOpenAIStream(finalRes, { user, body, platform: platform || "api", supabase: supabaseUserClient, supabaseUrl });
      } else {
        const finalData = await finalRes.json();
        const optimizedText = finalData.candidates[0].content.parts[0].text.trim();
        
        // Log to Supabase
        if (user && !supabaseUrl.includes('placeholder')) {
          const { error: insertError } = await supabaseUserClient.from('PromptHistory').insert({
            userId: user.id,
            originalPrompt: body.text,
            optimizedPrompt: optimizedText,
            platformUsed: platform || "api",
            promptMode: body.mode.replace(/-/g, '_').toUpperCase(),
            rewriteLevel: body.level.toUpperCase(),
          });
          if (insertError) console.error("Failed to log prompt history:", insertError);
        }

        return NextResponse.json<OptimizeResponse>({
          optimized: optimizedText,
          source: "api"
        });
      }
    }

  } catch (error) {
    console.error("Optimize endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}