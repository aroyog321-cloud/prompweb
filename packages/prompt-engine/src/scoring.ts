import { RewriteLevel } from "@promptly/types";

export interface PromptScore {
  score: number; // 0 to 100
  feedback: string[];
}

export function scorePrompt(promptText: string, level: RewriteLevel): PromptScore {
  let score = 50; // base score
  const feedback: string[] = [];
  const lowerPrompt = promptText.toLowerCase();

  // 1. Check for role
  if (lowerPrompt.includes('you are') || lowerPrompt.includes('act as') || lowerPrompt.includes('role:')) {
    score += 10;
  } else {
    feedback.push("Consider defining a specific persona or role for the AI.");
  }

  // 2. Check for structure
  if (promptText.includes('##') || promptText.includes('**')) {
    score += 10;
  } else {
    feedback.push("Use markdown formatting (like headers and bold text) to structure the prompt.");
  }

  // 3. Check for constraints
  if (lowerPrompt.includes('do not') || lowerPrompt.includes('never') || lowerPrompt.includes('must not')) {
    score += 15;
  } else {
    feedback.push("Add negative constraints (e.g., 'Do NOT...') to prevent common AI mistakes.");
  }

  // 4. Check for length/specificity (proxy for detail)
  const wordCount = promptText.split(/\s+/).length;
  if (wordCount > 100) {
    score += 15;
  } else if (wordCount < 30) {
    score -= 10;
    feedback.push("The prompt is very short. Add more context to guide the AI.");
  }

  // Level-specific checks
  if (level === 'aggressive' || level === 'expert') {
    if (!lowerPrompt.includes('format') && !lowerPrompt.includes('output')) {
      score -= 10;
      feedback.push("For advanced prompts, explicitly define the desired output format.");
    } else {
      score += 10;
    }
  }

  // Cap score
  score = Math.min(Math.max(score, 0), 100);

  // If perfect, add a praise
  if (score >= 90 && feedback.length === 0) {
    feedback.push("Excellent prompt structure and constraints!");
  }

  return { score, feedback };
}
