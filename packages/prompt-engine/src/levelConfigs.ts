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
    maxOutputTokens: 1000,
  },
  "Professional": {
    reasoningDepth: 2,
    temperature: 0.5,
    maxOutputTokens: 2000,
  },
  "Staff+": {
    reasoningDepth: 3,
    temperature: 0.6,
    maxOutputTokens: 3500,
  },
  "Research": {
    reasoningDepth: 4,
    temperature: 0.65,
    maxOutputTokens: 4500,
  },
  "Production Audit": {
    reasoningDepth: 5,
    temperature: 0.7,
    maxOutputTokens: 6000,
  },
};

export function getLevelConfig(level: string, isCritique: boolean = false) {
  if (isCritique) return { temperature: 0.3, maxOutputTokens: 4500 };
  const config = LEVEL_CONFIGS[level as RewriteLevel];
  if (config) {
    return { temperature: config.temperature, maxOutputTokens: config.maxOutputTokens };
  }
  return { temperature: 0.6, maxOutputTokens: 3500 };
}
