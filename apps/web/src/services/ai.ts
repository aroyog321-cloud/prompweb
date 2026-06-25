import { RewriteLevel } from "@promptly/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function makeGeminiCall(
  systemPrompt: string, 
  userPrompt: string, 
  stream: boolean, 
  config: { temperature: number, maxOutputTokens: number }, 
  apiKey: string
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
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
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
      if (e.name === 'AbortError' && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      if (attempt >= maxAttempts) throw e;
    }
  }
  
  throw lastError;
}
