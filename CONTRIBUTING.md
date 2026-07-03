# 🤝 Contributing to Soltra

Welcome! Whether you're a student, a hobbyist, or a developer picking this project back up — this guide will show you how to understand and extend Soltra.

> **New to coding?** Don't worry. This guide starts from the very basics and points you to exactly which files to edit for common tasks.

---

## 📚 Before You Start

1. Make sure the project is running locally — follow the steps in [README.md](README.md)
2. Read [CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md) to understand what each folder does
3. Read [SETUP.md](SETUP.md) for detailed hardware flashing instructions

---

## 🏗️ Project Architecture at a Glance

Soltra has two completely separate worlds:

| World | Language | Where the code lives | How you run it |
|-------|----------|----------------------|----------------|
| **Hardware** (the circuit boards) | C++ | `hardware/` | Arduino IDE → Upload to board |
| **Software** (websites + servers) | JavaScript + Python | `software/` | Terminal commands (`npm run dev`, `python server.py`) |

Changing the website does **not** require reflashing the hardware, and vice versa. They are independent.

---

## 🌱 Common Tasks — Where to Make Changes

### "I want to change what the dashboard looks like"

The main customer dashboard lives in:
```
software/soltra-saas/src/app/dashboard/
```

Each subfolder is a page. The UI components (buttons, cards, charts) are in:
```
software/soltra-saas/src/components/
```

**Example:** To change what the homeowner dashboard shows, edit files inside:
```
software/soltra-saas/src/app/dashboard/homeowner/
```

After editing, the browser will automatically refresh (this is called "hot reloading").

---

### "I want to change how Ada speaks / the voice style"

Edit the TTS server:
```
software/soltra-tts/server.py
```

The `/speak` endpoint (around line 150) controls the voice synthesis. You can change the `voice`, `speed`, and `lang` parameters. Available voices are listed in `voices.json`.

To add a new Ada voice profile:
```bash
cd software/soltra-tts
python create_ada_profile.py
```

---

### "I want to add a new sensor reading to the telemetry"

This requires changes in multiple places (hardware → cloud → UI):

1. **Hardware — Sensor Node** (`hardware/soltra-sensor-node/soltra_sensor_node.ino`):
   - Read the new sensor value
   - Add it to the `SensorData` struct that gets sent over ESP-NOW

2. **Hardware — Master Hub** (`hardware/soltra-master-hub/soltra_master_hub.ino`):
   - Update the struct that receives data from sensor nodes
   - Include the new field in the MQTT/HTTP telemetry payload

3. **Database** (`software/soltra-saas/supabase/master_schema.sql`):
   - Add a new column to the `telemetry` table (or relevant table)
   - Run the SQL `ALTER TABLE` command in Supabase SQL Editor

4. **Backend** (`software/soltra-saas/src/app/api/telemetry/ingest/route.ts`):
   - Parse the new field from the incoming POST request
   - Write it to the Supabase database

5. **Frontend** (`software/soltra-saas/src/app/dashboard/`):
   - Add a new chart or display card for the new sensor value

---

### "I want to change how the panel tracks the sun (the algorithm)"

The sun tracking logic in the Master Hub is in:
```
hardware/soltra-master-hub/soltra_master_hub.ino
```

Search for the function `calculateSunPosition()` or `computeTargetAngles()`. The algorithm uses:
- **GPS coordinates** (latitude/longitude) — configured as constants at the top of the file
- **Current date/time** — read from an RTC (real-time clock) module
- **Astronomical ephemeris formulas** — math that calculates the sun's azimuth and elevation angle for any location and time

The computer vision override (which can correct the algorithm based on what the camera sees) is in:
```
software/soltra-cv/sun_tracker.py
```

---

### "I want to add a new page to the SaaS website"

In Next.js, creating a new page is as simple as creating a new folder and file:

1. Create a folder under `software/soltra-saas/src/app/` with your page name
2. Inside it, create a file called `page.tsx`
3. Start with this template:

```tsx
export default function MyNewPage() {
  return (
    <div>
      <h1>My New Page</h1>
      <p>Hello, Soltra!</p>
    </div>
  );
}
```

4. Your page is now accessible at `http://localhost:3000/your-page-name`

---

### "I want to send a new command from the website to the hardware"

1. **Add a new API endpoint** in `software/soltra-saas/src/app/api/command/`:
   - Create a folder like `api/command/my-new-command/`
   - Create `route.ts` inside it
   - The endpoint should receive parameters from the UI and publish an MQTT message to HiveMQ

2. **Handle the command in the firmware** (`hardware/soltra-master-hub/soltra_master_hub.ino`):
   - The hub subscribes to MQTT topics — find the `mqttCallback()` function
   - Add a new `if` branch to handle your new command topic
   - Act on it (e.g., change a setting, trigger an action)

3. **Trigger from the UI** — add a button in the relevant dashboard page that calls your new API endpoint.

