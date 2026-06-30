import { SupabaseClient } from '@supabase/supabase-js';

interface StreamContext {
  user: { id: string };
  body: {
    text: string;
    mode: string;
    level: string;
    platform?: string;
  };
  platform: string;
  supabase: SupabaseClient;
}

// Single source of truth for level → DB enum value mapping.
// Must match exactly what was added to the RewriteLevel enum in Supabase.
const LEVEL_TO_DB: Record<string, string> = {
  // Original 4 values
  LIGHT:              'LIGHT',
  MEDIUM:             'MEDIUM',
  AGGRESSIVE:         'AGGRESSIVE',
  EXPERT:             'EXPERT',
  // New values added by extend_rewrite_level_enum migration
  BASIC:              'BASIC',
  PROFESSIONAL:       'PROFESSIONAL',
  'STAFF+':           'STAFF+',           // ← was incorrectly 'STAFF_PLUS'
  STAFF_PLUS:         'STAFF+',           // normalise alternate form
  RESEARCH:           'RESEARCH',
  'PRODUCTION AUDIT': 'PRODUCTION AUDIT', // ← was incorrectly 'PRODUCTION_AUDIT'
  PRODUCTION_AUDIT:   'PRODUCTION AUDIT', // normalise alternate form
};

// Must match PromptMode enum in Supabase exactly.
const MODE_TO_DB: Record<string, string> = {
  GENERAL:          'GENERAL',
  DEVELOPER:        'DEVELOPER',
  DESIGNER:         'DESIGNER',
  MARKETING:        'MARKETING',
  RESEARCH:         'RESEARCH',
  BUSINESS:         'BUSINESS',
  CONTENT_CREATOR:  'CONTENT_CREATOR',
  'CONTENT-CREATOR':'CONTENT_CREATOR',
  STARTUP_FOUNDER:  'STARTUP_FOUNDER',
  'STARTUP-FOUNDER':'STARTUP_FOUNDER',
};

function toDbLevel(raw: string | undefined): string {
  const key = (raw ?? '').toUpperCase();
  return LEVEL_TO_DB[key] ?? LEVEL_TO_DB[key.replace(/ /g, '_')] ?? 'MEDIUM';
}

function toDbMode(raw: string | undefined): string {
  const key = (raw ?? '').toUpperCase().replace(/-/g, '_');
  return MODE_TO_DB[key] ?? 'GENERAL';
}

/**
 * Converts a raw Gemini SSE response into an OpenAI-compatible SSE stream.
 * On stream completion (flush), persists the full optimized text to PromptHistory.
 */
export function createOpenAIStream(response: Response, context?: StreamContext) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulatedText = '';
  let buffer = '';
  const startTime = Date.now();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);
        if (dataStr.trim() === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.error) {
            const errorChunk = {
              choices: [{ delta: { content: `\n[API Error: ${data.error.message ?? 'Unknown error during stream'}]` } }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
            continue;
          }
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            accumulatedText += content;
            const openAIChunk = { choices: [{ delta: { content } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    },

    async flush() {
      if (!context || !accumulatedText.trim()) return;

      const responseTime = (Date.now() - startTime) / 1000;
      const dbLevel = toDbLevel(context.body.level);
      const dbMode  = toDbMode(context.body.mode);

      // Strip the '--- Prompt Strength: X/10 → Y/10' footer before saving
      const cleanText = (() => {
        const parts = accumulatedText.trim().split(/\n---\n/);
        if (parts.length > 1) return parts[0].trim();
        const match = accumulatedText.match(/## Improved Prompt\s+([\s\S]*?)(?=## Why This Version Is Better|---\s*Prompt Strength|$)/i);
        if (match?.[1]) return match[1].trim();
        return accumulatedText.trim();
      })();

      try {
        const { error } = await context.supabase.from('PromptHistory').insert([{
          id:               crypto.randomUUID(),
          userId:           context.user.id,
          originalPrompt:  context.body.text,
          optimizedPrompt: cleanText,
          platformUsed:    context.platform || context.body.platform || 'api',
          promptMode:      dbMode,
          rewriteLevel:    dbLevel,
          responseTime,
        }]);

        if (error) {
          console.error('[Promptly] PromptHistory stream-flush insert failed:', error.message, { dbLevel, dbMode });
        }
      } catch (e) {
        console.error('[Promptly] PromptHistory stream-flush exception:', e);
      }
    },
  });

  const readable = response.body?.pipeThrough(transformStream);
  if (!readable) {
    return new Response('Failed to start stream', { status: 500 });
  }

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
