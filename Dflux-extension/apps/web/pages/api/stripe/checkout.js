import Stripe from "stripe"
import { PrismaClient } from "@prisma/client"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
})
const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { priceId, userId } = req.body

    if (!priceId || !userId) {
      return res.status(400).json({ error: "Price ID and User ID are required" })
    }

    // Get user to check if they already have a subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId: userId }
    })

    let customerId
    if (existingSubscription && existingSubscription.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        metadata: {
          userId: userId
        }
      })
      customerId = customer.id
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        userId: userId
      }
    })

    return res.status(200).json({ id: session.id })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
