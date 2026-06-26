import { OptimizeRequest, PromptMode } from "@promptly/types";
import { MODE_RECIPES, STYLE_GUIDELINES } from "./modeRecipes";
import { contextLine, capitalize, stripPoliteness } from "./utils";

const LOCAL_ROLES: Record<PromptMode, string> = {
  auto: "an expert generalist. Calibrate your depth to the actual complexity of the task",
  general: "a senior generalist. Default to concrete, specific answers over hedged, qualified ones",
  developer: "an expert developer. Think in trade-offs, generate code according to the objective, and treat edge cases as first-class requirements",
  designer: "a Principal Product Designer. Anchor every recommendation in user goals and cognitive load, not just aesthetics",
  marketing: "a Growth Director. Tie every creative choice to a funnel stage and a measurable outcome",
  research: "a Research Lead. Distinguish established findings from preliminary claims and never invent citations",
  business: "a Strategy Director. Structure the analysis MECE and end with a clear recommendation",
  "content-creator": "a Senior Editor. Optimize for the reader's attention, retention, and emotional arc",
  "startup-founder": "a second-time founder. Cut scope ruthlessly and default to learning over building"
};

export function localOptimize(req: OptimizeRequest): string {
  const { text, mode, level, style, context, refinement, previousPrompt } = req;
  
  if (previousPrompt && refinement) {
    return `${previousPrompt}\n\n# Additional Instructions\n${refinement}`;
  }
  
  const trimmed = stripPoliteness(text.trim());
  const recipe = MODE_RECIPES[mode] || MODE_RECIPES.general;
  const styleGuide = STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral;
  const ctxLine = contextLine(context);
  const roleString = LOCAL_ROLES[mode] || LOCAL_ROLES.general;

  if (level === "Basic") {
    const parts = [`Act as ${roleString}.`];
    parts.push(`\n${capitalize(trimmed)}.`);
    if (ctxLine) parts.push(`\nContext: ${ctxLine}`);
    if (req.refinement) parts.push(`\nAdditional Instructions: ${req.refinement}`);
    return parts.join("\n");
  }

  const lines: string[] = [];
  lines.push(`# Role\nAct as ${roleString}.`);

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

  if (level === "Staff+" || level === "Research" || level === "Production Audit") {
    lines.push(`\n# Formatting`);
    lines.push(`- Use clear Markdown headings and bullet points.`);
    if (level === "Production Audit" || level === "Research") {
      lines.push(`\n# Critical Constraints`);
      lines.push(`- Avoid fluff and generic filler.`);
      lines.push(`- Perform a step-by-step analysis before providing the final answer.`);
    }
  }

  return lines.join("\n\n");
}
