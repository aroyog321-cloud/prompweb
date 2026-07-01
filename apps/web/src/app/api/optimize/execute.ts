import { makeGeminiCall } from '@/services/ai';

const LEVEL_CONFIGS: Record<string, { temperature: number; maxOutputTokens: number }> = {
  "Basic": {
    temperature: 0.3,
    maxOutputTokens: 400,       // ~300 words
  },
  "Professional": {
    temperature: 0.5,
    maxOutputTokens: 900,       // ~675 words
  },
  "Staff+": {
    temperature: 0.65,
    maxOutputTokens: 2000,      // ~1500 words — comprehensive mega-prompt
  },
  "Research": {
    temperature: 0.65,
    maxOutputTokens: 2800,      // ~2100 words — deep research brief
  },
  "Production Audit": {
    temperature: 0.7,
    maxOutputTokens: 3500,      // ~2600 words — maximum depth audit framework
  },
};

function getLocalLevelConfig(level: string) {
  const config = LEVEL_CONFIGS[level];
  if (config) {
    return { temperature: config.temperature, maxOutputTokens: config.maxOutputTokens };
  }
  return { temperature: 0.6, maxOutputTokens: 2000 };
}

export async function executeOptimization(
  systemPrompt: string,
  userPrompt: string,
  level: string,
  _isTwoPass: boolean,  // kept for API compatibility, no longer used
  activeApiKey: string,
  stream: boolean,
  signal?: AbortSignal
) {
  // Single-pass only. The two-pass critique was removed because:
  // 1. It doubled latency (2 sequential Gemini API calls)
  // 2. The critique rubric forced phases/criteria into every output regardless of input complexity
  // 3. The new system prompt is precise enough to produce correct output in one pass
  return makeGeminiCall(
    systemPrompt,
    userPrompt,
    stream,
    getLocalLevelConfig(level),
    activeApiKey,
    signal
  );
}
