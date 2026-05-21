import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

// ─── Stripe Webhook Handler ───────────────────────────────────────────────────
// Stripe requires the raw body to verify the signature — do NOT parse as JSON.
// This route uses `createClient()` from the server-side Supabase helper (async).

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('Stripe-Signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe-Signature header' },
      { status: 400 }
    )
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  // createClient() is async — the missing await was a critical bug
  const supabase = await createClient()

  // ── Handle: Checkout session completed (one-time payment) ──────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, tier } = (session.metadata ?? {}) as { userId?: string; tier?: string }

    if (!userId || !tier) {
      console.error('[Stripe Webhook] Missing metadata on session:', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Map the Stripe "tier" metadata value to our DB enum values
    const subscriptionTier = tier === 'advanced' ? 'pro' : 'free'
    const userRole          = tier === 'advanced' ? 'fleet_admin' : 'homeowner'

    const { error } = await supabase
      .from('users')
      .update({
        subscription_tier:  subscriptionTier,
        role:               userRole,
        stripe_customer_id: session.customer as string ?? null,
      })
      .eq('id', userId)

    if (error) {
      console.error('[Stripe Webhook] DB update failed for user', userId, error)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    console.log(`[Stripe Webhook] User ${userId} upgraded → tier:${subscriptionTier} role:${userRole}`)
  }

  // ── Handle: Subscription cancelled (downgrade back to free) ───────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId    = subscription.customer as string

    const { error } = await supabase
      .from('users')
      .update({ subscription_tier: 'free', role: 'homeowner' })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('[Stripe Webhook] Subscription downgrade failed for customer', customerId, error)
    } else {
      console.log(`[Stripe Webhook] Customer ${customerId} downgraded to free`)
    }
  }

  return NextResponse.json({ received: true })
}
