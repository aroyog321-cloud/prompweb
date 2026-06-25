import { NextResponse } from 'next/server';
import type { OptimizeRequest, OptimizeResponse } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize, getLevelConfig } from '@promptly/prompt-engine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY_PREMIUM = process.env.GEMINI_API_KEY_PREMIUM || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";


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
  let buffer = "";
  
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? "";
      
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

    // Input length validation — prevents prompt injection & runaway Gemini bills
    if (body.text.length > 8000) {
      return NextResponse.json({ error: "Prompt too long. Maximum 8,000 characters." }, { status: 400 });
    }
    if (body.refinement && body.refinement.length > 1000) {
      return NextResponse.json({ error: "Refinement instruction too long. Maximum 1,000 characters." }, { status: 400 });
    }
    if (body.context) {
      for (const [field, value] of Object.entries(body.context)) {
        if (typeof value === 'string' && value.length > 500) {
          return NextResponse.json({ error: `Context field '${field}' too long. Maximum 500 characters.` }, { status: 400 });
        }
      }
      // Validate websiteUrl to prevent injection via URL field
      if (body.context.websiteUrl) {
        try { new URL(body.context.websiteUrl); } catch {
          body.context.websiteUrl = '';
        }
      }
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing or invalid Promptly Access Token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      // FIX 2.2: Never bypass auth in production. The old 'placeholder' check
      // meant a deploy without NEXT_PUBLIC_SUPABASE_URL set got free expert access.
      if (process.env.NODE_ENV !== 'production' && supabaseUrl.includes('placeholder')) {
        console.warn("[DEV ONLY] Using placeholder Supabase URL. Bypassing auth for local development.");
      } else {
        return NextResponse.json({ error: "Invalid Access Token. Please log in again at proenpt.com." }, { status: 401 });
      }
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // --- Quota check & atomic increment via DB RPC ---
    // The RPC handles: row creation, daily counter reset, limit enforcement,
    // and atomic increment — all in a single FOR UPDATE transaction.
    const isTwoPass = body.level === "aggressive" || body.level === "expert";
    const isRegeneration = !!body.refinement || !!body.previousPrompt;
    const hasContextMemory = !!body.context && Object.values(body.context).some(v => !!v);

    let tier = 'free';

    if (user && !supabaseUrl.includes('placeholder')) {
      // --- Manual Usage Tracking (Bypasses missing increment_usage RPC) ---
      const { data: usageData, error: usageError } = await supabaseUserClient.rpc('increment_usage', {
        p_user_id: user.id,
        p_is_regen: isRegeneration
      });

      if (usageError) {
        console.error("Usage tracking error:", usageError);
        return NextResponse.json({ error: "Usage tracking error. Please try again." }, { status: 500 });
      }

      if (!usageData || usageData.length === 0) {
        return NextResponse.json({ error: "Usage tracking error. No data returned." }, { status: 500 });
      }

      tier = usageData[0].tier || 'free';

      if (!usageData[0].allowed) {
        const msg = tier === 'free' 
          ? (isRegeneration ? "Regeneration limit reached for today (4/4). Upgrade to Pro." : "Daily limit reached (10/10). Upgrade to Pro for 50/day.")
          : (isRegeneration ? "Regeneration limit reached for today (50/50). Upgrade to Expert." : "Daily limit reached (50/50). Upgrade to Expert for unlimited.");
        return NextResponse.json({ error: msg }, { status: 403 });
      }

      // 1. Lock Context Memory for free AND pro
      if (hasContextMemory && (tier === 'free' || tier === 'pro')) {
        return NextResponse.json({ error: "Context Memory is locked. Upgrade to Expert." }, { status: 403 });
      }

    // --- Dynamic API Key Lookup ---
    let dynamicApiKey = null;
    try {
      const { data: settingData } = await supabase
        .from('SystemSetting')
        .select('value')
        .eq('key', 'optimize_key')
        .single();
      
      if (settingData && settingData.value) {
        const { data: keyData } = await supabase
          .from('ApiKey')
          .select('secret')
          .eq('name', settingData.value)
          .eq('enabled', true)
          .single();
          
        if (keyData && keyData.secret) {
          dynamicApiKey = keyData.secret;
        }
      }
    } catch (e) {
      console.error("Failed to fetch dynamic API key:", e);
    }

    const FINAL_API_KEY = dynamicApiKey || GEMINI_API_KEY;

    if (!FINAL_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Falling back to local template.");
      if (body.stream) {
        return NextResponse.json({ error: "Streaming not supported for local fallback" }, { status: 400 });
      }
      return NextResponse.json<OptimizeResponse>({
        optimized: localOptimize(body),
        source: "local-fallback"
      });
    }

    // FIX 3.1: Sanitize the origin before passing to the LLM.
    const rawOrigin = request.headers.get("origin") || "";
    const ALLOWED_ORIGINS = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://proenpt.vercel.app",
      "https://proenpt.com",
      "https://app.proenpt.com",
    ];
    const isTrustedOrigin = rawOrigin.startsWith("chrome-extension://") || ALLOWED_ORIGINS.includes(rawOrigin);
    const platform = isTrustedOrigin ? rawOrigin : undefined;

    let resolvedMode = body.mode;
    if (body.mode === "auto") {
      const classifierPrompt = `Classify into ONE: general, developer, designer, marketing, research, business, content-creator, startup-founder. Output ONLY the category name.\n\n"${body.text.slice(0, 300)}"`;
      try {
        const classifyRes = await makeGeminiCall(
          "You classify user requests. Output only the category name, nothing else.",
          classifierPrompt,
          false,
          { temperature: 0.1, maxOutputTokens: 20 },
          FINAL_API_KEY
        );
        const classifyData = await classifyRes.json();
        const raw = classifyData.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
        const VALID = ["general","developer","designer","marketing","research","business","content-creator","startup-founder"];
        resolvedMode = VALID.includes(raw) ? raw as any : "general";
      } catch (e) {
        console.warn("Classification failed, falling back to general", e);
        resolvedMode = "general";
      }
    }

    const systemPrompt = buildSystemPrompt(resolvedMode, body.level, platform);
    const userPrompt = buildUserPrompt(body);

    const activeApiKey = isTwoPass ? (GEMINI_API_KEY_PREMIUM || FINAL_API_KEY) : FINAL_API_KEY;

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
      
      const critiqueSystemPrompt = "You are a precise editor. Apply the rubric exactly as stated. Output only the revised prompt.";
      const finalRes = await makeGeminiCall(critiqueSystemPrompt, critiquePrompt, !!body.stream, getLevelConfig(body.level, true), activeApiKey);
      
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
    // Log the full error to the console for debugging
    console.error("Optimize endpoint error:", error);

    // Return a generic error to avoid leaking system internals
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}