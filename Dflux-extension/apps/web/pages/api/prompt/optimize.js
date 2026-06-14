import { PrismaClient } from "@prisma/client"
import { z } from "zod"

const prisma = new PrismaClient()

// Validation schema for prompt optimization request
const optimizePromptSchema = z.object({
  text: z.string().min(1, "Prompt text is required"),
  mode: z.enum([
    "GENERAL",
    "DEVELOPER",
    "DESIGNER",
    "MARKETING",
    "RESEARCH",
    "BUSINESS",
    "CONTENT_CREATOR",
    "STARTUP_FOUNDER"
  ]).optional(),
  level: z.enum([
    "LIGHT",
    "MEDIUM",
    "AGGRESSIVE",
    "EXPERT"
  ]).optional(),
  contextProfileId: z.string().optional()
})

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Validate request body
    const validatedData = optimizePromptSchema.parse(req.body)
    
    // Get user from session (in real app, you'd use getServerSession)
    // For now, we'll assume user is authenticated via middleware
    const userId = req.headers["x-user-id"] // In real app, extract from JWT or session
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    // Get user's context profile if provided
    let contextProfile = null
    if (validatedData.contextProfileId) {
      contextProfile = await prisma.contextProfile.findFirst({
        where: {
          id: validatedData.contextProfileId,
          userId: userId
        }
      })
      
      if (!contextProfile) {
        return res.status(400).json({ error: "Invalid context profile" })
      }
    }

    // In a real implementation, you would call your prompt optimization engine here
    // For now, we'll simulate a basic optimization
    const optimizedPrompt = await optimizePrompt(
      validatedData.text,
      validatedData.mode || "GENERAL",
      validatedData.level || "MEDIUM",
      contextProfile
    )

    // Save to history
    const historyEntry = await prisma.promptHistory.create({
      data: {
        userId: userId,
        originalPrompt: validatedData.text,
        optimizedPrompt: optimizedPrompt,
        platformUsed: "unknown", // Would be determined from extension
        promptMode: validatedData.mode,
        rewriteLevel: validatedData.level,
        tokensUsed: Math.ceil(optimizedPrompt.split(" ").length * 1.3), // Rough estimate
      }
    })

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: userId,
        actionType: "prompt_optimization",
        tokensConsumed: historyEntry.tokensUsed,
        metadata: {
          mode: validatedData.mode,
          level: validatedData.level,
          platform: "unknown"
        }
      }
    })

    return res.status(200).json({
      optimizedPrompt: optimizedPrompt,
      historyId: historyEntry.id
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    console.error("Prompt optimization error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

// Simulated prompt optimization function
// In a real app, this would call your optimization engine or an AI service
async function optimizePrompt(text, mode, level, contextProfile) {
  // This is a simplified version - in reality, you'd use sophisticated prompt engineering
  let optimized = text
  
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
  let parts = []
  
  if (modeInstructions[mode]) {
    parts.push(modeInstructions[mode])
  }
  
  if (levelInstructions[level]) {
    parts.push(levelInstructions[level])
  }
  
  parts.push(`Original request: ${text}`)
  
  // In a real implementation, you would use more sophisticated techniques
  // such as few-shot prompting, chain-of-thought, etc.
  
  return parts.join("\n\n")
}
