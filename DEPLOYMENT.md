# Soltra — Production Deployment Guide

> **Target:** Zero-cost cloud deployment on Vercel + Supabase Cloud + HiveMQ + Cloudflare Tunnel  
> **Time:** ~30 minutes on first deploy, ~5 minutes on subsequent deploys

---

## Prerequisites

Install these once on your machine:

```powershell
# Node.js (includes npm and npx)
# Download from: https://nodejs.org  (LTS version)

# Supabase CLI
npm install -g supabase

# Vercel CLI
npm install -g vercel

# Cloudflare Tunnel binary (for TTS)
winget install --id Cloudflare.cloudflared
```

Verify:
```powershell
supabase --version   # should print 1.x.x or higher
vercel --version     # should print 40.x.x or higher
cloudflared version  # should print cloudflared 2024.x.x or higher
```

---

## Step 1 — Push Schema to Production Supabase

### 1.1 Create your production Supabase project
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project** → name it `soltra-prod` → choose your region
3. Wait ~2 minutes for the project to initialise

### 1.2 Get your project credentials
```
Project URL:         Settings → API → Project URL
Anon key:            Settings → API → anon / public
Service role key:    Settings → API → service_role (keep private)
Project ref:         Settings → General → Reference ID  (looks like: abcdefghijklmnop)
```

### 1.3 Push master_schema.sql

**Option A — Supabase CLI (recommended):**
```powershell
# Authenticate with Supabase
supabase login

# Link to your production project (replace YOUR-PROJECT-REF)
cd D:\Soltra\software\soltra-saas
supabase link --project-ref YOUR-PROJECT-REF

# Push the master schema
supabase db push --db-url "postgresql://postgres:YOUR-DB-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres"
```

> **Note:** Your DB password was set when you created the project. Reset it at:  
> Supabase Dashboard → Settings → Database → Database Password → Reset

**Option B — SQL Editor (no CLI required):**
1. Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Open `D:\Soltra\software\soltra-saas\supabase\master_schema.sql` in a text editor
4. Copy the entire contents → paste into SQL Editor → click **Run**

### 1.4 Verify
```powershell
# Confirm tables were created (CLI option)
supabase db remote commit --dry-run
```

Or in SQL Editor:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Should return: users, sites, nodes, telemetry
```

### 1.5 Enable Realtime (if not already on)
In Supabase Dashboard → **Database → Replication → Realtime**:
- Enable for: `telemetry` ✓
- Enable for: `nodes` ✓

---

## Step 2 — Deploy soltra-saas to Vercel

### 2.1 First-time setup
```powershell
cd D:\Soltra\software\soltra-saas

# Login to Vercel
vercel login

# Deploy (follow prompts — link to your Vercel account/team)
vercel --prod
```

Vercel will ask:
- **Set up and deploy?** → `Y`
- **Which scope?** → your personal account or team
- **Link to existing project?** → `N` (first time)
- **Project name?** → `soltra-saas` (or `soltra-green`)
- **Root directory?** → `.` (current folder — already inside soltra-saas)

### 2.2 Set production environment variables
After first deploy, go to **Vercel Dashboard → soltra-saas → Settings → Environment Variables**  
Add each variable from `software/soltra-saas/.env.production.example`:

```powershell
# OR use the CLI to bulk-add env vars (run from soltra-saas folder):
# Create a temp file with production values first, then:

vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste value when prompted, press Enter

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add HIVEMQ_HOST production
vercel env add HIVEMQ_PORT production
vercel env add HIVEMQ_USER production
vercel env add HIVEMQ_PASS production
vercel env add NEXT_PUBLIC_HIVEMQ_HOST production
vercel env add NEXT_PUBLIC_HIVEMQ_PORT production
vercel env add NEXT_PUBLIC_HIVEMQ_USER production
vercel env add NEXT_PUBLIC_HIVEMQ_PASS production
vercel env add TELEMETRY_INGEST_KEY production
vercel env add TTS_URL production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_PRICE_STANDARD production
vercel env add STRIPE_PRICE_ADVANCED production
vercel env add NEXT_PUBLIC_SITE_URL production
```

### 2.3 Redeploy with environment variables
```powershell
vercel --prod
```

### 2.4 Verify deployment
```
https://your-project.vercel.app/api/health   # Should return 200
https://your-project.vercel.app              # Should load the SaaS homepage
```

### 2.5 Set up Stripe webhook (production)
1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://your-project.vercel.app/api/webhooks`
3. Events to listen: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the **Signing secret** → update `STRIPE_WEBHOOK_SECRET` in Vercel env vars → redeploy

---

## Step 3 — Deploy soltra-dashboard to Vercel

The dashboard is a separate Vercel project pointing to the same repo.

```powershell
cd D:\Soltra\software\soltra-dashboard

# Deploy as a new project
vercel --prod
```

