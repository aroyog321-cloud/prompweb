import type { RewriteLevel } from "@promptly/types";

export interface LevelConfig {
  reasoningDepth: number;
  temperature: number;
  maxOutputTokens: number;
}

export const LEVEL_CONFIGS: Record<RewriteLevel, LevelConfig> = {
  "Basic": {
    reasoningDepth: 1,
    temperature: 0.3,
    maxOutputTokens: 400,       // ~300 words — keep short
  },
  "Professional": {
    reasoningDepth: 2,
    temperature: 0.5,
    maxOutputTokens: 900,       // ~675 words — structured
  },
  "Staff+": {
    reasoningDepth: 3,
    temperature: 0.65,
    maxOutputTokens: 2000,      // ~1500 words — comprehensive mega-prompt
  },
  "Research": {
    reasoningDepth: 4,
    temperature: 0.65,
    maxOutputTokens: 2800,      // ~2100 words — deep research brief
  },
  "Production Audit": {
    reasoningDepth: 5,
    temperature: 0.7,
    maxOutputTokens: 3500,      // ~2600 words — maximum depth audit framework
  },
};

export function getLevelConfig(level: string, isCritique: boolean = false) {
  if (isCritique) return { temperature: 0.3, maxOutputTokens: 1100 };
  const config = LEVEL_CONFIGS[level as RewriteLevel];
  if (config) {
    return { temperature: config.temperature, maxOutputTokens: config.maxOutputTokens };
  }
  return { temperature: 0.6, maxOutputTokens: 1100 };
}
