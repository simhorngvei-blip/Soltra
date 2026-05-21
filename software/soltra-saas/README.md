# SOLTRA Solar — Autonomous Solar Tracking SaaS

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe)
![MQTT](https://img.shields.io/badge/HiveMQ-MQTT-660066)
![License](https://img.shields.io/badge/License-MIT-zinc)

SOLTRA is a cloud-based platform for monitoring and controlling autonomous dual-axis solar tracking hardware. Real-time telemetry from ESP32-based SOLTRA nodes is ingested via a secured REST API, stored in Supabase, and delivered to the browser through Supabase Realtime WebSockets. Motor control commands are dispatched server-side through a secured MQTT proxy, keeping broker credentials off the client entirely.

The platform supports two user tiers: **Homeowner** (single array monitoring) and **Fleet Admin** (multi-site, multi-node management). Subscriptions are managed via Stripe.

---

## Architecture

```
┌─────────────────────┐     MQTT (TLS)      ┌────────────────────┐
│  SOLTRA Node (ESP32)  │ ──────────────────▶ │   HiveMQ Cloud     │
└─────────────────────┘                      └────────────────────┘
          │                                           │
          │  POST /api/telemetry/ingest               │  (server-side only)
          │  Authorization: Bearer <KEY>              │
          ▼                                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js (Vercel · sin1)                        │
│  /api/telemetry/ingest  ──▶  Supabase (PostgreSQL)               │
│  /api/command           ──▶  HiveMQ (publishes on behalf of UI)  │
│  /api/checkout          ──▶  Stripe                              │
│  /api/webhooks/stripe   ◀──  Stripe (updates user tier in DB)    │
└──────────────────────────────────────────────────────────────────┘
          │
          │  Supabase Realtime (WebSocket)
          ▼
┌─────────────────────┐
│   Browser (User)    │
│  useTelemetryRealtime│
│  useFleetRealtime   │
└─────────────────────┘
```

---

## Prerequisites

- **Node.js** 20+  
- **npm** 9+  
- **Supabase account** (free tier works for development)  
- **HiveMQ Cloud account** (free tier includes 100 device connections)  
- **Stripe account** (test mode for development)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/soltra.git
cd soltra/software/soltra-saas

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and fill in the values (see Environment Variables below)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | ✅ |
| `HIVEMQ_HOST` | HiveMQ cluster hostname | ✅ |
| `HIVEMQ_PORT` | HiveMQ port (default: 8883) | ✅ |
| `HIVEMQ_USER` | HiveMQ username | ✅ |
| `HIVEMQ_PASS` | HiveMQ password | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key (server only) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | ✅ |
| `STRIPE_PRICE_STANDARD` | Stripe Price ID for Standard tier | ✅ |
| `STRIPE_PRICE_ADVANCED` | Stripe Price ID for Advanced tier | ✅ |
| `TELEMETRY_INGEST_KEY` | Shared secret for hardware → ingest API auth | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (`https://yourdomain.com`) | ✅ |

> ⚠️ **Security:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All secrets (MQTT credentials, Stripe secret key, service role key) must use server-only names.

---

## Supabase Setup

Run migrations in this exact order against your Supabase project (SQL Editor or `supabase db push`):

```bash
# 1. Core schema — tables, types, relationships
supabase/schema.sql

# 2. Row Level Security — RLS policies for all tables
supabase/phase2_rls.sql

# 3. Triggers — auto-create user profile on signup
supabase/phase2_trigger.sql

# 4. Phase 3 — indexes, Realtime, schema patches
supabase/phase3_fixes.sql
```

After running migrations:
1. Enable **Realtime** for the `telemetry` and `nodes` tables in Supabase Dashboard → Database → Replication
2. Enable **Row Level Security** on all tables (verify with the green RLS badge in the Table Editor)

---

## Stripe Setup

1. Create two Products in the Stripe Dashboard:
   - **SOLTRA Standard** — for residential homeowners
   - **SOLTRA Advanced / Fleet** — for commercial/fleet operators
2. For each product, create a one-time Price and copy the Price ID (starts with `price_`)
3. Add the Price IDs to `.env.local` as `STRIPE_PRICE_STANDARD` and `STRIPE_PRICE_ADVANCED`
4. Register a webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Hardware Integration

SOLTRA nodes POST telemetry to the ingest API every 5 seconds:

```bash
curl -X POST https://yourdomain.com/api/telemetry/ingest \
  -H "Authorization: Bearer <TELEMETRY_INGEST_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "node_mac":    "AA:BB:CC:DD:EE:FF",
    "wind_speed":  4.2,
    "solar_yield": 721,
    "panel_angle": 138.5,
    "tilt_angle":  22.0,
    "wind_alert":  false,
    "status":      "TRACKING"
  }'
```

The `node_mac` must match a registered node's `mac_address` in the `nodes` table. Register nodes via the onboarding wizard at `/dashboard/onboarding`.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full production deployment checklist.

**Quick Vercel deploy:**
1. Push to GitHub
2. Import into Vercel → set region to `sin1` (Singapore)
3. Add all environment variables in Vercel dashboard
4. Deploy

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push and open a Pull Request

---

## License

MIT © 2026 Helios Systems Sdn. Bhd.