When prompted:
- **Project name?** → `soltra-overseer`
- **Root directory?** → `.` (already inside soltra-dashboard)
- **Build command?** → `npm run build` (Vite)
- **Output directory?** → `dist`

### 3.1 Set environment variables for dashboard
```powershell
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_HIVEMQ_HOST production
vercel env add VITE_HIVEMQ_PORT production
vercel env add VITE_HIVEMQ_USER production
vercel env add VITE_HIVEMQ_PASS production
vercel env add VITE_TTS_URL production
vercel env add VITE_CAMERA_STREAM_URL production
```

> All `VITE_*` values match `software/soltra-dashboard/.env.production`.

### 3.2 Redeploy
```powershell
vercel --prod
```

### 3.3 Verify
```
https://soltra-overseer.vercel.app   # Should load the 3D dashboard
```

---

## Step 4 — Start TTS Server with Cloudflare Tunnel

The TTS server runs on your local machine and is made publicly accessible via Cloudflare Tunnel. Run this every time you want voice to work in production.

### 4.1 Start the TTS server
```powershell
cd D:\Soltra\software\soltra-tts

# Activate virtual environment (if using one)
.\.venv\Scripts\Activate.ps1

# Start the server
python server.py
```

Wait for:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8099
```

### 4.2 Start the Cloudflare Tunnel (in a new PowerShell window)
```powershell
cloudflared tunnel --url http://localhost:8099
```

Cloudflare will print output like:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

### 4.3 Update TTS_URL in Vercel
```powershell
cd D:\Soltra\software\soltra-saas

# Remove old value and set new tunnel URL
vercel env rm TTS_URL production
vercel env add TTS_URL production
# Paste: https://random-words-here.trycloudflare.com

# Redeploy to pick up the new URL
vercel --prod
```

> **Note:** The `trycloudflare.com` URL changes on every tunnel restart. For a stable URL:
> - Create a named tunnel: `cloudflared tunnel create soltra-tts`
> - Costs $0 on Cloudflare free plan with your own domain

### 4.4 Verify TTS is reachable
```powershell
# Replace with your actual tunnel URL
Invoke-WebRequest -Uri "https://random-words-here.trycloudflare.com/health"
# Should return: {"status":"healthy","kokoro_loaded":true,"chatterbox_loaded":false}
```

---

## Step 5 — Verify Full Production Stack

Run this checklist after every deployment:

```powershell
# SaaS homepage
Invoke-WebRequest -Uri "https://your-project.vercel.app" -Method HEAD

# Telemetry ingest (replace YOUR_INGEST_KEY)
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/telemetry/ingest" `
  -Method POST `
  -Headers @{"Authorization" = "Bearer YOUR_INGEST_KEY"; "Content-Type" = "application/json"} `
  -Body '{"node_mac":"TEST:00:00:00:00:00","wind_speed":5.0}'
# Should return: {"error":"Node not found for MAC: TEST:00:00:00:00:00"} (404 — that's correct, node not registered)

# TTS health
Invoke-WebRequest -Uri "https://your-tunnel.trycloudflare.com/health"
# Should return: {"status":"healthy"}

# Dashboard
Invoke-WebRequest -Uri "https://soltra-overseer.vercel.app" -Method HEAD
```

---

## Step 6 — Subsequent Deployments

After making code changes:

```powershell
# Deploy SaaS
cd D:\Soltra\software\soltra-saas
git add . && git commit -m "feat: your change description"
vercel --prod

# Deploy Dashboard
cd D:\Soltra\software\soltra-dashboard
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deploys on every push to `main`.

---

## Console Summary — All Running Services

```
┌────────────────────────────────────────────────────────────────────┐
│  SERVICE              ENV A (LOCAL)           ENV B (PRODUCTION)   │
├────────────────────────────────────────────────────────────────────┤
│  SaaS (Next.js)       localhost:3000          your.vercel.app      │
│  Dashboard (Vite)     localhost:5174          overseer.vercel.app  │
│  HUD (Vite)           localhost:5173          (local only)         │
│  TTS Server           localhost:8099          CF Tunnel URL        │
│  Supabase             localhost:54323         supabase.co          │
│  MQTT (HiveMQ)        hivemq.cloud:8883/8884  hivemq.cloud (same) │
└────────────────────────────────────────────────────────────────────┘

Monthly cost: $0.00  (all free tiers)
```

---

## Rollback

```powershell
# List all Vercel deployments
vercel ls

# Roll back to a previous deployment
vercel rollback [deployment-url]
```

---

## Step 7 — Flash Hardware Firmware with Production Endpoints

The only firmware file that needs an environment change is the **Master Hub**.  
The motor controller, sensor nodes, and camera node are ESP-NOW only — no URLs in them.

