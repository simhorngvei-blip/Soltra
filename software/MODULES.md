# Soltra — Software Modules Reference

> Last updated: 2026-05-28

This document describes every software component in the Soltra workspace, what it does, who it's for, and how it connects to the rest of the system.

---

## `soltra-saas` — Production SaaS Platform ✅

| Property | Detail |
|---|---|
| **Type** | Next.js 15 App Router |
| **Target User** | Homeowners, fleet admins |
| **Status** | Production-ready |
| **Deployed** | Vercel (`soltra-green.vercel.app`) |
| **Port (local)** | 3000 |

### What it does
The primary customer-facing application. Handles authentication (Supabase Auth), billing (Stripe), site/node management, and live telemetry display for homeowners.

### Key routes
| Route | Function |
|---|---|
| `/` | Marketing/landing page |
| `/dashboard` | Homeowner live view — realtime telemetry via Supabase Realtime |
| `/sites` | Site management (add/remove solar tracker sites) |
| `/nodes` | Node registration — MAC address pairing |
| `/api/telemetry/ingest` | HTTP POST from hardware (no user JWT, uses `TELEMETRY_INGEST_KEY`) |
| `/api/command` | Authenticated MQTT publish (server-side, no browser credential exposure) |
| `/api/tts` | TTS proxy route — forwards to `soltra-tts`, hides `TTS_URL` from browser |
| `/api/checkout` | Stripe checkout session creation |
| `/api/webhooks` | Stripe webhook handler |

### Hooks
| Hook | Purpose |
|---|---|
| `useTelemetryRealtime` | Supabase Realtime subscription — secure, auth-gated, homeowner-safe |
| `useSoltraMqtt` | Direct browser MQTT — ⚠️ developer/admin only (credentials visible in browser) |
| `useTTS` | Text-to-speech via `/api/tts` proxy — hides TTS_URL from browser |

### Environment variables
See `.env.local` and `.env.production.example` for the full list.

---

## `soltra-dashboard` — 3D AI Overseer Companion App ✅

| Property | Detail |
|---|---|
| **Type** | React + Vite + Three.js |
| **Target User** | Operators / developers |
| **Status** | Working |
| **Deployed** | Vercel (`soltra-overseer.vercel.app`) |
| **Port (local)** | 5174 |

### What it does
A visual 3D representation of the solar tracker with real-time AI analytics overlay. Not the homeowner app — this is the engineering/monitoring companion. Shows live pan/tilt angles, irradiance, and status in a Three.js scene.

### Key files
| File | Purpose |
|---|---|
| `src/App.jsx` | Root scene setup and layout |
| `src/hooks/useSoltraTelemetry.js` | Supabase Realtime + simulation fallback |
| `src/utils/ttsService.js` | TTS client (now reads `VITE_TTS_URL`) |
| `src/components/AIInsightsPanel.jsx` | AI analysis display |

### Simulation fallback
If `VITE_SUPABASE_URL` is not set or Supabase is unreachable, `useSoltraTelemetry.js` automatically generates synthetic telemetry data so the 3D scene is always alive during development.

---

## `soltra-hud` — Desktop HUD ⚠️

| Property | Detail |
|---|---|
| **Type** | SvelteKit |
| **Target User** | Operators on-site |
| **Status** | Working (local only — credentials in browser) |
| **Deployed** | Not deployed (local use only by design) |
| **Port (local)** | 5173 |

### What it does
A desktop HUD for on-site operators. Shows live MQTT telemetry, motor controls, camera feed, and TTS voice feedback. Connects to HiveMQ directly from the browser (WebSocket over port 8884).

> **⚠️ Security note:** Because this is a browser app, HiveMQ credentials (`VITE_HIVEMQ_*`) are visible in browser devtools. This is intentional — the HUD is a developer/operator tool, not a public-facing app. Do not deploy it as a public website without adding authentication.

### Key files
| File | Purpose |
|---|---|
| `src/routes/+page.svelte` | Main HUD layout |
| `src/lib/mqttStore.ts` | MQTT connection state (reads from `VITE_HIVEMQ_*`) |
| `src/lib/ttsService.ts` | TTS client (now reads `VITE_TTS_URL`) |
| `src/lib/llmService.ts` | AI query client |
| `src/lib/appState.svelte.ts` | Svelte 5 reactive state |

