# 🧠 Soltra — Codebase Explanation (Plain English)

> This document explains what **every folder and important file** in the Soltra project does.  
> No coding experience required to read this.

---

## 📂 Visual Directory Tree

```
Soltra/                              ← The root (top-level) folder of the project
│
├── hardware/                        ← All code that runs ON the physical circuit boards
│   ├── soltra-master-hub/           ← The "brain" board firmware
│   ├── soltra-motor-controller/     ← The "muscles" board firmware
│   ├── soltra-sensor-node/          ← The "eyes/skin" board firmware (light sensors)
│   ├── soltra-camera-node/          ← The "eye" board firmware (camera)
│   ├── soltra-sensor-node-pcb/      ← PCB design files for the sensor node
│   ├── soltra-sensor-node-test/     ← Test sketches for the sensor node
│   └── soltra_config.h              ← Shared configuration values for all hardware
│
├── software/                        ← All code that runs on computers/cloud servers
│   ├── soltra-saas/                 ← 🌐 The main website + customer portal (Next.js)
│   ├── soltra-dashboard/            ← 📊 Standalone operator dashboard with 3D viewer
│   ├── soltra-tts/                  ← 🎤 Voice assistant server (Python)
│   ├── soltra-cv/                   ← 👁️ Computer vision sun tracker (Python)
│   ├── soltra-hud/                  ← 🔧 Local desktop HUD for technicians
│   ├── soltra-hud-mobile/           ← 📱 Mobile technician app
│   ├── soltra-mini-overseer/        ← 🤖 Lightweight AI operator assistant
│   ├── soltra-node-monitor/         ← 📡 Node health monitoring tool
│   ├── soltra-proxy/                ← 🔀 Local network proxy server
│   └── MODULES.md                   ← Documentation about what each module does
│
├── docs/                            ← Extra documentation and diagrams
├── designs/                         ← UI design mockups and assets
├── raspberry_pi_deploy/             ← Scripts for deploying to a Raspberry Pi
├── tools/                           ← Utility scripts and helper tools
│
├── README.md                        ← 📖 This is the first thing people read (start here)
├── CODEBASE_EXPLANATION.md          ← 🧠 This file — explains every component
├── CONTRIBUTING.md                  ← 🤝 Guide for how to contribute or extend the project
├── SETUP.md                         ← ⚙️ Detailed hardware + software setup guide
├── DEPLOYMENT.md                    ← 🚀 How to deploy to production (cloud)
├── start-local.ps1                  ← ▶️ Script to start all software with one click (Windows)
├── start-local.cmd                  ← ▶️ Same as above, but simpler Windows format
├── start-streams.ps1                ← ▶️ Script to start the camera/video streams
└── .gitignore                       ← Tells Git which files NOT to upload (passwords, etc.)
```

---

## 🔩 HARDWARE — The Physical Circuit Boards

> **What is firmware?** Firmware is the program that runs directly on a microcontroller (like an ESP32 chip). Think of it like the operating system on your phone, but for a tiny circuit board. These files have the `.ino` extension and are written in C++.

---

### `hardware/soltra-master-hub/` — The Brain 🧠

**Think of it as:** The captain of the ship. Every other hardware component reports to the Master Hub.

**Physical board:** Heltec WiFi LoRa 32 V3

**Key file:** `soltra_master_hub/soltra_master_hub.ino` (41 KB — the largest firmware file)

**What it does:**
1. **Calculates where the sun is** using astronomical math (it knows the time, date, and your GPS location)
2. **Polls all 4 sensor nodes** every few seconds, asking "what light readings do you have?"
3. **Commands the motor controller** to rotate the panel to the optimal angle
4. **Sends telemetry to the cloud** — every reading (temperature, UV, light level, angle) is uploaded to Supabase via HTTP and HiveMQ via MQTT
5. **Has a small OLED display** that shows status information locally
6. **Acts as a WiFi captive portal** on first boot — creates a temporary WiFi hotspot so you can configure which WiFi it should connect to (via a library called `WiFiManager`)

