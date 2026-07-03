# 🌞 Soltra — AI-Driven Solar Tracking System

> **Complete beginner? No problem.** This guide assumes you have never written a single line of code. Every step is explained in plain English with exact commands to copy and paste.

---

## 📖 What is Soltra?

Soltra is a smart solar panel system that **automatically tracks the sun** to maximize energy production. Instead of a static, dumb solar panel that only catches the sun at one angle all day, Soltra uses:

- **Sensors** to detect where the sun is
- **Motors** to physically rotate the solar panel to face the sun
- **AI + Computer Vision** to visually confirm the sun's position using a camera
- **A cloud dashboard** so you can monitor everything from your phone or laptop anywhere in the world
- **A voice assistant ("Ada")** that speaks status updates out loud

Think of it like giving your solar panel a brain, eyes, ears, and a voice.

---

## 🗺️ The Big Picture — How Everything Connects

```
                         ┌─────────────┐
                         │  Your Phone  │  ← You see live data here
                         │  or Laptop   │
                         └──────┬──────┘
                                │ Internet
                    ┌───────────▼──────────────┐
                    │       CLOUD SERVICES      │
                    │  • Supabase (Database)    │
                    │  • HiveMQ (Messenger)     │
                    │  • Vercel (Website Host)  │
                    └───────────┬──────────────┘
                                │
              ┌─────────────────▼────────────────────┐
              │          MASTER HUB (The Brain)       │
              │     Heltec WiFi LoRa 32 V3 Board      │
              └──┬──────────┬──────────┬──────────────┘
                 │          │          │
        ┌────────▼─┐  ┌─────▼────┐  ┌─▼────────────┐
        │  Sensor  │  │  Motor   │  │  Camera Node │
        │  Nodes   │  │Controller│  │  (Live Video)│
        │(×4 Units)│  │          │  │              │
        └──────────┘  └──────────┘  └──────────────┘
          ↑ Light,         ↑ Moves the      ↑ Streams
          UV, IR           solar panel       video
          sensors
```

---

## ✅ What You Need Before Starting

### 🖥️ A Computer
- Windows, Mac, or Linux — any modern laptop or PC works.

### 🔧 Hardware Kit (physical parts)
- 1× Heltec WiFi LoRa 32 V3 (the "Master Hub" brain board)
- 1× Wemos D1 R32 + L298N motor driver (controls the motors)
- 4× Seeed XIAO ESP32-C3 (tiny sensor boards)
- 1× XIAO ESP32-S3 Sense (camera module)
- Sensors: LDR (light sensors), UV sensor, IR sensor, MPU6050 (gyroscope)
- Motors and the solar panel frame

