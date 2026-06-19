import { OptimizeRequest } from "@promptly/types";
import { MODE_RECIPES, STYLE_GUIDELINES } from "./modeRecipes";
import { contextLine, capitalize, stripPoliteness } from "./utils";

export function localOptimize(req: OptimizeRequest): string {
  const { text, mode, level, style, context, refinement, previousPrompt } = req;
  
  if (previousPrompt && refinement) {
    return `${previousPrompt}\n\n# Additional Instructions\n${refinement}`;
  }
  
  const trimmed = stripPoliteness(text.trim());
  const recipe = MODE_RECIPES[mode] || MODE_RECIPES.general;
  const styleGuide = STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral;
  const ctxLine = contextLine(context);

  if (level === "light") {
    const parts = [`Act as ${recipe.persona}.`];
    parts.push(`\n${capitalize(trimmed)}.`);
    if (ctxLine) parts.push(`\nContext: ${ctxLine}`);
    if (req.refinement) parts.push(`\nAdditional Instructions: ${req.refinement}`);
    return parts.join("\n");
  }

  const lines: string[] = [];
  lines.push(`# Role\nAct as ${recipe.persona}.`);

  if (ctxLine) {
    lines.push(`\n# Context\n${ctxLine}`);
  }

  lines.push(`\n# Objective\n${capitalize(trimmed)}.`);

  if (req.refinement) {
    lines.push(`\n# Additional Instructions\n${req.refinement}`);
  }

  lines.push(`\n# Style & Tone\n${styleGuide}`);

  lines.push(`\n# Key Guidelines`);
  lines.push(`- Prioritize precision and clarity.`);
  if (mode === "developer") lines.push(`- Focus on modularity, complexity, and production-readiness.`);
  if (mode === "designer") lines.push(`- Prioritize UX, a11y, and user mental models.`);
  if (mode === "business") lines.push(`- Use MECE frameworks and ROI-driven logic.`);

  if (level === "aggressive" || level === "expert") {
    lines.push(`\n# Formatting`);
    lines.push(`- Use clear Markdown headings and bullet points.`);
    if (level === "expert") {
      lines.push(`\n# Critical Constraints`);
      lines.push(`- Avoid fluff and generic filler.`);
      lines.push(`- Perform a step-by-step analysis before providing the final answer.`);
    }
  }

  return lines.join("\n\n");
}
