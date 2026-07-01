import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Use Edge Runtime to bypass 10-second serverless timeouts on Hobby plan

import type { OptimizeResponse, PromptMode } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize } from '@promptly/prompt-engine';

import { requireEnv } from '@/lib/env';
import { createOpenAIStream } from '@/services/streaming';
import { checkQuotaAndTier, getDynamicApiKey } from '@/services/billing';
import { validateOptimizeRequest } from '@/services/validators';
import { captureError } from '@/services/monitoring';
import { withMetrics } from '@/lib/metrics';

import { authenticateRequest } from './authenticate';
import { classifyPromptMode } from './classify';
import { executeOptimization } from './execute';
import { normalizeLevel, normalizeMode } from '@/lib/levelMap';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.startsWith('REPLACE_') ? '' : process.env.GEMINI_API_KEY;
const GEMINI_API_KEY_PREMIUM = process.env.GEMINI_API_KEY_PREMIUM?.startsWith('REPLACE_') ? '' : process.env.GEMINI_API_KEY_PREMIUM;

export const POST = withMetrics(async (request: Request) => {
  const routeController = new AbortController();
  let routeTimeout: ReturnType<typeof setTimeout>;
  
  const startTime = Date.now();
  try {
    routeTimeout = setTimeout(() => routeController.abort(), 50000); // 50s route timeout

    // FIX #4: Actual body-size enforcement is now done in validateOptimizeRequest
    // using the real decoded byte length. The Content-Length header is attacker-controlled
    // and is no longer used as a security gate here.
    const bodyText = await request.text();
    const validation = validateOptimizeRequest(bodyText);
    
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const body = validation.body!;

    // TEMPORARY LOCAL BYPASS
    const isDev = process.env.NODE_ENV !== 'production';
    
    let user = { id: "local-dev-user" } as any;
    let supabaseAdmin = {} as any;
    
    if (!isDev) {
      const authRes = await authenticateRequest(request);
      if (authRes.error || !authRes.user) {
        return NextResponse.json({ error: authRes.error }, { status: authRes.status });
      }
      user = authRes.user;
      supabaseAdmin = authRes.supabaseAdmin;
    }

    const isRegeneration = !!body.refinement || !!body.previousPrompt;
    const hasContextMemory = !!body.context && Object.values(body.context).some(v => !!v);

    let classifiedMode = null;
    let FINAL_API_KEY = GEMINI_API_KEY;

    if (!isDev) {
      const billingPromise = checkQuotaAndTier(supabaseAdmin, user.id, isRegeneration, hasContextMemory);
      const dynamicApiKey = await getDynamicApiKey(supabaseAdmin, GEMINI_API_KEY || '');
      
      const billingResult = await billingPromise;

      if (billingResult.error) {
        return NextResponse.json({ error: billingResult.error }, { status: billingResult.status });
      }
      classifiedMode = "general";
      FINAL_API_KEY = dynamicApiKey || GEMINI_API_KEY;
    }

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

    const resolvedMode = (classifiedMode ? classifiedMode : body.mode) as PromptMode;

    let contextText = "";
    if (body.context && typeof body.context === 'object') {
      contextText = Object.entries(body.context)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    }

    const systemPrompt = await buildSystemPrompt(resolvedMode, body.level, platform, body.style, contextText);
    const userPrompt = buildUserPrompt(body);

    const activeApiKey = FINAL_API_KEY;

    const finalRes = await executeOptimization(
      systemPrompt, 
      userPrompt, 
      body.level, 
      false,         // isTwoPass removed
      activeApiKey, 
      !!body.stream,
    );

    if (body.stream) {
      // Pass the classified resolvedMode (not raw body.mode which is always 'auto')
      const streamBody = { ...body, mode: resolvedMode as string };
      return createOpenAIStream(finalRes, { user, body: streamBody, platform: platform || "api", supabase: supabaseAdmin });
    } else {
      const finalData = await finalRes.json();
      const optimizedText = finalData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!optimizedText) {
        return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
      }

      // No footer to strip — the AI no longer outputs 'Prompt Strength' footer
      const extractedPrompt = optimizedText;

      const responseTime = (Date.now() - startTime) / 1000;

      // FIX #1: Await saveHistory so failures are surfaced and logged,
      // rather than silently dropped after the response is already sent.
      const saveHistory = async () => {
        const mappedLevel = normalizeLevel(body.level);
        const mappedMode = normalizeMode(resolvedMode);

        const payload = {
          id: crypto.randomUUID(),
          userId: user.id,
          originalPrompt: body.text,
          optimizedPrompt: extractedPrompt,  // store the clean prompt
          platformUsed: platform || body.platform || 'api',
          promptMode: mappedMode,
          rewriteLevel: mappedLevel,
          responseTime,
        };

        const { error } = await supabaseAdmin.from('PromptHistory').insert([payload]);
        if (error) {
          console.warn('[Promptly] PromptHistory insert failed. Trying fallback mapping...', error.message);
          
          const fallbackLevels: Record<string, string> = {
            BASIC: 'LIGHT',
            PROFESSIONAL: 'MEDIUM',
            STAFF_PLUS: 'AGGRESSIVE',
            RESEARCH: 'EXPERT',
            PRODUCTION_AUDIT: 'EXPERT'
          };
          
          if (fallbackLevels[mappedLevel]) {
            payload.rewriteLevel = fallbackLevels[mappedLevel];
            const { error: retryError } = await supabaseAdmin.from('PromptHistory').insert([payload]);
            if (retryError) {
              throw new Error(`Fallback insert failed: ${retryError.message}`);
            }
          } else {
            throw error;
          }
        }
      };

      // Always save — extension no longer sends clientWillSync:true
      try {
        await saveHistory();
      } catch (err) {
        // Non-fatal: log but still return the optimized result to the user
        console.error('[Promptly] PromptHistory insert failed:', err instanceof Error ? err.message : err);
      }

      return NextResponse.json<OptimizeResponse>({
        optimized: extractedPrompt,  // return the clean prompt to the client
        source: "api"
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const isError = error instanceof Error;

    if (isError && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      captureError(error, { route: '/api/optimize', error: 'request_timeout', duration, provider: 'gemini', tier: 'unknown' });
      return NextResponse.json({ error: "request_timeout" }, { status: 504 });
    }

    if (isError && error.message.includes("Rate limit")) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Pass through upstream API errors directly instead of masking as 500
    if (isError && error.message.includes("Gemini API error")) {
       const statusMatch = error.message.match(/Gemini API error: (\d+)/);
       const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 502;
       return NextResponse.json({ error: error.message }, { status: statusCode });
    }

    captureError(isError ? error : new Error(String(error)), { route: '/api/optimize', duration, provider: 'gemini' });

    const clientMessage =
      process.env.NODE_ENV === 'production'
        ? 'Optimization failed. Please try again.'
        : isError ? error.message : String(error); // real error shown in dev
    return NextResponse.json({ error: clientMessage }, { status: 500 });
  } finally {
    clearTimeout(routeTimeout!);
  }
});