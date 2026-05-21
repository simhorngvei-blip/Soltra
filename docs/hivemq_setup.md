# Project Helios — HiveMQ Serverless Setup Protocol
> Phase 5: Cloud Infrastructure Checklist

---

## STEP 1 — Create Your Free Cluster

1. Go to **https://www.hivemq.com/mqtt-cloud-broker/**
2. Click **"Start Free"** → sign up with email (no credit card needed).
3. After login, you land on the **HiveMQ Cloud Console**.
4. Click **"Create New Cluster"** → select **"Serverless"** (Free tier, 100 connections, 10GB traffic/month).
5. Choose a region (e.g., `us-east-1` or nearest to you). Click **"Create Cluster"**.
6. Wait ~30 seconds for provisioning. Status turns **GREEN = ACTIVE**.

---

## STEP 2 — Find Your Connection URLs & Ports

Once the cluster is active, click on its name to open the **Cluster Overview** page.

You will see a panel called **"Connection Settings"**. Copy the following:

| Item | Where to Find | Example Value |
|------|--------------|---------------|
| **MQTT URL** (for Heltec C++) | Field: `Host` | `abc123.s1.eu.hivemq.cloud` |
| **Standard MQTT Port (TLS)** | Field: `MQTT Port` | `8883` |
| **WebSocket URL** (for Web Dashboard) | Field: `Websocket Host` or assemble as `wss://<host>/mqtt` | `wss://abc123.s1.eu.hivemq.cloud/mqtt` |
| **WebSocket Port** | Field: `Websocket Port` | `8884` |

> ⚠️ **IMPORTANT:** HiveMQ Serverless **requires TLS/SSL** on ALL connections.
> - Heltec uses port **8883** with `WiFiClientSecure`.
> - Web dashboard uses **`wss://`** (not `ws://`) on port **8884**.

---

## STEP 3 — Create Credentials (Username & Password)

1. In the Cluster Overview, click the **"Access Management"** tab (left sidebar).
2. Click **"Add New Credentials"**.
3. Enter a **Username** of your choice (e.g., `helios_hub`).
4. Enter a **Password** of your choice. Click **"Save"**.
5. ✅ These are now the credentials for **BOTH** the Heltec firmware AND the web dashboard.

> You can create multiple credential sets for different devices. One set is sufficient for testing.

---

## STEP 4 — Configure Your Topic Structure

No configuration is needed on HiveMQ for topics — they are created on first publish.
Use the following topic plan:

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `helios/telemetry` | Hub → Cloud → Dashboard | Wind, solar yield, panel angle |
| `helios/control/manual` | Dashboard → Cloud → Hub | Integer motor commands (1,2,3,4,5,6) |
| `helios/status` | Hub → Cloud | Connection heartbeat |

---

## STEP 5 — Test Your Connection (Optional but Recommended)

1. In the HiveMQ Console, click **"Web Client"** tab.
2. Connect using your credentials.
3. Subscribe to `helios/#`.
4. You should see messages flowing once the Heltec is flashed and online.

---

## Quick Reference Card (Fill In Your Values)

```
MQTT_HOST     = "XXXXXXXX.s1.eu.hivemq.cloud"
MQTT_PORT     = 8883          (Heltec, TLS)
WSS_URL       = "wss://XXXXXXXX.s1.eu.hivemq.cloud/mqtt"
WSS_PORT      = 8884          (Web Dashboard)
MQTT_USER     = "helios_hub"
MQTT_PASS     = "your_password_here"
```

---
*Protocol Version: Phase 5.0 | Project Helios/SOLTRA*
