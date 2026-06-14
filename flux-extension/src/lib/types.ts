export type PromptMode =
  | "general"
  | "developer"
  | "designer"
  | "marketing"
  | "research"
  | "business"
  | "content-creator"
  | "startup-founder";

export type RewriteLevel = "light" | "medium" | "aggressive" | "expert";

export const PROMPT_MODES: { value: PromptMode; label: string }[] = [
  { value: "general", label: "General" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "marketing", label: "Marketing" },
  { value: "research", label: "Research" },
  { value: "business", label: "Business" },
  { value: "content-creator", label: "Content Creator" },
  { value: "startup-founder", label: "Startup Founder" }
];

export const REWRITE_LEVELS: { value: RewriteLevel; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Minor clarity tweaks, keeps original phrasing" },
  { value: "medium", label: "Medium", description: "Adds structure and missing context" },
  { value: "aggressive", label: "Aggressive", description: "Fully restructures into a detailed brief" },
  { value: "expert", label: "Expert", description: "Maximum detail, constraints, and output spec" }
];

export interface ContextProfile {
  companyName?: string;
  brandTone?: string;
  websiteUrl?: string;
  audience?: string;
  industry?: string;
  writingStyle?: string;
}

export interface FluxSettings {
  theme: "dark" | "light" | "system";
  defaultMode: PromptMode;
  defaultLevel: RewriteLevel;
  shortcutEnabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  contextProfile: ContextProfile;
  contextInjectionEnabled: boolean;
}

export const DEFAULT_SETTINGS: FluxSettings = {
  theme: "dark",
  defaultMode: "general",
  defaultLevel: "medium",
  shortcutEnabled: true,
  apiBaseUrl: "http://localhost:3000",
  apiKey: "",
  contextProfile: {},
  contextInjectionEnabled: false
};

export interface OptimizeRequest {
  text: string;
  mode: PromptMode;
  level: RewriteLevel;
  context?: ContextProfile;
}

export interface OptimizeResponse {
  optimized: string;
  source: "api" | "local-fallback";
}