---

## `soltra-tts` — Local TTS Server ✅

| Property | Detail |
|---|---|
| **Type** | FastAPI (Python) |
| **Target User** | Internal — called by SaaS and HUD |
| **Status** | Fully working, connected via `/api/tts` proxy |
| **Deployed** | Runs locally; reachable from internet via Cloudflare Tunnel |
| **Port (local)** | 8099 |

### What it does
A high-performance local text-to-speech server. Primary engine: **Kokoro ONNX** (fast, 24kHz, low RAM). Fallback/voice-cloning engine: **Chatterbox TTS** (slower, requires GPU for real-time).

### Endpoints
| Endpoint | Function |
|---|---|
| `GET /health` | Health check — returns `{ kokoro_loaded, chatterbox_loaded }` |
| `GET /profiles` | List all cloned voice profiles |
| `POST /clone` | Upload audio → creates a cloned voice profile |
| `POST /generate` | Generate speech from text + profile ID |
| `DELETE /profiles/{id}` | Delete a voice profile |

### Connection architecture
```
Browser (SaaS)
    ↓  POST /api/tts  (Next.js server-side — TTS_URL hidden)
Next.js API Route (/api/tts/route.ts)
    ↓  POST /generate  (to localhost or Cloudflare Tunnel)
soltra-tts (FastAPI, port 8099)
    ↓  WAV audio stream
Next.js API Route
    ↓  audio/wav stream
Browser → Web Audio API → Speaker
```

### Starting the server
```bash
cd software/soltra-tts
pip install -r requirements.txt
# Download model files (first time only):
# kokoro-v1.0.onnx and voices.json → place in software/soltra-tts/
python server.py
```

---

## `soltra-cv` — Computer Vision Tracker 🔴 (Orphaned)

| Property | Detail |
|---|---|
| **Type** | Python script |
| **Status** | Not connected to any other module |

### What it does
Standalone solar tracking via camera + OpenCV. Not integrated into the system. The master hub already handles sun tracking via ephemeris (SolarCalculator) and LDR sensors — this module is redundant unless you want camera-based fine-tuning. Consider integrating with the camera node stream in a future version.

---

## `temp-soltra` / `temp-soltra2` — Dead Code 🗑️

Both are stale workspace copies with no active code. Deleted as part of the Phase 7 cleanup.

---

## Hardware Modules

| Module | Type | Status |
|---|---|---|
| `soltra-master-hub` | Heltec ESP32-S3 | ✅ Cloud + ESP-NOW hub |
| `soltra-motor-controller` | ESP32 Dev Kit V1 | ✅ Motor driver + MPU6050 |
| `soltra-sensor-node` | XIAO ESP32C3 × 4 | ✅ LDR/UV/TSL2591, deep sleep |
| `soltra-camera-node` | ESP32-CAM | ✅ MJPEG stream to HUD |

---

## Communication Map

```
[Sensor Nodes × 4]  ──── ESP-NOW ────→  [Master Hub]
[Motor Controller]  ←─── ESP-NOW ────   [Master Hub]
[Motor Controller]  ──── ESP-NOW ────→  [Master Hub] (angle telemetry)

[Master Hub]  ──── MQTT (HiveMQ) ────→  [HiveMQ Cloud]
[Master Hub]  ──── HTTPS POST ────────→  [SaaS /api/telemetry/ingest]

[HiveMQ Cloud]  ←──── WebSocket ──────  [SaaS /api/command]
[HiveMQ Cloud]  ────→ WebSocket ──────  [HUD mqttStore.ts]
[HiveMQ Cloud]  ────→ WebSocket ──────  [SaaS useSoltraMqtt.ts] ⚠️ browser

[Supabase]  ←── service_role INSERT ──  [SaaS /api/telemetry/ingest]
[Supabase]  ────→ Realtime ───────────  [SaaS useTelemetryRealtime.ts]
[Supabase]  ────→ Realtime ───────────  [Dashboard useSoltraTelemetry.js]

[soltra-tts]  ←── HTTPS ─────────────  [SaaS /api/tts]
[soltra-tts]  ←── HTTP ───────────────  [HUD ttsService.ts] (local only)
[soltra-tts]  ←── HTTP ───────────────  [Dashboard ttsService.js] (local only)
```
