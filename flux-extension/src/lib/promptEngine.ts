import { OptimizeRequest, OptimizeResponse, PromptMode } from '@promptly/types';
import { localOptimize, buildSystemPrompt, buildUserPrompt, getLevelConfig } from '@promptly/prompt-engine';

class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 50) {
    this.max = max;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, val);
    if (this.cache.size > this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

const PROMPT_CACHE = new LRUCache<string, OptimizeResponse>(50);


async function directAIFetch(endpoint: string, apiKey: string | undefined, messages: any[], config: any, stream: boolean, onChunk?: (chunk: string) => void, signal?: AbortSignal) {
  const payload = {
    model: "gpt-4o",
    messages,
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    stream
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) throw new Error("API responded with " + res.status);

  if (stream && onChunk && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? "";
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0]?.delta?.content) {
              const delta = data.choices[0].delta.content;
              fullText += delta;
              onChunk(delta);
            }
          } catch (e) {}
        }
      }
    }
    return fullText.trim();
  } else {
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }
}

function keywordClassify(text: string): PromptMode {
  const t = text.toLowerCase();
  
  if (/\b(code|function|api|database|bug|typescript|python|react|sql|deploy|refactor|implement|git|github|backend|frontend|devops|architecture|algorithm|debug|component|css|html|server|docker|aws|cloud|repo|javascript|rust|golang|c\+\+|java|syntax|error|compile|terminal|script|variable|endpoint)\b/.test(t)) return "developer";
  
  if (/\b(design|mockup|wireframe|ux|ui|figma|typography|color|logo|prototype|layout|palette|interface|aesthetic|branding|user flow|sketch|adobe|padding|margin|accessibility|a11y|responsive|gradient|visual|contrast)\b/.test(t)) return "designer";
  
  if (/\b(marketing|campaign|ad copy|seo|funnel|landing page|lead magnet|growth|conversion|ctr|cpa|audience|target market|email sequence|newsletter growth|retention|brand awareness|social media|twitter thread|viral|engagement|clickbait)\b/.test(t)) return "marketing";
  
  if (/\b(research|study|paper|evidence|citation|thesis|literature|methodology|hypothesis|experiment|data analysis|academic|peer-reviewed|journal|abstract|statistics|survey|qualitative|quantitative|analysis|synthesis|review)\b/.test(t)) return "research";
  
  if (/\b(money|income|earn|profit|cash|wealth|affiliate|ecommerce|side[- ]hustle|passive[- ]income|monetiz|invest|trading|crypto|revenue|business model|saas|pricing|margin|roi|sales|pipeline|strategy|acquisition)\b/.test(t)) return "business";
  
  if (/\b(blog|article|story|essay|video script|newsletter|caption|headline|tweet|script|youtube|podcast|short form|tiktok|reels|instagram|narrative|hook|storytelling|writer|drafting|copywriting)\b/.test(t)) return "content-creator";
  
  if (/\b(mvp|launch|founder|investor|pitch|startup|go-to-market|funding|seed round|series a|vc|venture capital|term sheet|co-founder|product-market fit|pmf|pivot|burn rate|runway|valuation|lean startup|incubator)\b/.test(t)) return "startup-founder";
  
  return "general";
}

async function resolveMode(req: OptimizeRequest, config: { categorizerApiUrl?: string; categorizerApiKey?: string; }): Promise<PromptMode> {
  if (req.mode !== "auto") return req.mode;
  if (config.categorizerApiUrl) {
    try {
      const categorizerPrompt = `Classify this user request into EXACTLY ONE of the following categories: general, developer, designer, marketing, research, business, content-creator, startup-founder. Output ONLY the category name. Do not include punctuation or explanation.\n\nRequest: "${req.text}"`;
      const isDirectCategorizer = config.categorizerApiUrl.includes('/chat/completions') || config.categorizerApiUrl.includes('/v1');
      if (isDirectCategorizer) {
        const endpoint = config.categorizerApiUrl.endsWith('/chat/completions') ? config.categorizerApiUrl : `${config.categorizerApiUrl.replace(/\/+$/, "")}/chat/completions`;
        const catResult = await directAIFetch(endpoint, config.categorizerApiKey, [{ role: "user", content: categorizerPrompt }], { temperature: 0.1, maxOutputTokens: 20 }, false);
        const rawCategory = catResult.trim().toLowerCase();
        if (["general", "developer", "designer", "marketing", "research", "business", "content-creator", "startup-founder"].includes(rawCategory)) {
          return rawCategory as any;
        }
      }
    } catch (e) {
      console.warn("Categorizer API failed, falling back to keyword classify", e);
    }
  }
  return keywordClassify(req.text);
}

