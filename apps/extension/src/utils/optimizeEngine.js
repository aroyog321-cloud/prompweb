// Prompt optimization engine for Flux Prompt Optimizer Extension
// This is a simplified version - in production, this would be more sophisticated

export async function optimizePrompt(text, mode = "GENERAL", level = "MEDIUM", contextProfile = null) {
  // Validate inputs
  if (!text || typeof text !== "string") {
    throw new Error("Invalid prompt text")
  }

  // Trim the text
  let optimized = text.trim()

  // Add context if available
  if (contextProfile) {
    const contextParts = []
    if (contextProfile.companyName) contextParts.push(`Company: ${contextProfile.companyName}`)
    if (contextProfile.industry) contextParts.push(`Industry: ${contextProfile.industry}`)
    if (contextProfile.audience) contextParts.push(`Target Audience: ${contextProfile.audience}`)
    if (contextProfile.writingStyle) contextParts.push(`Writing Style: ${contextProfile.writingStyle}`)
    if (contextProfile.brandTone) contextParts.push(`Brand Tone: ${contextProfile.brandTone}`)

    if (contextParts.length > 0) {
      optimized = `Context: ${contextParts.join(", ")}\n\nTask: ${optimized}`
    }
  }

  // Add mode-specific instructions
  const modeInstructions = {
    GENERAL: "Provide a clear, well-structured prompt that achieves the user's goal.",
    DEVELOPER: "Create a technical prompt suitable for coding tasks, including specifications, constraints, and expected outputs.",
    DESIGNER: "Create a design-focused prompt that considers aesthetics, user experience, and design principles.",
    MARKETING: "Create a marketing-oriented prompt that focuses on audience engagement, benefits, and call-to-action.",
    RESEARCH: "Create a research-focused prompt that emphasizes accuracy, sources, and comprehensive analysis.",
    BUSINESS: "Create a business-focused prompt that considers strategy, ROI, and professional context.",
    CONTENT_CREATOR: "Create a content-focused prompt that considers engagement, platform specifics, and audience retention.",
    STARTUP_FOUNDER: "Create a founder-focused prompt that considers MVP, market validation, and growth strategies."
  }

  // Add level-specific instructions
  const levelInstructions = {
    LIGHT: "Provide a slightly enhanced version of the original prompt.",
    MEDIUM: "Provide a moderately enhanced prompt with added clarity and structure.",
    AGGRESSIVE: "Provide a significantly enhanced prompt with extensive detail and structure.",
    EXPERT: "Provide an expert-level prompt with comprehensive context, clear objectives, and professional formatting."
  }

  // Build the optimized prompt
  const parts = []

  if (modeInstructions[mode]) {
    parts.push(modeInstructions[mode])
  }

  if (levelInstructions[level]) {
    parts.push(levelInstructions[level])
  }

  parts.push(`Original request: ${text}`)

  // Join with double newlines for readability
  return parts.join("\n\n")
}