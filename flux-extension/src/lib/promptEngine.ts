import { ContextProfile, OptimizeRequest, OptimizeResponse, PromptMode, RewriteLevel } from "./types";

const MODE_LENS: Record<PromptMode, string> = {
  general: "a knowledgeable generalist assistant",
  developer: "a senior software engineer focused on clean, production-ready code",
  designer: "a senior product designer focused on usability and visual craft",
  marketing: "a growth marketer focused on messaging, channels, and conversion",
  research: "a meticulous researcher who cites reasoning and surfaces trade-offs",
  business: "a strategy consultant focused on practical, decision-ready output",
  "content-creator": "a content strategist focused on hooks, structure, and engagement",
  "startup-founder": "a founder operating with limited time and resources, focused on shipping"
};

const LEVEL_CONFIG: Record<RewriteLevel, { instructions: string[]; addSections: boolean }> = {
  light: {
    instructions: ["Keep the original phrasing largely intact.", "Fix ambiguity and add one sentence of missing context if needed."],
    addSections: false
  },
  medium: {
    instructions: [
      "Clarify the goal in one sentence.",
      "Add relevant context the model needs.",
      "List 2-4 concrete requirements."
    ],
    addSections: true
  },
  aggressive: {
    instructions: [
      "Restate the goal clearly.",
      "Add relevant context and assumptions.",
      "Break the task into a structured list of requirements.",
      "Specify the desired output format."
    ],
    addSections: true
  },
  expert: {
    instructions: [
      "Restate the goal clearly and add success criteria.",
      "Add relevant context, assumptions, and constraints.",
      "Break the task into a structured list of requirements.",
      "Specify the desired output format, tone, and length.",
      "Call out edge cases or things to avoid."
    ],
    addSections: true
  }
};

/**
 * Builds a highly effective system prompt for the AI to act as a prompt engineer.
 */
function buildAdvancedSystemPrompt(req: OptimizeRequest): string {
  const { mode, level, context } = req;
  const level_cfg = LEVEL_CONFIG[level];
  const persona = MODE_LENS[mode];

  const lines = [
    `You are an elite AI Prompt Engineer. Your job is to rewrite the user's short, vague input into a world-class, highly structured prompt.`,
    `Do NOT answer the user's prompt. Your output must be ONLY the rewritten prompt itself, ready for the user to copy-paste into another AI.`,
    `\n## Target Persona for the Rewritten Prompt`,
    `The rewritten prompt should command the LLM to act as: ${persona}.`,
  ];

  const ctxLine = contextLine(context);
  if (ctxLine) {
    lines.push(`\n## Business Context (Inject this into the rewritten prompt)`);
    lines.push(ctxLine);
  }

  lines.push(`\n## Optimization Rules (${level} level)`);
  for (const instruction of level_cfg.instructions) {
    lines.push(`- ${instruction}`);
  }

  if (level_cfg.addSections) {
    lines.push(`\n## Output Structure`);
    lines.push(`Your rewritten prompt MUST use Markdown with clear headings (e.g. # Role, # Context, # Task, # Rules).`);
  }

  lines.push(`\nOutput ONLY the rewritten prompt. No introductions, no quotes, no explanations. Make it next-level.`);

  return lines.join("\n");
}

/**
 * Calls the Flux backend optimization API or a direct OpenAI endpoint.
 */