---

### "I want to change the motor speed or movement limits"

In the motor controller firmware:
```
hardware/soltra-motor-controller/soltra_motor_controller.ino
```

Look for constants defined at the top like:
```cpp
#define MAX_PAN_ANGLE   180
#define MIN_PAN_ANGLE   0
#define MOTOR_SPEED     200  // 0–255 (PWM duty cycle)
```

Adjust and re-flash.

---

## 🌿 Git Workflow — How to Save Your Changes

> **What is Git?** Git is a version control system — it keeps a history of every change you make, so you can always go back if something breaks.

```bash
# 1. See what files you've changed
git status

# 2. Stage your changes (tell Git which ones you want to save)
git add software/soltra-saas/src/app/dashboard/homeowner/page.tsx

# 3. Save them with a description (called a "commit")
git commit -m "Add new UV chart to homeowner dashboard"

# 4. Upload to GitHub
git push
```

**Commit message tips:**
- Start with a verb: `Add`, `Fix`, `Update`, `Remove`
- Be specific: `"Fix motor not responding when UV > 9"` is better than `"fixed bug"`

---

## 🚫 What Not to Change (Unless You Know What You're Doing)

| File/Folder | Why to be careful |
|-------------|-------------------|
| `software/soltra-saas/supabase/master_schema.sql` | Changing the database schema can break all existing data |
| `src/middleware.ts` | Controls authentication — a bug here can lock everyone out |
| `hardware/soltra-master-hub/soltra_master_hub.ino` — WiFi/MQTT section | A bug here means the hub can't connect to the cloud |
| Any `.env*` files | These contain API keys — never share or commit these to GitHub |
| `software/soltra-tts/kokoro-v1.0.onnx` | This is a ~330 MB binary AI model — don't modify it |

---

## 🐛 Debugging Tips

### Debugging hardware (circuit boards)
- In Arduino IDE, open **Tools → Serial Monitor** (set baud rate to `115200`)
- The boards print log messages like `[Hub] Sending telemetry...` or `[ERROR] WiFi failed`
- Look for `[ERROR]` and `[WARN]` tags

### Debugging the SaaS (Next.js)
- The terminal running `npm run dev` shows server-side errors
- Open the browser's Developer Tools (F12 → Console tab) for client-side errors
- Network tab shows all API calls and their responses

### Debugging the Python servers
- `server.py` and `app.py` print logs directly to the terminal
- Check `software/soltra-tts/logs/tts.log` for the TTS server history

### Debugging MQTT (message broker)
- HiveMQ Cloud has a built-in "Web Client" where you can subscribe to topics and see live messages
- Subscribe to `helios/#` to see all Soltra hardware traffic

---

## 📋 Environment Variables Reference

> **What is an environment variable?** It's a secret value stored outside your code — like a password stored in a safe instead of written on a whiteboard. Never commit these to GitHub.

### `software/soltra-saas/.env.local`

| Variable | What it is |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key (safe to expose to browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key — server-side only, keep secret! |
| `HIVEMQ_HOST` | Your HiveMQ cluster hostname |
| `HIVEMQ_USER` | Your HiveMQ username |
| `HIVEMQ_PASS` | Your HiveMQ password |
| `NEXT_PUBLIC_HIVEMQ_HOST` | Same host (for browser-side MQTT) |
| `NEXT_PUBLIC_HIVEMQ_USER` | Same username (for browser-side MQTT) |
| `NEXT_PUBLIC_HIVEMQ_PASS` | Same password (for browser-side MQTT) |
| `TTS_URL` | URL of the TTS server (e.g., `http://localhost:8099` or a Cloudflare tunnel URL) |
| `STRIPE_SECRET_KEY` | Stripe payment processing key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key |
| `TELEMETRY_INGEST_KEY` | A secret key that the hardware must include when posting telemetry — prevents unauthorized data |
| `ROBOFLOW_API_KEY` | API key for Roboflow (computer vision AI) |

### `software/soltra-cv/.env`

| Variable | What it is |
|----------|------------|
| `ROBOFLOW_API_KEY` | API key for Roboflow (computer vision AI) |

---

## 🆘 Getting Help

If you're stuck:
1. Check the [Troubleshooting section in README.md](README.md#️-troubleshooting)
2. Read the error message carefully — it usually tells you exactly what went wrong and which file
3. Search the error message on [Stack Overflow](https://stackoverflow.com) or ask an AI assistant

---

## 📝 Code Style

- **JavaScript/TypeScript:** The project uses ESLint. Run `npm run lint` in any software subfolder to check for style issues.
- **Python:** Follow PEP 8 (Python's standard style guide). Keep functions short and focused.
- **C++ (Arduino):** Keep the `loop()` function short — don't block it with long `delay()` calls. Use `millis()` for timing instead.
- **Comments:** Write comments explaining *why* you did something, not *what* you did (the code itself shows the what).
