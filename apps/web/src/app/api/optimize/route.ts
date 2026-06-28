import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY_PREMIUM = process.env.GEMINI_API_KEY_PREMIUM;

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

    const authRes = await authenticateRequest(request);
    if (authRes.error || !authRes.user) {
      return NextResponse.json({ error: authRes.error }, { status: authRes.status });
    }
    const { user, supabaseUserClient, supabaseAdmin } = authRes;

    const isTwoPass = body.level === "Staff+" || body.level === "Research" || body.level === "Production Audit";
    const isRegeneration = !!body.refinement || !!body.previousPrompt;
    const hasContextMemory = !!body.context && Object.values(body.context).some(v => !!v);

    // Parallelize independent remote calls
    const billingPromise = checkQuotaAndTier(supabaseAdmin, user.id, isRegeneration, hasContextMemory);
    const apiKeyPromise = getDynamicApiKey(supabaseAdmin, GEMINI_API_KEY || '');
    let classifyPromise: Promise<string | null> | null = null;
    
    if (body.mode === "auto") {
      // Use fallback key for classification to parallelize
      classifyPromise = classifyPromptMode(body.text, GEMINI_API_KEY || '');
    }

    const [billingResult, dynamicApiKey, classifiedMode] = await Promise.all([
      billingPromise,
      apiKeyPromise,
      classifyPromise
    ]);

    if (billingResult.error) {
      return NextResponse.json({ error: billingResult.error }, { status: billingResult.status });
    }
    // tier variable removed as it was unused
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

    const systemPrompt = await buildSystemPrompt(resolvedMode, body.level, platform);
    const userPrompt = buildUserPrompt(body);

    const activeApiKey = isTwoPass ? (GEMINI_API_KEY_PREMIUM || FINAL_API_KEY) : FINAL_API_KEY;

    const finalRes = await executeOptimization(
      systemPrompt, 
      userPrompt, 
      body.level, 
      isTwoPass, 
      activeApiKey, 
      !!body.stream,
    );

    if (body.stream) {
      // Pass supabaseAdmin instead of supabaseUserClient
      return createOpenAIStream(finalRes, { user, body, platform: platform || "api", supabase: supabaseAdmin, clientWillSync: body.clientWillSync });
    } else {
      const finalData = await finalRes.json();
      const optimizedText = finalData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!optimizedText) {
        return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
      }

      const responseTime = (Date.now() - startTime) / 1000;

      // FIX #1: Await saveHistory so failures are surfaced and logged,
      // rather than silently dropped after the response is already sent.
      const saveHistory = async () => {
        const mappedLevel = normalizeLevel(body.level);
        const mappedMode = normalizeMode(resolvedMode);

        // Use supabaseAdmin instead of supabaseUserClient to bypass RLS
        await supabaseAdmin.from('PromptHistory').insert([{
          id: crypto.randomUUID(),
          userId: user.id,
          originalPrompt: body.text,
          optimizedPrompt: optimizedText,
          platformUsed: platform || body.platform || 'api',
          promptMode: mappedMode,
          rewriteLevel: mappedLevel,
          responseTime,
        }]).throwOnError();
      };

      if (!body.clientWillSync) {
        try {
          await saveHistory();
        } catch (err) {
          // Non-fatal: log the failure but still return the optimized result to the user.
          console.error('[Promptly] PromptHistory insert failed:', err instanceof Error ? err.message : err);
        }
      }

      return NextResponse.json<OptimizeResponse>({
        optimized: optimizedText,
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
       return NextResponse.json({ error: error.message }, { status: 502 });
    }

    captureError(isError ? error : new Error(String(error)), { route: '/api/optimize', duration, provider: 'gemini' });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    clearTimeout(routeTimeout!);
  }
});