export async function optimizePrompt(
  req: OptimizeRequest,
  config: { apiBaseUrl?: string; apiKey?: string }
): Promise<OptimizeResponse> {
  if (config.apiBaseUrl && config.apiKey) {
    try {
      let endpoint = `${config.apiBaseUrl.replace(/\/$/, "")}/api/optimize`;
      let payload: any = {
        ...req,
        systemPrompt: buildAdvancedSystemPrompt(req)
      };

      // Smart detection for direct OpenAI/Ollama endpoints
      const isDirectAI = config.apiBaseUrl.includes('/chat/completions') || config.apiBaseUrl.includes('/v1');
      if (isDirectAI) {
        endpoint = config.apiBaseUrl.endsWith('/chat/completions') 
          ? config.apiBaseUrl 
          : `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
          
        payload = {
          model: "gpt-4o", // fallback default
          messages: [
            { role: "system", content: buildAdvancedSystemPrompt(req) },
            { role: "user", content: `Please rewrite this prompt:\n\n${req.text}` }
          ],
          temperature: 0.7
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      
      // Handle OpenAI format response
      if (data.choices && data.choices[0]?.message?.content) {
        return { optimized: data.choices[0].message.content.trim(), source: "api" };
      }

      // Handle custom backend response
      if (typeof data.optimized === "string" && data.optimized.trim()) {
        return { optimized: data.optimized.trim(), source: "api" };
      }
      
      throw new Error("Malformed API response");
    } catch (e) {
      // fall through to local pipeline
      console.warn("API Optimization failed, falling back to local template", e);
    }
  }
  return { optimized: localOptimize(req), source: "local-fallback" };
}

/**
 * Local template generator when API is unavailable.
 * Generates a high-quality structured prompt directly.
 */
function localOptimize(req: OptimizeRequest): string {
  const { text, mode, level, context } = req;
  const trimmed = text.trim();
  const persona = MODE_LENS[mode];
  const ctxLine = contextLine(context);

  if (level === "light") {
    return [
      `Act as ${persona}.`,
      ctxLine ? `Context: ${ctxLine}` : null,
      `Task: ${capitalize(trimmed)}.`,
      "Be clear and specific in your response."
    ].filter(Boolean).join("\n");
  }

  const lines: string[] = [];
  lines.push(`## Role\nAct as ${persona}. You are an expert in your field with deep knowledge and analytical skills.`);
  
  if (ctxLine) {
    lines.push(`\n## Background Context\n${ctxLine}`);
  }

  lines.push(`\n## Core Objective\n${capitalize(trimmed)}.`);

  if (level === "medium" || level === "aggressive" || level === "expert") {
    lines.push(`\n## Key Guidelines`);
    lines.push(`- Analyze the request carefully before executing.`);
    lines.push(`- Prioritize clarity, accuracy, and depth in your response.`);
    if (mode === "developer") {
       lines.push(`- Provide clean, well-commented, and production-ready code.`);
       lines.push(`- Discuss edge cases and performance implications.`);
    } else if (mode === "designer") {
       lines.push(`- Focus on user experience, accessibility, and modern design principles.`);
    } else if (mode === "marketing") {
       lines.push(`- Keep the tone engaging, persuasive, and tailored to the target audience.`);
    } else if (mode === "content-creator") {
       lines.push(`- Ensure the pacing is engaging and the hook is strong.`);
    }
  }

  if (level === "aggressive" || level === "expert") {
    lines.push(`\n## Formatting Requirements`);
    lines.push(`- Use Markdown with clear headings and bullet points where appropriate.`);
    lines.push(`- Structure the response logically so it is easy to skim.`);
  }

  if (level === "expert") {
    lines.push(`\n## Critical Constraints`);
    lines.push(`- Do NOT output fluff or generic filler.`);
    lines.push(`- If any constraints contradict each other, pause and state the contradiction.`);
    lines.push(`- Base your answers on best practices and state any assumptions explicitly.`);
  }

  return lines.join("\n");
}

function contextLine(context?: ContextProfile): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.companyName) parts.push(`The company is ${context.companyName}`);
  if (context.industry) parts.push(`operating in the ${context.industry} industry`);
  if (context.audience) parts.push(`targeting ${context.audience}`);
  if (context.brandTone) parts.push(`with a ${context.brandTone} brand tone`);
  if (context.writingStyle) parts.push(`and a ${context.writingStyle} writing style`);
  if (context.websiteUrl) parts.push(`(website: ${context.websiteUrl})`);
  if (!parts.length) return "";
  return parts.join(", ") + ".";
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