**How it talks to others:**
- Uses **ESP-NOW** (an ultra-fast, peer-to-peer radio protocol) to talk to the sensor nodes and motor controller — this works even if WiFi is down
- Uses **MQTT** (a lightweight messaging protocol) to talk to HiveMQ in the cloud
- Uses **HTTP POST** requests to send bulk telemetry to the Vercel-hosted SaaS

---

### `hardware/soltra-motor-controller/` — The Muscles 💪

**Think of it as:** The arm that physically moves the solar panel based on orders from the Brain.

**Physical board:** Wemos D1 R32 (ESP32 Dev Kit) + L298N motor driver

**Key file:** `soltra_motor_controller/soltra_motor_controller.ino`

**What it does:**
1. **Waits for commands** from the Master Hub via ESP-NOW
2. **Drives two motors** (pan and tilt) via the L298N H-bridge driver chip, which can control motor direction and speed
3. **Reads the MPU6050 sensor** (an accelerometer + gyroscope, like the one in your phone that knows which way is up) to report the actual current angle of the panel
4. **Reports back** its position to the Master Hub so it knows if the movement succeeded

**How it talks to others:**
- Exclusively via **ESP-NOW** to the Master Hub. It does not have its own internet connection.

---

### `hardware/soltra-sensor-node/` — The Eyes & Skin 👁️

**Think of it as:** Tiny scouts placed at each corner of the solar panel, reporting on light conditions.

**Physical board:** Seeed Studio XIAO ESP32-C3 (4 of these, one per corner)

**Key file:** `soltra_sensor_node/soltra_sensor_node.ino`

**What it does:**
1. **Reads light sensors:** LDR (basic light level), TSL2591 (precise lux measurement), UV sensor (ultraviolet light), and IR sensor (infrared / heat radiation)
2. **Deep-sleeps most of the time** to save battery — it wakes up, takes a reading, sends it to the hub, and goes back to sleep. This is a key power-saving technique for embedded systems.
3. **Sets up its own WiFi captive portal on first boot** (same as the hub) so you can configure which WiFi it joins — it needs WiFi to auto-detect the correct ESP-NOW channel

**How it talks to others:**
- Broadcasts light readings to the Master Hub over **ESP-NOW**

---

### `hardware/soltra-camera-node/` — The Surveillance Camera 📹

**Think of it as:** A security camera mounted on the solar tracker, so operators can see it remotely.

**Physical board:** Seeed XIAO ESP32-S3 Sense (has a built-in camera)

**What it does:**
1. **Captures a continuous MJPEG video stream** from the onboard camera
2. **Serves the stream over HTTP** on the local network (accessible via a URL like `http://10.45.27.233/stream`)
3. **Sends its frame data to the Master Hub** via ESP-NOW so it can be forwarded

**How it talks to others:**
- Streams video directly over the **local WiFi network** — anyone on the same network can view it in a browser
- Also communicates with the Master Hub via **ESP-NOW**

---

### `hardware/soltra_config.h` — The Shared Settings File ⚙️

**Think of it as:** A shared rulebook. Instead of writing the same WiFi passwords and pin numbers in every firmware file, they can all import this one central file.

**What it contains:** Pin definitions (which GPIO pin is connected to which sensor), constant values, and shared configuration macros.

---

## 🌐 SOFTWARE — The Websites & Apps

---

### `software/soltra-saas/` — The Main Customer Website 🏠

**Think of it as:** The Soltra "app" that customers use — like how you'd use the Nest app to control a smart thermostat.

**Technology:** Next.js 16 + React 19 + Tailwind CSS (written in TypeScript)

> **What is Next.js?** It's a powerful framework for building websites with React. It handles both the "what the user sees" (frontend) and the "server logic" (backend API routes) in one project.

**Key folders inside `src/`:**

#### `src/app/` — The Pages (Routes)
Every folder here is a page of the website. Next.js maps folder names directly to URLs.

