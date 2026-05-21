# SOLTRA Solar — Production Deployment Checklist

> Run through every checkbox before going live. Items marked 🔴 are hard blockers — the app will fail without them.

---

## Pre-Deployment Checklist

### Secrets & Credentials
- [ ] 🔴 `.env.local` copied from `.env.example` and all values filled in
- [ ] 🔴 All placeholder values replaced (no `your-project`, `replace-me`, etc.)
- [ ] 🔴 `.env.local` is listed in `.gitignore` — run `git status` to confirm it is NOT tracked
- [ ] 🔴 HiveMQ credentials rotated from any development values
- [ ] 🔴 `TELEMETRY_INGEST_KEY` set to a strong random string:
  ```bash
  openssl rand -hex 32
  ```

### Stripe
- [ ] 🔴 Stripe **Live mode** keys configured (not test `sk_test_` keys)
- [ ] 🔴 Two Stripe Products created (Standard + Advanced)
- [ ] 🔴 Price IDs added: `STRIPE_PRICE_STANDARD` and `STRIPE_PRICE_ADVANCED`
- [ ] 🔴 Webhook endpoint registered: `https://yourdomain.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.deleted`
- [ ] 🔴 `STRIPE_WEBHOOK_SECRET` set to `whsec_...` signing secret from Stripe dashboard

### Supabase
- [ ] 🔴 All 4 SQL migrations run in order:
  ```
  supabase/schema.sql
  supabase/phase2_rls.sql
  supabase/phase2_trigger.sql
  supabase/phase3_fixes.sql
  ```
- [ ] 🔴 RLS enabled on every table (verify in Supabase Dashboard → Table Editor)
- [ ] Supabase Realtime enabled for `telemetry` and `nodes` tables
- [ ] Auth → URL Configuration → Site URL set to your production domain
- [ ] Auth → Email Templates → Confirmation URL points to `https://yourdomain.com/auth/callback`
- [ ] Auth → Email Templates → Reset Password URL: `https://yourdomain.com/auth/callback?type=recovery`

### Environment
- [ ] 🔴 `NEXT_PUBLIC_SITE_URL` set to production domain (e.g. `https://soltra.solar`)
- [ ] No `NEXT_PUBLIC_` variable contains a secret (MQTT, Stripe secret, service role):
  ```bash
  # Run this check — should return EMPTY output:
  Get-Content .env.local | Select-String "NEXT_PUBLIC_" | Select-String -NotMatch "SUPABASE_URL|ANON_KEY|SITE_URL|STRIPE_PUBLISHABLE"
  ```

---

## Vercel Deployment Steps

1. Push code to GitHub (ensure `.env.local` is NOT committed)
2. Log into [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select the `soltra-saas` directory as the root (or configure the root directory in Vercel)
4. **Settings → Environment Variables**: Add every variable from `.env.example`
5. **Settings → General → Region**: Select `sin1` (Singapore) for Malaysia proximity
6. Click **Deploy**
7. Set up Custom Domain in **Settings → Domains**

---

## Supabase Migration Order

```sql
-- Step 1: Core schema
-- Run: supabase/schema.sql
-- Creates: users, sites, nodes, telemetry tables, enums

-- Step 2: RLS policies
-- Run: supabase/phase2_rls.sql
-- Enables: Row Level Security on all tables

-- Step 3: Triggers
-- Run: supabase/phase2_trigger.sql
-- Creates: handle_new_user trigger for auto-profile creation

-- Step 4: Indexes + Realtime + patches
-- Run: supabase/phase3_fixes.sql
-- Creates: performance indexes, enables Realtime, adds missing columns
```

---

## Post-Deployment Checklist

### Auth Flow
- [ ] Register a new account — verify confirmation email arrives
- [ ] Click confirmation link — verify redirect to `/dashboard/homeowner`
- [ ] Test password reset flow: Login page → Reset tab → enter email → receive email → set new password

### Onboarding Flow  
- [ ] Log in with fresh account (no sites) — verify redirect to `/dashboard/onboarding`
- [ ] Complete all 3 wizard steps (site name, MAC address, success screen)
- [ ] Verify site and node appear in Supabase → Table Editor

### Stripe Flow
- [ ] Click a plan on the landing page `/#purchase` section
- [ ] Complete checkout with Stripe test card: **4242 4242 4242 4242** (any future expiry, any CVC)
- [ ] Verify webhook received in Stripe Dashboard → Webhooks → Events
- [ ] Verify user's `subscription_tier` updated in Supabase → `users` table

### Telemetry Flow
- [ ] Send a test telemetry POST:
  ```bash
  curl -X POST https://yourdomain.com/api/telemetry/ingest \
    -H "Authorization: Bearer YOUR_TELEMETRY_INGEST_KEY" \
    -H "Content-Type: application/json" \
    -d '{"node_mac":"AA:BB:CC:DD:EE:FF","wind_speed":3.2,"solar_yield":650,"panel_angle":142,"wind_alert":false,"status":"TRACKING"}'
  ```
  Expected response: `{"ok":true}`
- [ ] Open the dashboard and verify telemetry appears within 5 seconds (Supabase Realtime)
- [ ] Verify the live chart updates with the data

### Motor Commands
- [ ] Issue a manual motor command from the dashboard
- [ ] Verify the MQTT message appears in HiveMQ Console → MQTT Clients → WebSocket

### Security
- [ ] Open browser DevTools → Network tab → check no request contains MQTT credentials
- [ ] Verify `/api/telemetry/ingest` returns 401 without the correct Authorization header:
  ```bash
  curl -X POST https://yourdomain.com/api/telemetry/ingest -d '{}' 
  # Expected: 401 Unauthorized
  ```

---

## Monitoring Setup

| Tool | Purpose | Cost |
|---|---|---|
| **Vercel Analytics** | Page views, performance | Free |
| **Supabase Dashboard** | DB usage, API calls, auth events | Free |
| **Stripe Dashboard** | Payment events, failed webhooks | Free |
| **HiveMQ Console** | Connection count, message rate | Free |

### Recommended alerts:
- Supabase: Set up email alert if DB usage exceeds 80% of free tier
- Vercel: Enable error alerting in Settings → Notifications
- Stripe: Enable failed payment webhook alerts

---

## Rollback Procedure

If a deployment causes issues:
```bash
# Vercel instant rollback via dashboard: Deployments → previous deployment → Promote
# Or via CLI:
vercel rollback
```

Database migrations cannot be automatically rolled back — maintain manual down-migration scripts for any destructive schema changes.
