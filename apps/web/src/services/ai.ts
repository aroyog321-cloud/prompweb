import { RewriteLevel } from "@promptly/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function makeGeminiCall(
  systemPrompt: string, 
  userPrompt: string, 
  stream: boolean, 
  config: { temperature: number, maxOutputTokens: number }, 
  apiKey: string,
  routeSignal?: AbortSignal
) {
  const endpoint = stream 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let attempt = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      let finalSignal: AbortSignal;
      
      if (routeSignal) {
        // If AbortSignal.any is available (Node 20+), use it to combine the route timeout and the retry timeout.
        // Otherwise, fall back to the routeSignal which has a 50s timeout.
        finalSignal = typeof AbortSignal.any === 'function' 
          ? AbortSignal.any([routeSignal, AbortSignal.timeout(45000)])
          : routeSignal;
      } else {
        finalSignal = AbortSignal.timeout(45000);
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: config.temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: config.maxOutputTokens,
          }
        }),
        signal: finalSignal
      });

      if (!response.ok) {
        const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
        if (isRetryable && attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        
        let errorMsg = `Gemini API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg += ` - ${errorData.error?.message || 'Unknown error'}`;
        } catch(e) {}
        throw new Error(errorMsg);
      }

      return response;
    } catch (e: any) {
      lastError = e;
      
      if (routeSignal?.aborted || e.name === 'AbortError') {
        throw e;
      }
      
      if (e.name === 'TimeoutError' && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      if (attempt >= maxAttempts) throw e;
    }
  }
  
  throw lastError;
}
