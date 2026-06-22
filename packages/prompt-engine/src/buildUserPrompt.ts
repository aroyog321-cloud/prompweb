import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness, classifyTaskType, detectIntentSignals } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());
  const detectedTaskType = classifyTaskType(rawText);
  const signals = detectIntentSignals(rawText);
  const levelConfig = LEVEL_CONFIGS[level] || LEVEL_CONFIGS.medium;
  const isAdvanced = level === "aggressive" || level === "expert";
  const instructions = levelConfig.instructions.map((i: string) => `- ${i}`).join("\n");

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
Apply the user feedback to the current prompt. The feedback is a change instruction — execute it precisely.
- Keep the structural framework, persona, and style unless the feedback explicitly changes them.
- Do NOT add a "User Refinement" or "Feedback Applied" section. Output only the revised prompt.
- Fix any typos or grammar errors in the process.
- If the feedback is vague (e.g. "make it shorter"), interpret it as: remove padding, consolidate redundant sections, tighten each sentence — never remove structural sections that carry semantic content.
`;
  }

  // ── STANDARD FLOW ─────────────────────────────────────────────────────────
  let userPrompt = "";

  // For advanced levels, add an intent-analysis scaffold BEFORE the generation
  // task. This forces the model to reason about what the user actually needs
  // before writing — dramatically improves semantic precision on vague inputs.
  if (isAdvanced) {
    userPrompt += `**Before you write the rewritten prompt, reason through the following (internally — do not output this reasoning):**
1. What is the user's ACTUAL goal? (Not what they typed — what outcome do they need?)
2. What are the 2-3 most likely ways an AI model would fail if sent the original input as-is?
3. What specific information is missing that the model would have to guess? What concrete assumptions should be injected?
4. What domain-specific failure modes or clichés should be explicitly forbidden in the constraints?

Now, with that analysis in mind, write the rewritten prompt:

`;
  }

  // Core task instruction
  userPrompt += `<user_input>
${rawText}
</user_input>

**Rewrite this into a high-performance prompt at ${level} level using the ${req.mode} persona.**

${refinement ? `**REFINEMENT INSTRUCTION:**
The user has reviewed a previous version and asked for the following change:
<user_feedback>${refinement}</user_feedback>
Apply this feedback by modifying the prompt's content and structure directly. Do NOT output a "Refinement" section — just produce the improved prompt.

` : ""}`;

  // Inject detected signals as context clues
  const signalLines: string[] = [];
  if (signals.lengthHint) signalLines.push(`- Implied length: ${signals.lengthHint}`);
  if (signals.audience) signalLines.push(`- Implied audience: ${signals.audience}`);
  if (signals.outputFormat) signalLines.push(`- Implied format: ${signals.outputFormat}`);
  if (signals.hasConstraints) signalLines.push(`- User included constraints in their input — preserve and expand them.`);

  if (signalLines.length > 0) {
    userPrompt += `**Detected intent signals (use these to calibrate the rewrite):**
${signalLines.join("\n")}

`;
  }

  userPrompt += `**Detected task domain:** ${detectedTaskType}
**Style target:** ${STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral}
${context ? `**User context profile:** ${contextLine(context)}` : ""}

**Level instructions for ${level}:**
${instructions}
`;

  return userPrompt;
}
