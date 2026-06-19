import type { RewriteLevel } from "@promptly/types";

/**
 * Per-level configuration. Drives both the system prompt (what methodology
 * the LLM uses) and the user prompt (what the rewritten prompt must include).
 */
export interface LevelConfig {
  /** Short label for the current pass (visible in the system prompt). */
  framework: "polish" | "structure" | "engineer" | "strategize";
  /** Bullet list of requirements for the rewritten prompt. */
  instructions: string[];
  /** Whether the rewritten prompt should use full Markdown sections. */
  addSections: boolean;
  /** Whether to run a 2-pass critique (draft → critique → revise). */
  twoPassCritique: boolean;
  /** Which few-shot examples to show (1-based; pass [] for none). */
  examplesToShow: number[];
}

export const LEVEL_CONFIGS: Record<RewriteLevel, LevelConfig> = {
  light: {
    framework: "polish",
    instructions: [
      "Fix ambiguity.",
      "Correct grammar and spelling.",
      "Ensure the core intent is crystal clear.",
      "Keep the original phrasing largely intact.",
    ],
    addSections: false,
    twoPassCritique: false,
    examplesToShow: [1],
  },
  medium: {
    framework: "structure",
    instructions: [
      "Establish a clear Role → Task → Format flow.",
      "Fill in obvious missing context.",
      "Add 3-5 essential requirements.",
      "Specify the desired output format (length, structure, tone).",
      "Use Markdown headings. Use stable section names.",
    ],
    addSections: true,
    twoPassCritique: false,
    examplesToShow: [1, 2],
  },
  aggressive: {
    framework: "engineer",
    instructions: [
      "Apply the CO-STAR framework fully (Context, Objective, Style, Tone, Audience, Response).",
      "Include negative constraints — at least 2 'Do NOT' / 'Avoid' rules.",
      "Define a specific, high-quality output format (sections, length, structure).",
      "Inject strategic assumptions into the Context section so the model doesn't have to guess.",
      "Include explicit success criteria so the reader knows when the output is good.",
    ],
    addSections: true,
    twoPassCritique: true,
    examplesToShow: [1, 2],
  },
  expert: {
    framework: "strategize",
    instructions: [
      "Apply CO-STAR + a domain-appropriate structural recipe (see STRUCTURAL RECIPES).",
      "Include at least 2 negative constraints.",
      "Define rigorous, measurable success criteria.",
      "Include an Edge Cases / Failure Modes section that names specific risks.",
      "Use Markdown for structure. For complex tasks, use XML tags (<context>, <task>, <constraints>) — they work very well with Claude and GPT-4+.",
      "Apply anti-hallucination discipline: do not invent APIs, citations, statistics, or product features the user did not provide.",
    ],
    addSections: true,
    twoPassCritique: true,
    examplesToShow: [1, 2],
  },
};
