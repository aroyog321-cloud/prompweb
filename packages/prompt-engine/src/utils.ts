import type { ContextProfile } from "@promptly/types";

/**
 * Strip common politeness / framing prefixes from a user request.
 * Identical regex to the original code in route.ts and promptEngine.ts,
 * consolidated here so both sides share one implementation.
 */
export function stripPoliteness(text: string): string {
  return text
    .replace(/^(please|can you|could you|i want to|i need to|i want you to|make me|give me|would you)\s*/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
}

/**
 * Capitalize the first character of a string.
 */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Build a single-sentence context line from a ContextProfile, in the same
 * shape the previous engines produced. Returns "" if no context is set.
 */
export function contextLine(context?: ContextProfile): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.companyName) parts.push(`The company is ${context.companyName}`);
  if (context.industry) parts.push(`operating in the ${context.industry} industry`);
  if (context.audience) parts.push(`targeting ${context.audience}`);
  if (context.brandTone) parts.push(`with a ${context.brandTone} brand tone`);
  if (context.writingStyle) parts.push(`and a ${context.writingStyle} writing style`);
  if (context.websiteUrl) parts.push(`(website: ${context.websiteUrl})`);
  if (!parts.length) return "";
  return parts.join(", ") + ".";
}

/**
 * Classify a user's input into a task type. The system prompt uses this to
 * pick a structural recipe. Lightweight heuristic — the LLM is the real
 * classifier, this just gives the LLM a starting point.
 */
export function classifyTaskType(text: string):
  | "code"
  | "writing"
  | "research"
  | "design"
  | "analysis"
  | "business"
  | "marketing"
  | "general" {
  const t = text.toLowerCase();
  
  const scores = {
    code: 0,
    writing: 0,
    research: 0,
    design: 0,
    marketing: 0,
    business: 0,
    analysis: 0,
    general: 0
  };

  // Code indicators
  if (/\b(code|function|class|interface|api|endpoint|database|sql|query)\b/.test(t)) scores.code += 3;
  if (/\b(react|vue|angular|typescript|javascript|python|java|component|hook|script|rust|go|node)\b/.test(t)) scores.code += 2;
  if (/\b(debug|error|exception|refactor|optimize|performance|bug|implement|fix)\b/.test(t)) scores.code += 1;

  // Writing indicators
  if (/\b(story|narrative|character|plot|chapter|novel|fiction|poem|speech)\b/.test(t)) scores.writing += 3;
  if (/\b(article|blog|essay|report|summary|excerpt|passage|post|caption|tweet|thread|email|newsletter|copy|headline)\b/.test(t)) scores.writing += 2;
  if (/\b(tone|voice|style|perspective|narrator|dialogue|tagline|landing page)\b/.test(t)) scores.writing += 1;

  // Research indicators
  if (/\b(study|survey|literature review|investigate|citations|academic paper|thesis)\b/.test(t)) scores.research += 3;
  if (/\b(research|evidence|proof|document|source|fact|validate)\b/.test(t)) scores.research += 2;
  if (/\b(compare|contrast|find|look up|search)\b/.test(t)) scores.research += 1;

  // Design indicators
  if (/\b(wireframe|mockup|prototype|layout|typography|color|palette)\b/.test(t)) scores.design += 3;
  if (/\b(ui|ux|user interface|user experience|figma|sketch|adobe)\b/.test(t)) scores.design += 2;
  if (/\b(visual|graphic|illustration|icon|logo|branding|design|brand)\b/.test(t)) scores.design += 1;

  // Marketing indicators
  if (/\b(seo|conversion|funnel|growth|campaign|ad|landing page|lead magnet)\b/.test(t)) scores.marketing += 3;
  if (/\b(market|target market|positioning|persona|channel|advertising)\b/.test(t)) scores.marketing += 2;
  if (/\b(brand|promotion|sales|traffic)\b/.test(t)) scores.marketing += 1;

  // Business indicators
  if (/\b(strategy|roi|okr|kpi|business model|go-to-market|pricing|revenue|cost|valuation|fundraise|pitch)\b/.test(t)) scores.business += 3;
  if (/\b(company|business|executive|management|operations|finance)\b/.test(t)) scores.business += 2;
  if (/\b(plan|proposal|analysis|report)\b/.test(t)) scores.business += 1;

  // Analysis indicators
  if (/\b(forecast|statistical|regression|variance|data science)\b/.test(t)) scores.analysis += 3;
  if (/\b(data|metric|stat|trend|chart|dashboard|spreadsheet|database|sql)\b/.test(t)) scores.analysis += 2;
  if (/\b(analyze|table|graph|kpi|metric)\b/.test(t)) scores.analysis += 1;

  // Find max score
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return "general";

  const topCategories = Object.entries(scores)
    .filter(([, score]) => score === maxScore)
    .map(([category]) => category);

  // Tie breaker priority
  const priority: Array<keyof typeof scores> = ["code", "design", "writing", "research", "analysis", "business", "marketing"];
  const bestCategory = priority.find(cat => topCategories.includes(cat));
  
  return (bestCategory || topCategories[0]) as any;
}
