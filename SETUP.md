# Soltra — Setup Guide (10–20 Minutes)

> **What you need:** A laptop or PC, an internet connection, and the Soltra hardware kit.  
> **What you'll download:** Arduino IDE (one-time), `cloudflared` (one binary, optional for TTS in production).

---

## Before You Start — Checklist

- [ ] Soltra hardware kit (Master Hub, Motor Controller, Sensor Nodes × 4)
- [ ] PC or laptop with USB-A or USB-C port
- [ ] WiFi network (2.4 GHz)
- [ ] A GitHub account (free)
- [ ] 20 minutes

---

## Step 1 — Cloud Accounts (5 minutes)

Create three free accounts. All are permanently free for this scale.

### 1.1 Supabase (Database)
1. Go to [supabase.com](https://supabase.com) → **Start your project**
2. Sign in with GitHub
3. Click **New project**, choose a name (e.g. `soltra-prod`) and a region close to you
4. **Copy** the following (you'll need them later):
   - `Project URL` → looks like `https://xxxxxx.supabase.co`
   - `anon / public` key → the long string starting with `eyJ`
   - `service_role` key → the other long string (keep this private)
5. Go to **SQL Editor** (left sidebar) → paste the entire contents of `software/soltra-saas/supabase/master_schema.sql` → click **Run**

✅ Done — your database is set up.

### 1.2 HiveMQ Cloud (MQTT Broker)
1. Go to [hivemq.com/mqtt-cloud-broker](https://www.hivemq.com/mqtt-cloud-broker/) → **Get started free**
2. Create an account, then create a **free cluster**
3. Under **Credentials**, click **Add credential** → set a username and password
4. **Copy:**
   - Cluster host (e.g. `xxxxxxxx.s1.eu.hivemq.cloud`)
   - Your username and password

✅ Done — your MQTT broker is ready.

### 1.3 Vercel (Hosting)
1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. You'll connect this to your Soltra repo in Step 3.

---

## Step 2 — Configure the Software (3 minutes)

1. Open the file `software/soltra-saas/.env.local` in any text editor
2. Fill in the values from Step 1:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

HIVEMQ_HOST=xxxxxx.s1.eu.hivemq.cloud
HIVEMQ_USER=your-hivemq-username
HIVEMQ_PASS=your-hivemq-password
NEXT_PUBLIC_HIVEMQ_HOST=xxxxxx.s1.eu.hivemq.cloud
NEXT_PUBLIC_HIVEMQ_USER=your-hivemq-username
NEXT_PUBLIC_HIVEMQ_PASS=your-hivemq-password
```

3. Save the file.
4. Do the same for `software/soltra-dashboard/.env.local` and `software/soltra-hud/.env.local` (only the `VITE_HIVEMQ_*` and `VITE_SUPABASE_*` values).

Also update the firmware:
- Open `hardware/soltra-master-hub/soltra_master_hub.ino`
- Find the `MQTT_HOST`, `MQTT_USER`, `MQTT_PASS` defines and replace with your HiveMQ credentials

---

## Step 3 — Flash the Master Hub (5 minutes)

### Install Arduino IDE (one-time, ~3 min)
1. Download from [arduino.cc/en/software](https://www.arduino.cc/en/software) → choose your OS
2. Install and open it
3. Go to **File → Preferences** → in "Additional boards manager URLs" add:
   ```
   https://resource.heltec.cn/download/package_heltec_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager** → search "Heltec" → install **Heltec ESP32 Series Dev-boards**
5. Install these libraries via **Tools → Manage Libraries**:
   - `PubSubClient`
   - `WiFiManager` by tzapu
   - `Adafruit BME280 Library`
   - `SolarCalculator`
   - `RTC by Makuna` (for DS1302)

### Flash the hub
1. Connect the Heltec Master Hub to your PC via USB
2. Open `hardware/soltra-master-hub/soltra_master_hub.ino` in Arduino IDE
3. Select **Tools → Board → Heltec WiFi LoRa 32 V3**
4. Select the correct **Port** (COM3, COM4, etc.)
5. Click **Upload** (→ arrow button)

✅ Hub is flashed!

---

## Step 4 — Connect the Hub to Your WiFi (2 minutes)

1. Power on the Master Hub
2. On your phone or laptop, connect to the WiFi network: **`Helios-Setup`**
3. A webpage will automatically open (captive portal)
4. Select your home WiFi and enter the password
5. Click **Save** — the hub reboots and connects
6. Open Serial Monitor in Arduino IDE (baud rate 115200) to confirm:
   ```
   [Core0] WiFi OK | IP=192.168.1.xxx | MAC=F0:9E:9E:77:7B:F4 | CH=6
   ```

> **📋 Note down the MAC address** shown — you'll use it in Step 6.

---

## Step 5 — Flash the Motor Controller (3 minutes)

1. Connect the Motor Controller (ESP32 Dev Kit) to your PC via USB
2. In Arduino IDE:
   - **Tools → Board → ESP32 Dev Module**
   - Select the port
3. Open `hardware/soltra-motor-controller/soltra_motor_controller.ino`
4. Find `HUB_MAC` at the top and replace with the MAC address from Step 4:
   ```cpp
   uint8_t HUB_MAC[] = {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4};  // ← your hub MAC
   ```
5. Install library: **Tools → Manage Libraries → MPU6050** by Electronic Cats
6. Click **Upload**
7. Open Serial Monitor — note the **Motor MAC** printed on the first boot line:
   ```
   [SETUP] Motor MAC: 24:6F:28:AA:BB:CC
   ```
8. Open `soltra_master_hub.ino`, find `MOTOR_MAC` and update it:
   ```cpp
   uint8_t MOTOR_MAC[6] = {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0xCC};
   ```
9. Re-upload the hub firmware (Step 3 again, just upload — no other changes)

✅ Hub and motor controller are paired!

---

## Step 6 — Flash the Sensor Nodes (2 minutes each node)

Each sensor node only needs one change — its **Node ID** (1, 2, 3, or 4).

1. Connect Sensor Node to USB
2. Open `hardware/soltra-sensor-node/soltra_sensor_node.ino`
3. Change `NODE_ID` at the top:
   ```cpp
   const int NODE_ID = 1;  // ← 1, 2, 3, or 4 for each board
   ```
4. **Tools → Board → XIAO_ESP32C3** (or your sensor node board)
5. Install library: **Adafruit TSL2591 Library**
6. Click **Upload**
7. On first boot, the node creates a WiFi hotspot: **`Soltra-Node-1-Setup`**
8. Connect your phone, enter your WiFi password — done. The channel is auto-detected and saved.

> Repeat for each of the 4 nodes (change `NODE_ID` each time).

✅ All nodes are online!

---

## Step 7 — Deploy the SaaS to Vercel (3 minutes)

1. Push the Soltra repo to GitHub (if not already):
   ```bash
   git add . && git commit -m "chore: configure env" && git push
   ```
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo
3. Set the **Root Directory** to `software/soltra-saas`
4. Click **Environment Variables** and add every variable from `.env.production.example`:
   - Use your **production** Supabase project (create a separate one for prod)
   - Use the same HiveMQ credentials
   - Leave `TTS_URL` as `http://127.0.0.1:8099` for now (set it in Step 8 for voice)
5. Click **Deploy**

✅ Your SaaS is live at `https://your-project.vercel.app`!

Update the hub firmware's `TELEMETRY_URL` to your Vercel URL:
```cpp
#define TELEMETRY_URL "https://your-project.vercel.app/api/telemetry/ingest"
```

---

## Step 8 — Enable Voice (TTS) via Cloudflare Tunnel (5 minutes, optional)

The voice/TTS feature runs on your PC. Cloudflare Tunnel makes it reachable from the internet for free — no port forwarding, no router config.

### 8.1 Create a Cloudflare Account
1. Go to [cloudflare.com](https://cloudflare.com) → **Sign up** (free, no credit card needed)

### 8.2 Install cloudflared (one binary, ~30 seconds)

**Windows:**
```powershell
winget install --id Cloudflare.cloudflared
```

**macOS:**
```bash
brew install cloudflared
```

**Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 8.3 Start the TTS server
```bash
cd software/soltra-tts
pip install -r requirements.txt

# First time: download the Kokoro model files
# kokoro-v1.0.onnx (~330MB) and voices.json → place in software/soltra-tts/
# Download from: https://github.com/thewh1teagle/kokoro-onnx/releases

python server.py
```

### 8.4 Create the tunnel
In a **new terminal** (keep the server running):
```bash
cloudflared tunnel --url http://localhost:8099
```

Cloudflare prints a URL like:
```
https://unique-random-name.trycloudflare.com
```

### 8.5 Set the TTS URL in Vercel
1. Go to Vercel → your project → **Settings → Environment Variables**
2. Add/update: `TTS_URL = https://unique-random-name.trycloudflare.com`
3. Redeploy (Vercel → **Deployments → Redeploy**)

> **Note:** The free `trycloudflare.com` URL changes every time you restart the tunnel. For a permanent URL, upgrade to a paid Cloudflare plan or use your own domain. For demos and testing, the free URL is perfect.

✅ Voice is live!

---

## Step 9 — Register Your Hardware in the SaaS (2 minutes)

1. Go to your Vercel URL and create an account
2. Click **Add Site** → name your installation location
3. Click **Add Node** → paste the hub's MAC address from Step 4
4. Telemetry should start appearing within 5 seconds

✅ Setup complete!

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Hub won't connect to WiFi | Hold the RESET button for 3 seconds to re-enter captive portal mode |
| Sensor node not sending data | Check hub Serial Monitor for "sensor_offline" status — verify ESP-NOW channel |
| Motor not responding | Check Motor Controller Serial Monitor for `[ESP-NOW] Cmd received` logs |
| TTS 503 error | Make sure `python server.py` is running AND the Cloudflare tunnel is active |
| Telemetry not showing in dashboard | Check `TELEMETRY_INGEST_KEY` matches between firmware and Vercel env var |
| Supabase `unauthorized` errors | Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not the anon key) in Vercel |

---

## What's Running Where

```
Your PC / Laptop
└── soltra-tts (python server.py, port 8099)
└── cloudflared tunnel → Cloudflare → public HTTPS URL

Vercel (free tier)
└── soltra-saas (Next.js, serves your customers)

Supabase (free tier)
└── PostgreSQL database
└── Realtime websocket subscriptions

HiveMQ Cloud (free tier)
└── MQTT broker (all hardware ↔ cloud communication)

Hardware (your home / lab)
└── Master Hub (Heltec) — WiFi + MQTT + ESP-NOW
└── Motor Controller (ESP32) — actuators
└── Sensor Nodes × 4 (XIAO C3) — LDR/UV/IR, deep sleep
└── Camera Node (ESP32-CAM) — MJPEG stream
```

**Total monthly cost: $0.00**