| Folder | URL | What it is |
|--------|-----|------------|
| `page.tsx` | `/` | The landing/marketing page (what visitors see first) |
| `(auth)/login` | `/login` | Login and signup page |
| `dashboard/` | `/dashboard` | Protected area (only logged-in users) |
| `dashboard/homeowner/` | `/dashboard/homeowner` | Dashboard for home users |
| `dashboard/fleet/` | `/dashboard/fleet` | Dashboard for managing many panels at once |
| `dashboard/settings/` | `/dashboard/settings` | User account settings |
| `dashboard/onboarding/` | `/dashboard/onboarding` | Step-by-step setup wizard |
| `dashboard/hud/` | `/dashboard/hud` | Built-in heads-up display |

#### `src/app/api/` — The Backend API (Server Logic)
These are server-side endpoints. Think of them like buttons on the back of a TV — the user's device "presses" them to trigger server actions.

| Folder | What it does |
|--------|--------------|
| `api/telemetry/` | **Most important!** Receives data packets sent by the Master Hub every few seconds. Stores them in Supabase. |
| `api/command/` | Receives commands from the UI and publishes them to HiveMQ, which relays them to the hardware |
| `api/tts/` | Proxy for the voice server — receives text, forwards it to the local Python TTS server, returns audio |
| `api/cv/` | Routes for computer vision control (start/stop tracking) |
| `api/camera/` | Routes for camera stream management |
| `api/firmware/` | Handles over-the-air (OTA) firmware update delivery to the hardware |
| `api/webhooks/` | Receives payment events from Stripe |
| `api/checkout/` | Handles Stripe payment session creation |

#### `src/components/` — Reusable UI Building Blocks
**Think of components as LEGO bricks.** Each component is a self-contained piece of the UI (a button, a graph, a card). Pages are assembled by combining these components.

#### `src/lib/` — Shared Utility Code
- `types.ts` — Defines the shape of data (e.g., "a TelemetryReading has a timestamp, a UV value, and a temperature")
- `supabase/` — Helper code for connecting to and querying the Supabase database
- `stripe.ts` — Helper code for the Stripe payment system
- `ai/` — Helper code for the Google Gemini AI integration

#### `src/middleware.ts` — The Gatekeeper
This runs on every single page load. It checks if the user is logged in and redirects them to the login page if they try to access protected pages (like the dashboard) without being authenticated.

#### `supabase/` — Database Schema
- `master_schema.sql` — The SQL code that creates all the database tables. You run this once during setup.

---

### `software/soltra-dashboard/` — The 3D Operator Dashboard 📊

**Think of it as:** A high-tech control room screen for the people operating Soltra — with a rotating 3D model of the solar panel that moves in real time as the physical panel moves.

**Technology:** Vite + React + Three.js + React Three Fiber

> **What is Three.js?** A JavaScript library that renders 3D graphics directly in a web browser — the same kind of technology used for browser-based games.

**Key files inside `src/`:**

| File/Folder | What it does |
|-------------|--------------|
| `App.jsx` | The root of the application — sets up the overall layout |
| `main.jsx` | The entry point — the very first file that runs when the app loads |
| `components/` | Individual UI pieces (charts, panels, the 3D viewer, etc.) |
| `hooks/` | Custom React "hooks" — reusable logic like "subscribe to live telemetry data" |
| `lib/` | Connection helpers (Supabase client, MQTT client) |
| `utils/` | Small helper functions (e.g., converting raw sensor values to degrees) |

**Key external config files:**

| File | What it does |
|------|--------------|
| `vite.config.js` | Configures the Vite build tool (think of it as the build recipe) |
| `package.json` | Lists all the packages/libraries this app depends on |
| `.env.local` | Your secret API keys — never commit this to GitHub! |

---

### `software/soltra-tts/` — The Voice Assistant Server 🎤

**Think of it as:** A translator that converts text into spoken audio. When Soltra wants to say "UV index is 8.5, panel at 67 degrees", this server turns that text into a WAV audio file.

**Technology:** Python + FastAPI + Kokoro ONNX

> **What is FastAPI?** A Python framework for building web APIs very quickly. Think of it as a server that listens for requests and responds with data.
> **What is ONNX?** A format for running AI models efficiently. Kokoro is a high-quality text-to-speech AI model.

**Key files:**

