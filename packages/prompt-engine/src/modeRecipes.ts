import type { PromptMode, PromptStyle } from "@promptly/types";

/**
 * Per-mode structural recipe. The system prompt asks the LLM to pick the
 * shape from this list (filtered by mode) AND adapt it to the classified task
 * type. The persona + structural recipe together produce visibly different
 * rewrites per mode — no more "a generalist assistant" for everything.
 */
export interface ModeRecipe {
  /** Long, specific persona with concrete skills and focus areas. */
  persona: string;
  /** Short hint about what this mode is for (used in the system prompt). */
  taskHint: string;
  /** Section shape the rewritten prompt should follow. */
  structuralShape: string[];
}

export const MODE_RECIPES: Record<PromptMode, ModeRecipe> = {
  auto: {
    persona:
      "an expert generalist assistant who tailors their expertise to the specific task, asks sharp clarifying questions when needed, and produces clear, actionable output",
    taskHint: "auto-detect task (adapt the structure to fit the task type)",
    structuralShape: [
      "Role",
      "Context",
      "Objective",
      "Key Constraints",
      "Output Format"
    ]
  },
  general: {
    persona:
      "an expert generalist assistant who tailors their expertise to the specific task, asks sharp clarifying questions when needed, and produces clear, actionable output",
    taskHint: "general purpose task (adapt the structure to fit the task type)",
    structuralShape: [
      "Role",
      "Context",
      "Objective",
      "Style & Tone",
      "Audience",
      "Constraints",
      "Output Format",
      "Success Criteria",
    ],
  },
  developer: {
    persona:
      "a Principal Software Engineer with deep expertise in software design, time/space complexity, security, and production-readiness. They write code that handles edge cases, ships with tests, and respects the project's existing conventions",
    taskHint: "code or technical implementation",
    structuralShape: [
      "Role",
      "Context (stack, environment, constraints, target users)",
      "Task",
      "Input / Output Specification",
      "Functional Requirements",
      "Non-Functional Requirements (perf, security, accessibility)",
      "Acceptance Criteria",
      "Edge Cases",
    ],
  },
  designer: {
    persona:
      "a Senior Product Designer focused on cognitive load, accessibility (WCAG 2.1 AA minimum), user mental models, visual hierarchy, and design systems. They think in flows, not screens, and ground every choice in user evidence",
    taskHint: "design or UX task",
    structuralShape: [
      "Role",
      "User & Context",
      "Problem to Solve",
      "Design Principles",
      "Deliverables",
      "Format & Specs",
      "Constraints & Anti-patterns",
      "Success Metrics",
    ],
  },
  marketing: {
    persona:
      "a Growth Strategist who specializes in psychological triggers, positioning, funnel mechanics, channel-channel fit, and conversion-oriented messaging. They think in terms of audience-stage-fit, not generic 'good copy'",
    taskHint: "marketing or messaging task",
    structuralShape: [
      "Role",
      "Brand & Product Context",
      "Audience & Funnel Stage",
      "Objective (awareness / consideration / conversion / retention)",
      "Channel",
      "Message Constraints",
      "Output Format",
      "Success Metrics",
    ],
  },
  research: {
    persona:
      "a Meticulous Researcher who reasons from first principles, surfaces evidence, distinguishes established findings from preliminary claims, and never invents citations. They explicitly flag uncertainty",
    taskHint: "research or analysis task",
    structuralShape: [
      "Role",
      "Research Question",
      "Scope (in / out)",
      "Required Sources & Reasoning Depth",
      "Method / Framework",
      "Output Structure",
      "Confidence & Uncertainty Handling",
    ],
  },
  business: {
    persona:
      "a Strategy Consultant who uses MECE frameworks, ROI-driven logic, and decision-ready executive summaries. They always end with a clear recommendation and the trade-offs they rejected",
    taskHint: "business or strategy task",
    structuralShape: [
      "Role",
      "Business Context",
      "Decision to Make",
      "Framework (MECE, 2x2, Porter, etc.)",
      "Analysis Required",
      "Trade-offs Considered",
      "Recommendation",
      "Output Format",
    ],
  },
  "content-creator": {
    persona:
      "a Master Storyteller who writes hooks that earn attention, paces content for retention, and adapts voice to platform. They think in terms of the reader's emotional arc, not just information transfer",
    taskHint: "writing or content task",
    structuralShape: [
      "Role",
      "Audience",
      "Voice & Tone",
      "Topic & Angle",
      "Structure (hook → body → close)",
      "Constraints (length, clichés to avoid)",
      "Output Format",
      "Success Criteria",
    ],
  },
  "startup-founder": {
    persona:
      "an Agile Founder who optimizes for the critical path to MVP, resource efficiency, and rapid market validation. They cut scope ruthlessly and prefer learning rate over feature count",
    taskHint: "founder-scope or MVP task",
    structuralShape: [
      "Role",
      "MVP Scope (in / out)",
      "User & Problem",
      "Critical Path",
      "Time & Resource Budget",
      "Validation Criteria",
      "Risks & Mitigations",
      "Output Format",
    ],
  },
};

/**
 * Per-style guideline, injected into the Style & Tone section.
 */
export const STYLE_GUIDELINES: Record<PromptStyle, string> = {
  neutral: "Balanced and objective tone. Do not favor one side. Use passive voice where appropriate. Present facts without emotional coloring.",
  formal: "Professional, structured, and authoritative tone. Use advanced vocabulary. Avoid contractions and slang. Structure with clear headings.",
  conversational: "Natural, engaging, and helpful. Use first-person/second-person ('I', 'you'). Break paragraphs up for readability. Explain reasoning.",
  academic: "Scholarly, rigorous tone. Use precise terminology, formal structure, and logical flow. Avoid subjective language.",
  creative: "Imaginative, expressive tone. Use descriptive language, analogies, and metaphors. Emphasize storytelling and emotional resonance.",
  direct: "Minimalist, high-density, zero fluff. Get straight to the point. No conversational fillers. Use lists and bold text for scannability. Output ONLY what is requested.",
};
