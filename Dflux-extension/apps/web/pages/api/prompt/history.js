import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const userId = req.headers["x-user-id"] // In real app, extract from JWT/session
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { page = 1, limit = 10 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [history, total] = await prisma.$transaction([
      prisma.promptHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.promptHistory.count({
        where: { userId }
      })
    ])

    return res.status(200).json({
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error("Error fetching prompt history:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