| File | What it does |
|------|--------------|
| `server.py` | **The entire TTS server.** Runs on port 8099. Has endpoints like `/speak` (generate audio) and `/voices` (list available voices). Supports two engines: Kokoro ONNX (fast, primary) and Chatterbox TTS (fallback with voice cloning). |
| `kokoro-v1.0.onnx` | The AI voice model file (~330 MB). This is the "brain" of the voice system. |
| `voices.bin` | Pre-computed voice profiles used by the Kokoro model. |
| `voices.json` | A list of all available voices with their properties. |
| `profiles/` | Custom voice profiles (e.g., the "Ada" persona voice). |
| `requirements.txt` | The list of Python packages needed — installed with `pip install -r requirements.txt`. |
| `create_ada_profile.py` | A script to generate Ada's custom voice profile. |
| `test_*.py` | Test scripts to verify the TTS server is working correctly. |

---

### `software/soltra-cv/` — The Computer Vision Sun Tracker 👁️

**Think of it as:** A pair of AI-powered eyes that watch the camera feed and can detect exactly where the sun is in the frame, then send corrections to the motor controller.

**Technology:** Python + OpenCV + Flask + Roboflow Inference

> **What is OpenCV?** An open-source library for processing images and video. "CV" stands for Computer Vision.
> **What is Roboflow?** A cloud service for running AI image detection models. Soltra uses it to detect the sun in the camera feed.

**Key files:**

| File | What it does |
|------|--------------|
| `app.py` | The main server. Opens the camera stream, passes frames through the Roboflow AI model to detect the sun, calculates how far off-center the sun is (in degrees), and publishes correction commands to HiveMQ. Also serves a web UI to see the processed video feed. |
| `sun_tracker.py` | The core tracking logic — the algorithm that converts "sun is N pixels to the left" into "send a rotate-left-by-X-degrees command." |
| `requirements.txt` | Python packages needed. |
| `.env` | Your `ROBOFLOW_API_KEY` — keep this private! |

---

### `software/soltra-hud/` & `software/soltra-hud-mobile/` — Technician Apps 🔧

**Think of them as:** A simplified, focused control panel for the person physically on-site with the hardware — like a cockpit display. It bypasses the cloud and connects directly to HiveMQ for the lowest possible latency.

**Technology:** SvelteKit (HUD) + SvelteKit + Capacitor (Mobile)

> **What is SvelteKit?** A different web framework than React/Next.js — it's known for producing very small, fast web apps.
> **What is Capacitor?** A tool that wraps a web app into a native Android or iOS app — so you can install it from the Play Store.

**`soltra-hud-mobile` unique files:**

| File | What it does |
|------|--------------|
| `capacitor.config.ts` | Configures the mobile app wrapping (app ID, name, permissions) |
| `android/` | The generated Android project — you can open this in Android Studio and build an APK |
| `ingestor.js` | A script for batch-ingesting historical data |

---

### `software/soltra-proxy/` — The Local Network Proxy 🔀

**Think of it as:** A relay station on your local network. Some devices (like the ESP32 camera) can only talk on the local network — this proxy forwards their data to the internet.

**Technology:** Node.js

**Key file:**

| File | What it does |
|------|--------------|
| `proxy.js` | A lightweight Node.js script that listens on a local port and forwards specific requests. Used during development or for edge cases where direct cloud access isn't available. |

---

### `software/soltra-mini-overseer/` — The AI Operator Chat Agent 🤖

**Think of it as:** A chatbot specifically trained to understand Soltra. You can type "What's the UV level at Node 3?" and it answers using live data.

---

### `software/soltra-node-monitor/` — Node Health Dashboard 📡

**Think of it as:** A simple status board showing which hardware nodes are online/offline and their last-seen timestamps.

---

## 📁 Root-Level Files

These are the most important files in the top-level `Soltra/` folder:

| File | What it does |
|------|--------------|
| `README.md` | The front page of the project on GitHub. Everyone reads this first. |
| `CODEBASE_EXPLANATION.md` | This file — explains every component. |
| `CONTRIBUTING.md` | Guide for contributors and people who want to extend the project. |
| `SETUP.md` | Detailed step-by-step setup guide (hardware + software). |
| `DEPLOYMENT.md` | Instructions for deploying to production (Vercel, etc.). |
| `start-local.ps1` | A PowerShell script that starts all software services with one click on Windows. |
| `start-local.cmd` | A simpler Windows batch script version of the above. |
| `start-streams.ps1` | Starts the camera streaming services. |
| `.gitignore` | Tells Git which files to ignore (e.g., `node_modules/`, `.env` files with passwords). |
| `.gitattributes` | Tells Git how to handle certain file types (line endings, binary files). |
| `quick_dashboard.html` | A simple single-file HTML dashboard — a quick way to view data without running the full SaaS. |
| `soltra_config.h` | Wait — this is a hardware config file, but it lives at the root as a convenient shared reference. The actual one used is in `hardware/`. |
| `Ada.wav` / `output.wav` | Sample audio files generated by the TTS server. |

---

## 🔗 How the Data Flows (End-to-End)

Here's a plain-English walkthrough of what happens every 5 seconds in a working Soltra system:

```
1. SENSOR NODES wake up from deep sleep
   └──► Measure LDR, UV, IR light values
   └──► Send readings via ESP-NOW → MASTER HUB

2. MASTER HUB receives sensor readings
   └──► Runs solar position algorithm (what angle should the panel be?)
   └──► Compares ideal angle vs. current angle (from Motor Controller)
   └──► If different: sends "move to X degrees" command via ESP-NOW → MOTOR CONTROLLER

3. MOTOR CONTROLLER receives movement command
   └──► Drives the L298N motor driver → physically rotates the panel
   └──► Reads MPU6050 gyroscope to confirm new angle
   └──► Reports "I'm now at X degrees" via ESP-NOW → MASTER HUB

4. MASTER HUB aggregates all data
   └──► Publishes full telemetry packet to HIVEMQ (MQTT protocol, port 8883)
   └──► Sends HTTP POST with same data to VERCEL (soltra-saas API route /api/telemetry/ingest)

5. VERCEL (soltra-saas)
   └──► /api/telemetry/ingest receives the POST
   └──► Writes the data to SUPABASE database

6. SUPABASE
   └──► Triggers a "Realtime" WebSocket event
   └──► All connected dashboards (soltra-saas, soltra-dashboard) receive the update instantly

7. YOUR BROWSER (dashboard)
   └──► New data appears on the screen within ~1 second of the hub sending it
   └──► The 3D solar panel model rotates to match the real panel's angle
   └──► If Ada is active, the TTS server converts any alerts to audio and plays them
```

---

## 💡 Key Concepts Explained Simply

| Term | Plain English Explanation |
|------|--------------------------|
| **ESP-NOW** | A radio protocol by Espressif (same company that makes ESP32). Think of it as a walkie-talkie system for circuit boards. It's faster and more reliable than WiFi for short-range device-to-device communication. |
| **MQTT** | A lightweight messaging protocol. Think of it as a group chat app for IoT devices. Devices can "publish" messages to a "topic" (like a chat channel), and other devices can "subscribe" to receive those messages. |
| **Supabase Realtime** | A feature of Supabase that uses WebSockets (a persistent connection) to instantly push database changes to all connected apps — so your browser doesn't need to constantly refresh. |
| **FastAPI** | A Python web framework that makes it very easy to create API endpoints (functions that can be called over the internet). |
| **Next.js App Router** | The system Next.js uses to map folder names to website URLs. `app/dashboard/page.tsx` becomes the `/dashboard` page. |
| **ONNX** | Open Neural Network Exchange — a file format for storing AI models that can be run very efficiently without a GPU. |
| **H-bridge (L298N)** | An electronic circuit that can drive a motor in both forward and reverse directions by switching the polarity of the current. The L298N chip is a popular, inexpensive H-bridge module. |
| **Deep Sleep** | A power-saving mode for microcontrollers. The chip shuts down most of itself and wakes up on a timer. This lets battery-powered sensor nodes last much longer. |
| **Captive Portal** | The web page that automatically pops up when you connect to a WiFi hotspot (like in a hotel or airport). Soltra uses this for first-time WiFi configuration. |
| **Telemetry** | Data collected from a remote source. In Soltra's case, it's all the sensor readings, angles, and statuses sent from the hardware to the cloud. |
