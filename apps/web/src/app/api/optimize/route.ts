import { NextResponse } from 'next/server';
import type { OptimizeRequest, OptimizeResponse } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize } from '@promptly/prompt-engine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

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
      // The extension will handle logging this prompt to the history via /api/history
      // to avoid dual-writes and RLS silent failures.
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
      // The extension handles logging to history.
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabaseUserClient;

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
        const { error: usageError } = await supabaseAdmin
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
      const critiquePrompt = `Apply this failure-mode rubric to the draft below. If any check fails, output a REVISED version that fixes the issues. If it already passes all checks, output it unchanged. Do not explain.

RUBRIC:
- ROLE: Must be a specific person with opinions, not a generic title. 
  Bad: "an experienced data scientist." 
  Fix: Name the specific experience, constraints, and philosophy they hold.
- CONTEXT: Must contain concrete facts or labeled assumptions, not category descriptions.
  Bad: "a B2B software company." 
  Fix: Inject concrete details (e.g., "12-person Series A SaaS").
- OBJECTIVE: Must have measurable success criteria.
  Bad: "write a good report." 
  Fix: Specify word count, structure, and what the report should achieve.
- CONSTRAINTS: Must have ≥2 explicit negative (Do NOT) constraints naming specific clichés or failure modes to avoid.
  Bad: "Be concise." 
  Fix: "Do NOT use passive voice or exceed 300 words."
- OUTPUT FORMAT: Must specify exact structure, sections, and length.
- SUCCESS CRITERIA: Must define what a high-quality output looks like to a skeptic.
${body.level === "expert" ? "- EDGE CASES: Must explicitly name 2-3 likely failure modes for the model to watch out for." : ""}

DRAFT:
${draftText}`;
      
      const finalRes = await makeGeminiCall(systemPrompt, critiquePrompt, !!body.stream, getLevelConfig(body.level, true), activeApiKey);
      
      if (body.stream) {
        return createOpenAIStream(finalRes, { user, body, platform: platform || "api", supabase: supabaseUserClient, supabaseUrl });
      } else {
        const finalData = await finalRes.json();
        const optimizedText = finalData.candidates[0].content.parts[0].text.trim();
        
        // The extension will handle logging this prompt to the history via /api/history

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
        
        // The extension will handle logging this prompt to the history via /api/history

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