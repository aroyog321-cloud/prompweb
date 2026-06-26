import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness, classifyTaskType, detectIntentSignals } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt, reasoningDepth } = req;
  const rawText = stripPoliteness(text.trim());
  const detectedTaskType = classifyTaskType(rawText);
  const signals = detectIntentSignals(rawText);
  const levelConfig = LEVEL_CONFIGS[level];
  const depth = reasoningDepth ?? levelConfig?.reasoningDepth ?? 3;

  // ── REFINEMENT FLOW ────────────────────────────────────────────────────────
  if (previousPrompt) {
    return `You are refining an existing optimized prompt based on user feedback.

<original_user_input>
${rawText}
</original_user_input>

<current_prompt>
${previousPrompt}
</current_prompt>

<user_feedback>
${refinement}
</user_feedback>

**Your task:**
Apply the user feedback to the current prompt using your Prompt Compiler methodology.
Do NOT output a "User Refinement" or "Feedback Applied" section. Ensure the output strictly follows the required format (Improved Prompt, Why This Version Is Better, Prompt Quality Score).
`;
  }

  // ── STANDARD FLOW ─────────────────────────────────────────────────────────
  let userPrompt = `<user_input>
${rawText}
</user_input>

**TARGET COMPILATION PARAMS:**
- **Prompt Level:** ${level}
- **Reasoning Depth:** ${depth}/5
- **Style Target:** ${STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral}
- **Detected Domain:** ${detectedTaskType}
${context ? `- **User Context Profile:** ${contextLine(context)}` : ""}
`;

  // Inject detected signals as context clues
  const signalLines: string[] = [];
  if (signals.lengthHint) signalLines.push(`- Implied length: ${signals.lengthHint}`);
  if (signals.audience) signalLines.push(`- Implied audience: ${signals.audience}`);
  if (signals.outputFormat) signalLines.push(`- Implied format: ${signals.outputFormat}`);
  if (signals.hasConstraints) signalLines.push(`- User included constraints in their input — preserve and expand them.`);

  if (signalLines.length > 0) {
    userPrompt += `\n**Detected intent signals (use these to calibrate the compile process):**\n${signalLines.join("\n")}\n`;
  }

  return userPrompt;
}
