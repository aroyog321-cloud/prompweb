import { PromptMode, RewriteLevel } from "@promptly/types";
import { MODE_RECIPES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";

export async function buildSystemPrompt(mode: PromptMode, level: RewriteLevel, platform?: string): Promise<string> {
  const isExpert = level === "expert";
  const isAdvanced = level === "aggressive" || level === "expert";
  const recipe = MODE_RECIPES[mode] || MODE_RECIPES.general;
  const levelConfig = LEVEL_CONFIGS[level];

  // ─── OPENING: model excellence, don't just describe it ───────────────────
  let prompt = `You are the world's foremost prompt engineer — not because you follow frameworks, but because you understand exactly why vague inputs produce mediocre AI outputs, and you know how to fix them.

When a raw, messy, or half-formed user input lands in front of you, you do three things before writing a single word:
1. Reverse-engineer the user's REAL intent (not just what they typed — what they actually need the AI to produce).
2. Identify the 2-3 most likely failure modes if the prompt were sent as-is.
3. Decide what specific information is missing that the AI model would otherwise have to guess — and either supply it or state the assumption.

Your rewrites look nothing like templates. They are precise, opinionated, and calibrated to the specific task. A reader comparing your output to the original should immediately understand why the original was getting mediocre results.

**The single most common failure you avoid:** producing a prompt that looks structured (it has headers! it has sections!) but is semantically thin — full of generic roles, vague objectives, and content-free constraints. Structure is table stakes. Semantic precision is the actual product.

`;

  // ─── PERSONA ──────────────────────────────────────────────────────────────
  prompt += `## WHO YOU'RE WRITING FOR
This prompt will be used by someone acting as:
${recipe.persona}

Let this persona shape every word of your rewrite. Their expert judgment, their vocabulary, their way of thinking about trade-offs — all of it should bleed into the prompt's framing.

`;

  // ─── TASK DOMAIN ──────────────────────────────────────────────────────────
  prompt += `## TASK DOMAIN
${recipe.taskHint}

`;

  // ─── STRUCTURE (level-gated) ──────────────────────────────────────────────
  if (levelConfig.minStructure !== "inline") {
    const sectionsToShow =
      levelConfig.minStructure === "headed"
        ? recipe.structuralShape.slice(0, 3)
        : levelConfig.minStructure === "multi-section"
        ? recipe.structuralShape.slice(0, 6)
        : recipe.structuralShape;

    prompt += `## REQUIRED STRUCTURE
Your output MUST contain these sections as Markdown headings (you may add more):
${sectionsToShow.map((s) => `- **${s}**`).join("\n")}

`;
  }

  // ─── QUALITY STANDARD — the real differentiator ──────────────────────────
  prompt += `## QUALITY BAR\n`;
  if (level === "light") {
    prompt += `- Fix typos, structure the prompt with Markdown headers, and clarify the core objective.\n`;
  } else if (level === "medium") {
    prompt += `- Provide a specific ROLE (not just a title).\n- State a clear, measurable OBJECTIVE.\n- Define the precise OUTPUT FORMAT.\n`;
  } else {
    prompt += `- **ROLE**: Create a highly specific persona with distinct history and opinions.\n- **CONTEXT**: Inject concrete, factual assumptions if missing.\n- **OBJECTIVE**: State with strictly measurable criteria.\n- **CONSTRAINTS**: Include ≥2 negative ("Do NOT") constraints to prevent failure modes.\n- **OUTPUT FORMAT**: Specify exact sections and length.\n- **SUCCESS CRITERIA**: Define concrete evaluation rules.\n`;
    if (isExpert) {
      prompt += `- **EDGE CASES**: Name 2-3 likely failure modes and instruct the model to avoid them.\n`;
    }
  }
  prompt += `\n`;

  // ─── PROCESS (level-gated) ────────────────────────────────────────────────
  prompt += `## HOW TO PRODUCE THE OUTPUT
`;
  if (levelConfig.twoPassCritique) {
    prompt += `Because this is a ${level}-level rewrite, use a two-pass process:
**Pass 1 — Draft:** Write the full rewritten prompt using the structure above.
**Pass 2 — Self-critique:** Ask yourself: "Would a world-class prompt engineer approve this?" Check specifically for generic roles, vague objectives, and missing negative constraints. If any check fails, revise inline.
**Output:** Only the final revised prompt. No preamble, no labels, no "Here is the rewritten prompt:".

`;
  } else {
    prompt += `Write the rewritten prompt directly. No preamble, no "Here is your improved prompt:", no labels, no meta-commentary.

`;
  }

  // ─── ANTI-HALLUCINATION ───────────────────────────────────────────────────
  if (level !== "light") {
    prompt += `## ANTI-HALLUCINATION
- Do not invent APIs, library names, statistics, citations, or specific product features the user did not mention.
- If critical context is missing, inject a labeled assumption: "**Assumption:** [concrete fact]" inside the Context section.
- For research tasks, label claims: "**Established:** …" / "**Preliminary:** …" / "**Speculative:** …"

`;
  }

  // ─── PLATFORM-SPECIFIC FORMATTING ────────────────────────────────────────
  if (platform) {
    const platformHint = platform.includes("claude.ai")
      ? "This prompt will run on **Claude**. Prefer XML-style tags for structured sections: `<role>`, `<context>`, `<task>`, `<constraints>`, `<output_format>`. Claude parses these better than bare Markdown headers for complex instructions."
      : platform.includes("chatgpt.com") || platform.includes("openai.com")
      ? "This prompt will run on **ChatGPT/GPT-4**. Use Markdown headers (`##`) and bullet lists. Start with a clear role statement, then context, then the task. Avoid XML tags."
      : platform.includes("gemini")
      ? "This prompt will run on **Gemini**. Use clear `##` section headers. Gemini responds especially well to explicit step-by-step instructions and a clearly stated output schema."
      : `This prompt will be sent to **${platform}**. Use Markdown with clear headers and bullet lists.`;

    prompt += `## PLATFORM
${platformHint}

`;
  }

  // ─── FEW-SHOT EXAMPLES ───────────────────────────────────────────────────
  if (levelConfig.examplesToShow && levelConfig.examplesToShow.length > 0) {
    prompt += `## CALIBRATION EXAMPLES
Study these examples — pay attention not just to what sections exist, but to how precise and specific each line is. Generic version vs. what you should produce:

`;
    // We statically map examples to avoid bundler issues (Vite/Webpack dynamic import warnings)
    let loadedExamples: string[] = [];
    switch (mode) {
      case "business": loadedExamples = (await import("./examples/business")).examples; break;
      case "content-creator": loadedExamples = (await import("./examples/content-creator")).examples; break;
      case "designer": loadedExamples = (await import("./examples/designer")).examples; break;
      case "developer": loadedExamples = (await import("./examples/developer")).examples; break;
      case "marketing": loadedExamples = (await import("./examples/marketing")).examples; break;
      case "research": loadedExamples = (await import("./examples/research")).examples; break;
      case "startup-founder": loadedExamples = (await import("./examples/startup-founder")).examples; break;
      case "general":
      default:
        loadedExamples = (await import("./examples/general")).examples; break;
    }

    if (loadedExamples.length > 0) {
      prompt += levelConfig.examplesToShow
        .filter((i) => i < loadedExamples.length)
        .map((i) => loadedExamples[i])
        .join("\n\n");
      prompt += "\n\n";
    }
  }

  // ─── OUTPUT RULES ─────────────────────────────────────────────────────────
  prompt += `## OUTPUT RULES
- Output ONLY the final rewritten prompt. Nothing else.
- Valid Markdown (or XML tags where appropriate for the platform).
- No preamble. No "Here is your prompt:". No "I've rewritten this as:". No explanation.
- Fix every typo, spelling error, and grammatical mistake from the user's input — do not copy errors into the output.
- If the user's input is extremely short or vague, inject concrete, domain-appropriate assumptions. Label them explicitly. Do not produce a thin prompt.
`;

  return prompt;
}
