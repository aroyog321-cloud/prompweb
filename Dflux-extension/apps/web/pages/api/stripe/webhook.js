import Stripe from "stripe"
import { PrismaClient } from "@prisma/client"
import { buffer } from "micro"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
})
const prisma = new PrismaClient()

// Stripe requires the raw body to verify the webhook signature
export const config = {
  api: {
    bodyParser: false,
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const buf = await buffer(req)
  const sig = req.headers["stripe-signature"]

  let event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed.`, err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const checkoutSession = event.data.object
      await handleCheckoutSessionCompleted(checkoutSession)
      break
    case "invoice.payment_succeeded":
      const invoice = event.data.object
      await handleInvoicePaymentSucceeded(invoice)
      break
    case "customer.subscription.deleted":
      const subscription = event.data.object
      await handleSubscriptionDeleted(subscription)
      break
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true })
}

async function handleCheckoutSessionCompleted(session) {
  const customerId = session.customer
  const subscriptionId = session.subscription
  const userId = session.metadata.userId
  const tier = session.metadata.tier

  if (!userId || !tier) {
    console.error("Missing metadata in checkout session")
    return
  }

  // Update user's subscription
  await prisma.subscription.upsert({
    where: { userId: userId },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      tier: tier as any,
      currentPeriodEnd: new Date(session.current_period_end * 1000),
    },
    create: {
      userId: userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      tier: tier as any,
      currentPeriodEnd: new Date(session.current_period_end * 1000),
    }
  })

  // Log usage
  await prisma.usageLog.create({
    data: {
      userId: userId,
      actionType: "subscription_created",
      metadata: {
        tier: tier,
        stripeSubscriptionId: subscriptionId
      }
    }
  })
}

async function handleInvoicePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId }
  })

  if (subscription) {
    // Update subscription period end
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodEnd: new Date(invoice.lines.data[0].period.end * 1000),
      }
    })
  }
}

async function handleSubscriptionDeleted(subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  })

  if (sub) {
    // Downgrade to free tier
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        tier: "FREE",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      }
    })

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: sub.userId,
        actionType: "subscription_cancelled",
        metadata: {
          stripeSubscriptionId: subscription.id
        }
      }
    })
  }
}
