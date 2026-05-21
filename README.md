# Soltra

**Soltra** is a commercial-grade, distributed edge-computing solar tracking ecosystem — combining autonomous embedded hardware, computer vision, cloud telemetry, and an AI-driven operator HUD into a single cohesive platform.

---

## System Overview

> Decentralized. AI-driven. Weather-predicting. Built for real deployments.

Soltra features a zero-collision ESP-NOW radio mesh, HiveMQ cloud telemetry, a voice-interactive AI operator interface, and a full SaaS management platform — designed for both residential (B2C) and agricultural fleet (B2B) markets.

---

## Repository Structure

```
soltra/
├── hardware/                    # Embedded firmware (Arduino/ESP32)
│   ├── soltra-master-hub/       # Heltec WiFi LoRa 32 — FreeRTOS Hub OS
│   ├── soltra-motor-controller/ # Wemos D1 R32 — ESP-NOW motor driver
│   ├── soltra-sensor-node/      # XIAO ESP32-C3 — TinyML sensor corners
│   └── soltra-camera-node/      # XIAO ESP32-S3 Sense — CV camera node
│
├── software/                    # Application software
│   ├── soltra-hud/              # React (Vite) — AI Overseer HUD
│   ├── soltra-saas/             # Next.js — Commercial SaaS platform
│   ├── soltra-dashboard/        # React (Vite) — Standalone MQTT dashboard
│   └── soltra-tts/              # Python — Local Voicebox TTS/LLM backend
│
├── docs/                        # Documentation & progress tracking
│   ├── architecture.md          # Master system architecture blueprint
│   ├── roadmap.md               # Sprint status & engineering roadmap
│   ├── hivemq_setup.md          # HiveMQ Serverless cluster setup guide
│   ├── hardware_progress.md
│   ├── software_progress.md
│   ├── voice_progress.md
│   └── website_progress.md
│
├── tools/                       # Setup scripts & utilities
│   ├── setup_voicebox.ps1       # Voicebox environment bootstrap (Windows)
│   └── run_voicebox_setup.ps1   # Voicebox runner script
│
└── experiments/                 # Side projects & research spikes
    ├── persona-quickshell/      # QML Quickshell desktop UI experiments
    ├── p3r-pause-menu/          # SvelteKit UI experiment
    ├── persona-3-reload-pause-menu/ # Godot UI experiment
    └── data/                    # Local DB and backend data
```

---

## Hardware Stack

| Component | Role | MCU |
|---|---|---|
| Master Hub | Radio master, cloud gateway, motor control | Heltec WiFi LoRa 32 (V3) |
| Motor Controller | ESP-NOW receiver, Cytron MDD3A driver | Wemos D1 R32 (ESP32) |
| Sensor Nodes (×3) | UV/LDR/TinyML corner sensing | Seeed XIAO ESP32-C3 |
| Camera Node | CV sun centroid tracking | Seeed XIAO ESP32-S3 Sense |

---

## Software Stack

| Project | Tech | Purpose |
|---|---|---|
| `soltra-hud` | React, Vite, Three.js, Framer Motion | AI Overseer operator interface |
| `soltra-saas` | Next.js, Tailwind, Supabase, Stripe | Commercial SaaS platform |
| `soltra-dashboard` | React, Vite, MQTT.js | Live telemetry web dashboard |
| `soltra-tts` | Python, chatterbox-tts, CUDA | Local voice synthesis backend |

---

## Quick Start

### Hardware
Open any `.ino` file in Arduino IDE. Install required libraries (see `docs/architecture.md` for the full sensor list).

### soltra-hud
```bash
cd software/soltra-hud
npm install
npm run dev
```

### soltra-saas
```bash
cd software/soltra-saas
npm install
cp .env.local.example .env.local  # fill in Supabase & HiveMQ credentials
npm run dev
```

### soltra-dashboard
```bash
cd software/soltra-dashboard
npm install
npm run dev
```

### soltra-tts (Voicebox)
```powershell
# Windows — run from tools/
.\tools\setup_voicebox.ps1      # first-time setup
.\tools\run_voicebox_setup.ps1  # start server
```

---

## Cloud Infrastructure
- **Broker:** HiveMQ Serverless (MQTT over TLS port 8883 / WSS port 8884)
- **MQTT Topics:** `helios/telemetry`, `helios/control/manual`, `helios/status`
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Billing:** Stripe

See [`docs/hivemq_setup.md`](docs/hivemq_setup.md) for full broker configuration.

---

## Design Language — Industrial Terminal

| Token | Value |
|---|---|
| Background | `#001a24` |
| Primary Cyan | `#00d9ff` |
| Alert Red | `#ff2a2a` |
| Warning Amber | `#ffaa00` |
| Header Font | `Bebas Neue` |
| Data Font | `monospace` |

---

## License

Private — All rights reserved. © Soltra.