export async function optimizePrompt(
  req: OptimizeRequest,
  config: { apiBaseUrl?: string; apiKey?: string; categorizerApiUrl?: string; categorizerApiKey?: string; accessToken?: string; },
  options?: { onChunk?: (chunk: string) => void, abortSignal?: AbortSignal }
): Promise<OptimizeResponse> {
  let lastError: Error | undefined;

  if (req.mode === "auto") {
    req.mode = await resolveMode(req, config);
  }

  const cacheKey = JSON.stringify({ 
    text: req.text, 
    mode: req.mode, 
    level: req.level, 
    refinement: req.refinement,
    previousPrompt: req.previousPrompt
  });
  if (!req.refinement && PROMPT_CACHE.has(cacheKey) && !options?.onChunk) {
    // return PROMPT_CACHE.get(cacheKey)!; // Disabled cache to ensure all history syncs to server
  }

  if (config.apiBaseUrl) {
    try {
      const isDirectAI = config.apiBaseUrl.includes('/chat/completions') || config.apiBaseUrl.includes('/v1');
      let endpoint = isDirectAI
        ? (config.apiBaseUrl.endsWith('/chat/completions') ? config.apiBaseUrl : `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`)
        : `${config.apiBaseUrl.replace(/\/$/, "")}/api/optimize`;

      if (isDirectAI) {
        const SAFE_PLATFORMS = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'poe.com', 'perplexity.ai'];
        const rawPlatform = req.platform || window.location.hostname || "unknown";
        const platform = SAFE_PLATFORMS.includes(rawPlatform) ? rawPlatform : 'web';
        const systemPrompt = buildSystemPrompt(req.mode, req.level, platform);
        const userPrompt = buildUserPrompt(req);
        const isTwoPass = req.level === "aggressive" || req.level === "expert";

        if (isTwoPass) {
          // Pass 1: Draft (no stream)
          const draftText = await directAIFetch(
            endpoint, 
            config.apiKey, 
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ], 
            getLevelConfig(req.level, false), 
            false,
            undefined,
            options?.abortSignal
          );

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
${req.level === "expert" ? "- EDGE CASES: Must explicitly name 2-3 likely failure modes for the model to watch out for." : ""}

DRAFT:
${draftText}`;

          const critiqueSystemPrompt = "You are a precise editor. Apply the rubric exactly as stated. Output only the revised prompt.";
          const finalResult = await directAIFetch(
            endpoint,
            config.apiKey,
            [
              { role: "system", content: critiqueSystemPrompt },
              { role: "user", content: critiquePrompt }
            ],
            getLevelConfig(req.level, true),
            !!req.stream,
            options?.onChunk,
            options?.abortSignal
          );

          const response: OptimizeResponse = { optimized: finalResult, source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        } else {
          // 1-Pass
          const finalResult = await directAIFetch(
            endpoint,
            config.apiKey,
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            getLevelConfig(req.level, false),
            !!req.stream,
            options?.onChunk,
            options?.abortSignal
          );

          const response: OptimizeResponse = { optimized: finalResult, source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
      } else {
        // Next.js Route
        let payload: any = { ...req, platform: req.platform || window.location.hostname || "unknown" };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            ...(config.accessToken ? { "Authorization": `Bearer ${config.accessToken}` } : (config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})) 
          },
          body: JSON.stringify(payload),
          signal: options?.abortSignal
        });
        if (!res.ok) {
          let errorMsg = "API responded with " + res.status;
          try {
            const errData = await res.json();
            if (errData.error) {
              errorMsg = errData.error;
              if (errData.details) errorMsg += ` (${errData.details})`;
            }
          } catch (e) {}
          
          if (res.status === 401) {
            // Token is invalid/expired. Request re-auth instead of wiping permanently.
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: "PROMPTLY_REAUTH_REQUEST" });
                }
              });
              try { chrome.storage.local.remove('apiPlanCache'); } catch(e){}
            }
          }
          
          throw new Error(errorMsg);
        }
        
        if (req.stream && options?.onChunk && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices && data.choices[0]?.delta?.content) {
                    const delta = data.choices[0].delta.content;
                    fullText += delta;
                    options.onChunk(delta); // Send delta only
                  }
                } catch (e) {}
              }
            }
          }
          const response: OptimizeResponse = { optimized: fullText.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }

        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) {
          const response: OptimizeResponse = { optimized: data.choices[0].message.content.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
        if (typeof data.optimized === "string" && data.optimized.trim()) {
          const response: OptimizeResponse = { optimized: data.optimized.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
        throw new Error("Malformed API response");
      }
    } catch (e) {
      if (e instanceof Error && (e.message.includes("401") || e.message.includes("403"))) {
        throw e; // Do not fallback to local if unauthorized
      }
      
      // Attempt to extract the clean message without the 'Error: ' prefix
      let cleanMsg = e instanceof Error ? e.message : String(e);
      if (cleanMsg.startsWith("Error: ")) cleanMsg = cleanMsg.slice(7);
      
      console.warn("[Promptly] API Optimization failed, falling back to local template.", cleanMsg);
      lastError = new Error(cleanMsg);
    }
  }
  
  const localResponse: OptimizeResponse = { 
    optimized: localOptimize(req), 
    source: "local-fallback",
    degraded: true,
    degradedReason: lastError ? lastError.message : "API URL missing or unreachable"
  };
  if (!req.refinement) PROMPT_CACHE.set(cacheKey, localResponse);
  
  if (options?.onChunk) {
    // Simulate streaming for local fallback
    const text = localResponse.optimized;
    for (let i = 0; i < text.length; i += 5) {
      options.onChunk(text.substring(i, i + 5));
      await new Promise(r => setTimeout(r, 10));
    }
  }

  return localResponse;
}
