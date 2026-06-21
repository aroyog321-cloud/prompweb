export type PromptMode =
  | "auto"
  | "general"
  | "developer"
  | "designer"
  | "marketing"
  | "research"
  | "business"
  | "content-creator"
  | "startup-founder";

export type RewriteLevel = "light" | "medium" | "aggressive" | "expert";

export type PromptStyle = "neutral" | "formal" | "conversational" | "academic" | "creative" | "direct";

export const PROMPT_MODES: { value: PromptMode; label: string }[] = [
  { value: "auto", label: "Auto-Detect" },
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

export const PROMPT_STYLES: { value: PromptStyle; label: string; description: string }[] = [
  { value: "neutral", label: "Neutral", description: "Balanced and objective tone" },
  { value: "formal", label: "Formal", description: "Professional and authoritative tone" },
  { value: "conversational", label: "Conversational", description: "Friendly and approachable tone" },
  { value: "academic", label: "Academic", description: "Scholarly and rigorous tone" },
  { value: "creative", label: "Creative", description: "Imaginative and expressive tone" },
  { value: "direct", label: "Direct", description: "Concise and no-nonsense tone" }
];

export interface ContextProfile {
  companyName?: string;
  brandTone?: string;
  websiteUrl?: string;
  audience?: string;
  industry?: string;
  writingStyle?: string;
}

export interface PromptlySettings {
  theme: "dark" | "light" | "system";
  defaultMode: PromptMode;
  defaultLevel: RewriteLevel;
  defaultStyle: PromptStyle;
  shortcutEnabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  categorizerApiUrl?: string;
  categorizerApiKey?: string;
  accessToken?: string;
  contextProfile: ContextProfile;
  contextInjectionEnabled: boolean;
}

export const DEFAULT_SETTINGS: PromptlySettings = {
  theme: "dark",
  defaultMode: "general",
  defaultLevel: "medium",
  defaultStyle: "neutral",
  shortcutEnabled: true,
  apiBaseUrl: "https://prompweb.vercel.app",
  apiKey: "",
  categorizerApiUrl: "",
  categorizerApiKey: "",
  accessToken: "",
  contextProfile: {},
  contextInjectionEnabled: false
};

export interface OptimizeRequest {
  text: string;
  mode: PromptMode;
  level: RewriteLevel;
  style: PromptStyle;
  context?: ContextProfile;
  stream?: boolean;
  refinement?: string;
  previousPrompt?: string;
  platform?: string;
}

export interface OptimizeResponse {
  optimized: string;
  source: "api" | "local-fallback";
  degraded?: boolean;
  degradedReason?: string;
}

export type SubscriptionTier = "free" | "pro" | "expert";

export interface UserProfile {
  id: string;
  email?: string;
  tier: SubscriptionTier;
  createdAt: string;
}

export interface UserUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  totalRequests: number;
  aggressiveExpertRequests: number;
  regenerations: number;
}
