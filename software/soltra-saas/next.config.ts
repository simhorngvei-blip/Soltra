import type { NextConfig } from 'next'

// ─── Content Security Policy ──────────────────────────────────────────────────
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://app.spline.design;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https:;
  connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.open-meteo.com https://*.spline.design;
  frame-src https://js.stripe.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`

const securityHeaders = [
  // Preconnect DNS for performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Force HTTPS for 2 years
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer information
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  // Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // CSP — allows Supabase Realtime, Stripe, Google Fonts, Spline
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // Ensure Stripe and other server-only packages don't bundle to client
  serverExternalPackages: ['mqtt'],
}

export default nextConfig
