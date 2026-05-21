import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── Price ID map ─────────────────────────────────────────────────────────────
// These are set in .env.local as STRIPE_PRICE_STANDARD and STRIPE_PRICE_ADVANCED.
// Create the Price objects in the Stripe dashboard, then paste the IDs here.
const PRICE_IDS: Record<string, string | undefined> = {
  standard: process.env.STRIPE_PRICE_STANDARD,
  advanced:  process.env.STRIPE_PRICE_ADVANCED,
}

export async function POST(req: Request) {
  try {
    const { tier } = await req.json() as { tier: string }

    // createClient() is async — must await
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tierKey = tier?.toLowerCase()

    // Enterprise tier uses a contact-sales flow — no Stripe checkout
    if (tierKey === 'enterprise') {
      return NextResponse.json(
        { redirect: 'mailto:sales@soltra.solar?subject=Enterprise%20Enquiry' },
        { status: 200 }
      )
    }

    const priceId = PRICE_IDS[tierKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `Invalid tier "${tier}". Valid options: standard, advanced, enterprise` },
        { status: 400 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&upgraded=1`,
      cancel_url:  `${siteUrl}/#purchase`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        tier:   tierKey,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[Checkout] Error creating session:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