### ☁️ Online Accounts (all FREE)
You'll need to create accounts on these websites. Links are provided in the setup steps.
- [Supabase](https://supabase.com) — stores your data (like a Google Sheets, but for apps)
- [HiveMQ](https://www.hivemq.com/mqtt-cloud-broker/) — passes messages between hardware and cloud (like WhatsApp, but for devices)
- [Vercel](https://vercel.com) — hosts your website for free
- [GitHub](https://github.com) — stores your code (you're already here!)

### 💾 Software to Install (free downloads)
- [Node.js LTS](https://nodejs.org/) — runs the website code on your computer
- [Python 3.11+](https://www.python.org/downloads/) — runs the voice assistant
- [Git](https://git-scm.com/downloads) — downloads this code to your computer
- [Arduino IDE](https://www.arduino.cc/en/software) — programs the hardware boards

---

## 🚀 Step-by-Step Setup Guide

### Step 0 — Download the Code

> **What is a terminal?** It's a text window where you type commands. On Windows, search for "PowerShell" or "Command Prompt". On Mac, search for "Terminal".

Open your terminal and run these commands one at a time. Press Enter after each one:

```bash
git clone https://github.com/YOUR_USERNAME/Soltra.git
cd Soltra
```

> ⚠️ Replace `YOUR_USERNAME` with your actual GitHub username.

---

### Step 1 — Set Up Cloud Accounts (10 minutes)

#### 1.1 Supabase (Your Database)
Think of Supabase as the filing cabinet that stores all your solar panel data.

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign in with your GitHub account
3. Click **New project**, give it a name (e.g., `soltra-prod`), and pick a region near you
4. Wait for it to set up (about 1 minute)
5. Go to **Project Settings → API** and copy down:
   - `Project URL` (looks like `https://abcdef.supabase.co`)
   - `anon / public` key (a very long string of letters)
   - `service_role` key (another long string — keep this private like a password!)
6. Go to **SQL Editor** in the left sidebar
7. Copy the entire contents of the file `software/soltra-saas/supabase/master_schema.sql` and paste it in
8. Click **Run** — this creates all the database tables Soltra needs

#### 1.2 HiveMQ (Your Message Broker)
Think of HiveMQ as a postal service that delivers messages instantly between your hardware and the cloud.

1. Go to [hivemq.com/mqtt-cloud-broker](https://www.hivemq.com/mqtt-cloud-broker/)
2. Click **Get started free** and create an account
3. Create a **free cluster**
4. Under **Access Management → Credentials**, click **Add credential**
5. Set a username (e.g., `soltra_user`) and a password
6. Copy down:
   - The cluster host (e.g., `abc123.s1.eu.hivemq.cloud`)
   - Your username and password

#### 1.3 Vercel (Your Website Host)
1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. You'll connect this to your repo in Step 4

---

### Step 2 — Set Up the SaaS Dashboard Website

The SaaS is the main website that customers and operators use to monitor Soltra.

1. Open the file `software/soltra-saas/.env.example` in any text editor (e.g., Notepad)
2. Make a copy of it and rename the copy to `.env.local`
3. Fill in the values from Step 1:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

HIVEMQ_HOST=YOUR_CLUSTER.s1.eu.hivemq.cloud
HIVEMQ_USER=your-hivemq-username
HIVEMQ_PASS=your-hivemq-password
NEXT_PUBLIC_HIVEMQ_HOST=YOUR_CLUSTER.s1.eu.hivemq.cloud
NEXT_PUBLIC_HIVEMQ_USER=your-hivemq-username
NEXT_PUBLIC_HIVEMQ_PASS=your-hivemq-password
```

4. Save the file
5. In your terminal, run:

```bash
cd software/soltra-saas
npm install
npm run dev
```

> ⏳ `npm install` downloads all required code packages (may take 2–3 minutes the first time).

6. Open your browser and go to `http://localhost:3000` — you should see the Soltra website!

---

### Step 3 — Set Up the Vite Dashboard (3D Viewer)

This is a separate companion app with a 3D model of the solar tracker.

```bash
# Open a NEW terminal window (keep the previous one running)
cd software/soltra-dashboard
npm install
npm run dev
```

Open your browser to `http://localhost:5174`

---

### Step 3.5 — Set Up the Technician HUDs (Optional)

Soltra comes with a low-latency "Cockpit HUD" for technicians, available as both a web app and a mobile app.

**To run the Web HUD:**
```bash
# Open a NEW terminal window
cd software/soltra-hud
npm install
npm run dev
```
Open your browser to `http://localhost:5173`.

**To build the Mobile HUD (Android):**
1. You need [Android Studio](https://developer.android.com/studio) installed.
2. In your terminal, run:
```bash
cd software/soltra-hud-mobile
npm install
npm run build
npx cap sync
npx cap open android
```
3. Android Studio will open. From there, you can connect your phone via USB and click the **Play** button to install the app on your device!

---

### Step 4 — Set Up the Voice Assistant (TTS)

This is the Python server that gives Soltra its voice. It runs on your computer.

> **What is pip?** It's like an App Store, but for Python programs.

```bash
# Open a NEW terminal window
cd software/soltra-tts
pip install -r requirements.txt
```

> ⏳ This downloads several large packages including the AI voice model — may take 5–10 minutes.

**Download the voice model files** (required):
- Go to [github.com/thewh1teagle/kokoro-onnx/releases](https://github.com/thewh1teagle/kokoro-onnx/releases)
- Download `kokoro-v1.0.onnx` (~330 MB) and `voices.bin`
- Place both files inside the `software/soltra-tts/` folder

Then start the server:

```bash
python server.py
```

You should see: `Uvicorn running on http://0.0.0.0:8099`

---

### Step 5 — Set Up the Computer Vision Sun Tracker

This Python script watches the camera feed and uses AI to detect the sun.

```bash
# Open a NEW terminal window
cd software/soltra-cv
pip install -r requirements.txt
```

Create a `.env` file in the `software/soltra-cv/` folder with:
```
ROBOFLOW_API_KEY=your_roboflow_api_key_here
```

> You can get a free Roboflow API key at [roboflow.com](https://roboflow.com). If you skip this, the CV module will run without AI detection.

```bash
python app.py
```

---

### Step 6 — Flash the Hardware (Program the Circuit Boards)

> **What is "flashing"?** It means uploading a program to a microcontroller board — similar to installing an app on your phone.

#### Install Arduino IDE
1. Download from [arduino.cc/en/software](https://www.arduino.cc/en/software)
2. Install and open it
3. Go to **File → Preferences** and in the "Additional boards manager URLs" field, add:
   ```
   https://resource.heltec.cn/download/package_heltec_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**, search for "Heltec", and install **Heltec ESP32 Series Dev-boards**

#### Install Required Libraries
In Arduino IDE, go to **Tools → Manage Libraries** and install:
- `PubSubClient`
- `WiFiManager` by tzapu
- `Adafruit BME280 Library`
- `SolarCalculator`
- `MPU6050` by Electronic Cats
- `Adafruit TSL2591 Library`

#### Flash the Master Hub
1. Connect the Heltec board to your PC with a USB cable
2. Open `hardware/soltra-master-hub/soltra_master_hub.ino` in Arduino IDE
3. Update the credentials at the top of the file with your HiveMQ and Vercel info
4. Select **Tools → Board → Heltec WiFi LoRa 32 V3**
5. Select **Tools → Port → COM3** (or whichever COM port appears)
6. Click the **Upload** button (the → arrow)
7. When done, open **Tools → Serial Monitor** (baud: 115200) to confirm it booted

#### Connect the Hub to WiFi
1. Power on the hub
2. On your phone/laptop WiFi settings, connect to the network: **`Helios-Setup`**
3. A webpage will open — select your home WiFi and enter the password
4. The hub reboots and connects. **Note down the MAC address** printed in the Serial Monitor.

#### Flash the Motor Controller
1. Open `hardware/soltra-motor-controller/soltra_motor_controller.ino`
2. Update `HUB_MAC` at the top with the Master Hub's MAC address from above
3. Flash it the same way (select **Tools → Board → ESP32 Dev Module**)
4. Note down the Motor MAC address from the Serial Monitor
5. Go back to `soltra_master_hub.ino`, update `MOTOR_MAC`, and re-upload

#### Flash the Sensor Nodes
Each of the 4 sensor nodes needs a unique ID (1, 2, 3, 4):
1. Open `hardware/soltra-sensor-node/soltra_sensor_node.ino`
2. Change `NODE_ID` to `1`
3. Select **Tools → Board → XIAO_ESP32C3**
4. Flash it
5. Repeat for each node, changing `NODE_ID` to 2, 3, and 4

---

### Step 7 — Deploy the SaaS to the Internet

1. Make sure your code is pushed to GitHub:
   ```bash
   git add .
   git commit -m "Configure Soltra for my setup"
   git push
   ```
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo
3. Set the **Root Directory** to `software/soltra-saas`
4. Click **Environment Variables** and add all the variables from your `.env.local` file
5. Click **Deploy** — your site will be live in ~2 minutes!
6. Copy your new Vercel URL (e.g., `https://soltra-abc123.vercel.app`)
7. Open `hardware/soltra-master-hub/soltra_master_hub.ino`, update the `TELEMETRY_URL` to your Vercel URL, and re-upload the firmware

---

### Step 8 — Enable Voice via Cloudflare Tunnel (Optional)

For the voice assistant to work from the cloud, you need a public URL pointing to your local Python server.

**Windows:**
```powershell
winget install --id Cloudflare.cloudflared
```

**Mac:**
```bash
brew install cloudflared
```

Then, with `python server.py` already running, open a new terminal:
```bash
cloudflared tunnel --url http://localhost:8099
```

Cloudflare will print a URL like `https://random-name.trycloudflare.com`. Add this as the `TTS_URL` environment variable in your Vercel project settings and redeploy.

---

### Step 9 — Register Your Hardware

1. Go to your Vercel URL and create an account
2. Click **Add Site** and name your installation location
3. Click **Add Node** and paste the Master Hub's MAC address
4. Live telemetry should appear within 5 seconds! ✅

---

## 🛠️ Troubleshooting

| Problem | What to check |
|---|---|
| `npm install` fails | Make sure Node.js is installed. Run `node --version` — you should see a version number. |
| Hub won't connect to WiFi | Hold the RESET button on the Heltec board for 3 seconds to re-open the setup portal |
| Sensor node offline | Check the hub's Serial Monitor for `sensor_offline` — verify the node is powered on |
| Motor not moving | Check the Motor Controller's Serial Monitor for `[ESP-NOW] Cmd received` |
| TTS 503 error | Make sure `python server.py` is running AND the Cloudflare tunnel is active |
| Voice not working | Check that the `TTS_URL` environment variable on Vercel matches your tunnel URL |
| No telemetry in dashboard | Confirm `TELEMETRY_INGEST_KEY` matches between firmware and Vercel env vars |
| Supabase `unauthorized` | Make sure you used `SUPABASE_SERVICE_ROLE_KEY`, not the anon key, in Vercel |
| `python` command not found | Make sure Python is installed and added to PATH (check the box during installation) |
| Arduino IDE can't find the board | Reinstall the Heltec board package in Boards Manager |

---

## 📦 What's Running and Where

```
Your Computer (always needs to be on for voice)
  └── soltra-tts (python server.py → port 8099)
       └── cloudflared tunnel → internet-accessible URL

Internet / Cloud (free tier, always on)
  ├── Vercel → hosts the SaaS website
  ├── Supabase → stores all data
  └── HiveMQ → real-time message broker

Your Home / Lab (the hardware)
  ├── Master Hub (Heltec) — WiFi + sends data to cloud
  ├── Motor Controller (ESP32) — physically moves the panel
  ├── Sensor Nodes ×4 (XIAO C3) — detect light/UV/IR
  └── Camera Node (ESP32-S3) — streams live video
```

**Total monthly cost: $0.00** (all services used are on their free tiers)

---

## 🧰 Tech Stack Summary

| Layer | Technology | What it does |
|---|---|---|
| Hardware firmware | C++ / Arduino | Programs the ESP32 boards |
| Hardware mesh | ESP-NOW | Ultra-fast wireless between boards |
| Cloud messaging | MQTT / HiveMQ | Sends data to and from the internet |
| Main website | Next.js 16 + React 19 | The SaaS customer portal |
| Operator dashboard | Vite + React + Three.js | 3D solar tracker viewer |
| Mobile HUD | SvelteKit + Capacitor | Technician app |
| Voice assistant | Python + FastAPI + Kokoro ONNX | Text-to-speech |
| Computer vision | Python + OpenCV + Roboflow | AI sun detection |
| Database | Supabase (PostgreSQL) | Stores all telemetry |
| Auth | Supabase Auth | User accounts & login |
| Payments | Stripe | Subscriptions |
| Deployment | Vercel | Hosts the website |
| Tunneling | Cloudflare | Exposes local TTS to internet |

---

## 📄 License

See [LICENSE](LICENSE) for details.

## 🤝 Contributing

New to contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for a beginner-friendly guide.

## 🔍 Understanding the Codebase

Want to understand what every file and folder does? Read [CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md).
