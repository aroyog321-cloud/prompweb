import { NextResponse } from 'next/server';
import type { OptimizeRequest, OptimizeResponse } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize, getLevelConfig } from '@promptly/prompt-engine';
import { createClient } from '@supabase/supabase-js';

import { requireEnv } from '@/lib/env';
import { makeGeminiCall } from '@/services/ai';
import { createOpenAIStream } from '@/services/streaming';
import { checkQuotaAndTier, getDynamicApiKey } from '@/services/billing';
import { validateOptimizeRequest } from '@/services/validators';

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);



export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const validation = validateOptimizeRequest(bodyText);
    
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const body = validation.body!;

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing or invalid Promptly Access Token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid Access Token. Please log in again at proenpt.com." }, { status: 401 });
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

    if (user) {
      const billingResult = await checkQuotaAndTier(supabaseUserClient, user.id, isRegeneration, hasContextMemory);
      if (billingResult.error) {
        return NextResponse.json({ error: billingResult.error }, { status: billingResult.status });
      }
      tier = billingResult.tier;
    }

    const dynamicApiKey = await getDynamicApiKey(supabaseAdmin, GEMINI_API_KEY);
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