### 7.1 Flash order (follow this sequence)

```
1. Motor Controller  → note its MAC → no URL config needed
2. Master Hub        → paste Motor MAC + set ENV to PRODUCTION → flash
3. Sensor Nodes ×4   → change NODE_ID (1–4) each → no URL config needed
4. Camera Node       → paste Hub MAC → no URL config needed
```

### 7.2 Configure Master Hub for PRODUCTION

Open `hardware/soltra-master-hub/soltra_master_hub.ino` in Arduino IDE.

At the **very top** of the file, you will see the config panel:

```cpp
// ═══════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — MASTER HUB
// ═══════════════════════════════════════════════

// STEP 1 — ENVIRONMENT
// Comment out the line below to switch to PRODUCTION mode.
#define ENV_LOCAL   // ← comment out this line for PRODUCTION
```

**For LOCAL development:** leave `#define ENV_LOCAL` as-is. The hub posts to your PC.

**For PRODUCTION:** comment it out:
```cpp
// #define ENV_LOCAL   // ← commented out = PRODUCTION mode
```

Then update STEP 3 with your Vercel URL:
```cpp
#define PROD_URL "https://your-project.vercel.app"  // ← your actual URL
```

And STEP 4 with your production ingest key (must match `TELEMETRY_INGEST_KEY` in Vercel):
```cpp
#define TELEMETRY_KEY_VALUE "your-strong-random-secret"  // ← from Vercel env vars
```

### 7.3 Flash the Master Hub

1. Connect the Heltec hub to your PC via USB
2. In Arduino IDE:
   - **Tools → Board → Heltec WiFi LoRa 32 V3**
   - **Tools → Port** → select the COM port (Windows) or `/dev/ttyUSB0` (Linux/macOS)
3. Click **Upload** (→ arrow)
4. Open **Serial Monitor** (115200 baud)
5. Confirm it connects to WiFi and posts telemetry:
   ```
   [Core0] WiFi OK | IP=192.168.1.x | MAC=F0:9E:9E:77:7B:F4 | CH=6
   [HTTP] POST → https://your-project.vercel.app/api/telemetry/ingest
   [HTTP] 200 OK
   ```

### 7.4 Flash Motor Controller

1. Flash `hardware/soltra-motor-controller/soltra_motor_controller.ino`
2. Open Serial Monitor → copy the MAC from:
   ```
   [SETUP] Motor MAC: 24:6F:28:AA:BB:CC
   ```
3. Open `soltra_master_hub.ino` → find STEP 5 in the config panel:
   ```cpp
   uint8_t MOTOR_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; // ← replace
   ```
   Replace with your motor's MAC:
   ```cpp
   uint8_t MOTOR_MAC[6] = {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0xCC};
   ```
4. Re-flash the hub (Step 7.3). Done — never needs changing again.

### 7.5 Flash Sensor Nodes (×4)

For each of the 4 sensor boards:
1. Open `hardware/soltra-sensor-node/soltra_sensor_node.ino`
2. In the config panel at the top, change STEP 1:
   ```cpp
   #define NODE_ID 1   // ← change to 1, 2, 3, or 4 for each board
   ```
3. Flash — **Tools → Board → XIAO_ESP32C3** (or your board)
4. On first boot, connect to `Soltra-Node-1-Setup` hotspot → enter WiFi password

### 7.6 Flash Camera Node

1. Open `hardware/soltra-camera-node/CameraWebServer/CameraWebServer.ino`
2. In the config panel at the top, update STEP 1 if you changed the hub board:
   ```cpp
   uint8_t HUB_MAC[] = {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4}; // ← your hub MAC
   ```
3. Flash — **Tools → Board → XIAO_ESP32S3**
4. Open Serial Monitor — copy the stream URL:
   ```
   Stream URL: http://192.168.1.xxx/stream
   ```
5. Add that URL to `soltra-hud/.env.local`:
   ```env
   VITE_CAMERA_STREAM_URL=http://192.168.1.xxx/stream
   ```
   For production (if you need remote access), run a Cloudflare Tunnel for port 80 on that IP.

### 7.7 Verify telemetry is flowing

After all hardware is flashed and online:

```powershell
# Check Supabase for incoming telemetry rows (replace with your project URL)
# Supabase Dashboard → Table Editor → telemetry → should show new rows every 5s

# Or use the API:
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/health"
# Should show: {"status":"ok", ...}
```

---



| Resource | URL |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| HiveMQ Cloud Console | https://console.hivemq.cloud |
| Stripe Dashboard | https://dashboard.stripe.com |
| Cloudflare Zero Trust | https://one.dash.cloudflare.com |
| Vercel CLI docs | https://vercel.com/docs/cli |
| Supabase CLI docs | https://supabase.com/docs/reference/cli |
