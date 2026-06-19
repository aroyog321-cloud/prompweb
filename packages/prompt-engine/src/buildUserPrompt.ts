import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness, classifyTaskType } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());
  const detectedTaskType = classifyTaskType(rawText);
  
  const levelConfig = LEVEL_CONFIGS[level] || LEVEL_CONFIGS.medium;
  
  let instructions = levelConfig.instructions.map((i: string) => `- ${i}`).join('\n');
  
  let userPrompt = previousPrompt ? `You are refining an existing prompt based on user feedback.

1. ORIGINAL INTENT:
---
${rawText}
---

2. CURRENTLY GENERATED PROMPT (with any manual edits the user made):
---
${previousPrompt}
---

3. USER FEEDBACK / REFINEMENT REQUEST:
"${refinement}"

Your task:
Apply the USER FEEDBACK to the CURRENTLY GENERATED PROMPT.
Ensure you still fulfill the ORIGINAL INTENT.
Maintain the existing structural framework, persona, and style unless the feedback explicitly asks to change them.
DO NOT output a "User Refinement" or "Feedback" section or header. Just produce the new, modified prompt directly.
` : `Here is the user's raw input:
---
${rawText}
---

Your task:
Rewrite this into a world-class prompt based on the CO-STAR framework.

${refinement ? `CRITICAL REFINEMENT INSTRUCTION:
The user has reviewed the previous version of this prompt and asked for the following change:
"${refinement}"
You MUST apply this feedback by changing the content, style, and structure of the prompt itself. DO NOT output a "User Refinement" section or header. Simply produce the new, refined prompt that satisfies this feedback.\n` : ""}`;

  userPrompt += `
Detected task type: ${detectedTaskType}
Target Style: ${STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral}
${context ? `Context Profile: ${contextLine(context)}` : ''}

Level Instructions:
${instructions}
`;

  return userPrompt;
}
