import Stripe from 'stripe'

// ─── Stripe Client ────────────────────────────────────────────────────────────
// Throws at startup if the secret key is not set, preventing silent failures
// in production where payment requests would fail at runtime.

if (!process.env.STRIPE_SECRET_KEY) {
  // Only throw in production — dev may run without Stripe configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Stripe] STRIPE_SECRET_KEY is not set. ' +
      'Add it to your environment variables before deploying.'
    )
  }
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  // Pinned to a stable API version. Update after testing with the new version.
  apiVersion: '2026-04-22.dahlia',
  appInfo: {
    name: 'SOLTRA Solar',
    version: '1.0.0',
    url: 'https://soltra.solar',
  },
  typescript: true,
})
