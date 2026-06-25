import type { RewriteLevel } from "@promptly/types";

/**
 * Per-level configuration. Controls temperature, token budget, structural
 * depth, and whether to run the two-pass critique workflow.
 *
 * Key changes from v1:
 * - Temperatures raised: medium 0.4→0.6, aggressive 0.6→0.65, expert 0.7→0.72.
 *   Prompt reconstruction is a creative synthesis task — conservative temps
 *   produce hedged, generic rewrites.
 * - maxOutputTokens raised significantly: expert prompts regularly hit 1000+
 *   words; the old 2048-token cap was cutting expert outputs mid-section.
 * - Instructions rewritten to target semantic precision, not structural
 *   compliance. "Fill in obvious missing context" → "inject concrete, labeled
 *   assumptions for any information the model would otherwise have to guess."
 */
export interface LevelConfig {
  framework: "polish" | "structure" | "engineer" | "strategize";
  instructions: string[];
  minStructure: "inline" | "headed" | "multi-section" | "full-recipe";
  twoPassCritique: boolean;
  examplesToShow: number[];
  temperature: number;
  maxOutputTokens: number;
}

export const LEVEL_CONFIGS: Record<RewriteLevel, LevelConfig> = {
  light: {
    framework: "polish",
    minStructure: "inline",
    twoPassCritique: false,
    examplesToShow: [1],
    temperature: 0.3,
    maxOutputTokens: 900,
    instructions: [
      "Preserve the user's original intent and phrasing as much as possible.",
      "Fix every ambiguity — anywhere the AI could misread the request, clarify it.",
      "Correct all spelling, grammar, and punctuation errors. Never copy typos into the output.",
      "Add one concrete output format constraint if none exists (e.g. length, structure, or tone).",
      "Output must be self-contained — the AI reading it should not need to ask clarifying questions.",
    ],
  },

  medium: {
    framework: "structure",
    minStructure: "headed",
    twoPassCritique: false,
    examplesToShow: [1, 2],
    temperature: 0.6,
    maxOutputTokens: 1600,
    instructions: [
      "Correct all spelling, grammar, and punctuation errors. Never copy typos into the output.",
      "Establish a clear Role → Context → Task → Output Format flow using Markdown headers.",
      "Make the Role specific: not 'an expert' — name the type of person, their key experiences, and what they care about.",
      "Fill context gaps with concrete, labeled assumptions (prefix with 'Assumption:') rather than leaving the model to guess.",
      "Define the output format precisely: type, length, structure, tone — not just 'a report' or 'a list'.",
      "Add at least 1 negative constraint (Do NOT / Avoid) to prevent the model's most common failure mode on this task.",
    ],
  },

  aggressive: {
    framework: "engineer",
    minStructure: "multi-section",
    twoPassCritique: true,
    examplesToShow: [1, 2],
    temperature: 0.65,
    maxOutputTokens: 3200,
    instructions: [
      "Correct all spelling, grammar, and punctuation errors. Never copy typos into the output.",
      "Apply the CO-STAR framework in full: Context, Objective, Style, Tone, Audience, Response format.",
      "Role must be ultra-specific: name the persona's domain, relevant track record, and decision-making philosophy — not a job title.",
      "Context must state concrete facts (team size, constraints, history, stakes) — not category descriptions.",
      "Objective: one deliverable with measurable success criteria (word count, score, specific structure).",
      "Constraints: at least 2 explicit 'Do NOT' rules that name the specific failure modes to avoid on this task.",
      "Output format: name the exact artifact — number of sections, their order, approximate length per section, and any special formatting.",
      "Success criteria: describe what the output looks like when done well, in terms a skeptic could verify.",
    ],
  },

  expert: {
    framework: "strategize",
    minStructure: "full-recipe",
    twoPassCritique: true,
    examplesToShow: [1, 2],
    temperature: 0.72,
    maxOutputTokens: 4500,
    instructions: [
      "Correct all spelling, grammar, and punctuation errors. Never copy typos into the output.",
      "Apply CO-STAR + the full mode-specific structural recipe.",
      "Role: a specific person, not a category — include their expertise, their opinions, and the failure modes they've seen before.",
      "Context: concrete facts only. No category descriptions. Label any injected assumptions explicitly.",
      "Objective: one deliverable with specific, measurable success criteria.",
      "Constraints: at least 3 negative constraints. Name the specific clichés, patterns, or assumptions to avoid on this exact task.",
      "Output format: exact artifact type, section titles in order, length per section, format of any lists or tables.",
      "Success criteria: observable properties of a high-quality output, verifiable by a non-expert reader.",
      "Edge cases: name 2-3 specific failure modes the model should watch for on this task and explicitly instruct it to avoid them.",
      "Anti-hallucination: explicitly instruct the model not to invent specifics (citations, statistics, library names) not given.",
      "Use XML tags (<role>, <context>, <task>, <constraints>) for complex multi-section prompts where hierarchical parsing matters.",
    ],
  },
};

export function getLevelConfig(level: string, isCritique: boolean = false) {
  if (isCritique) return { temperature: 0.3, maxOutputTokens: 4500 };
  switch (level) {
    case "light":      return { temperature: 0.2, maxOutputTokens: 900 };
    case "medium":     return { temperature: 0.4, maxOutputTokens: 1600 };
    case "aggressive": return { temperature: 0.6, maxOutputTokens: 3200 };
    case "expert":     return { temperature: 0.7, maxOutputTokens: 4500 };
    default:           return { temperature: 0.6, maxOutputTokens: 3200 };
  }
}
