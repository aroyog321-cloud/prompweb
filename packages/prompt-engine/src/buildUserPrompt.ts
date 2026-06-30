import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());
  const levelConfig = LEVEL_CONFIGS[level];

  // ── REFINEMENT FLOW ────────────────────────────────────────────────────────
  if (previousPrompt) {
    return `You are refining an existing generated prompt based on user feedback.

<original_user_input>
${rawText}
</original_user_input>

<current_prompt>
${previousPrompt}
</current_prompt>

<user_feedback>
${refinement}
</user_feedback>

Apply the feedback to improve the current prompt. Output only the revised prompt. Then add the footer: "---\\nPrompt Strength: [X]/10 → [Y]/10"
`;
  }

  // ── STANDARD FLOW ─────────────────────────────────────────────────────────
  const styleGuideline = STYLE_GUIDELINES[style] || style;
  
  // Word limits based on intensity
  const limits: Record<string, string> = {
    "Basic": "under 100 words",
    "Professional": "150-250 words",
    "Staff+": "250-400 words",
    "Research": "350-500 words",
    "Production Audit": "500-700 words"
  };
  const wordLimit = limits[level] || "150-250 words";

  let userPrompt = `Intensity level: ${level}
Style of the prompt: ${styleGuideline}
Prompt generation limit of text: ${wordLimit}
`;

  // Context memory
  const contextBlock = context ? contextLine(context) : "";
  if (contextBlock) {
    userPrompt += `Context memory: ${contextBlock}\n\n`;
  } else {
    userPrompt += `\n`;
  }

  userPrompt += `Generate a prompt of this: "${rawText}" create this into a good prompt.`;

  return userPrompt;
}
