# Future Mobile Implementation Features

This document outlines the feasibility and "free tier" architecture for implementing additional cloud-connected features into the Soltra HUD mobile application.

## 1. Daily Report & Pre-Cloned Voices
**Feasibility:** 100% possible.
The mobile app relies on a backend `soltra-tts` server (currently connecting via `http://10.0.2.2:8099` during development). Because the heavy AI lifting happens on the server, the mobile app only acts as a thin client that sends text and receives audio.

**How to do it for FREE:**
*   **Self-Hosting:** If the `soltra-tts` server is running open-source models (e.g., Coqui TTS, Piper, XTTS) on your own local hardware, it is permanently free.
*   **API Free Tiers:** If using commercial APIs (like Cartesia or ElevenLabs), they typically offer generous free tiers (~10,000 characters/month) which is more than enough for a daily report prototype.
*   **Implementation Strategy:** Pre-clone 3 distinct voices on the server to generate unique `profile_id`s. During the Daily Report routine, the mobile app sends text to the server tagged with one of those specific `profile_id`s to generate the audio dynamically.

## 2. S3 Camera Picture (Live View)
**Feasibility:** 100% possible.
Since the app runs within a Capacitor WebView, displaying an image from cloud storage is as simple as using an HTML `<img>` tag. A "live view" can be simulated by polling the image URL on an interval with a cache-busting timestamp (e.g., `?t=123456`).

**How to do it for FREE:**
*   **Cloudflare R2 (Recommended Cloud):** Cloudflare's S3 equivalent offers 10 GB of storage and 10 million read requests per month completely free, forever.
*   **Local Image Server (Local Alternative):** If the camera and phone are on the same network (or a free VPN like Tailscale), you can host the camera feed locally from a Raspberry Pi or computer, bypassing the cloud entirely.

## 3. Redirecting Actual Data from the Cloud (MQTT)
**Feasibility:** 100% possible.
The mobile app already includes an `mqttStore.ts` file, meaning it is pre-configured to handle real-time MQTT messaging over WebSockets. This allows for instant push updates (alerts, sensor readings) from the cloud directly to the UI.

**How to do it for FREE:**
*   **HiveMQ Serverless Cloud:** Offers a permanently free tier for up to 100 connected devices and 10GB of data per month. Ideal for prototyping and small-scale deployment.
*   **Oracle Cloud "Always Free" VPS:** Spin up an always-free Oracle cloud server and install an open-source broker like **Eclipse Mosquitto**. This gives you an enterprise-grade, private cloud MQTT broker for $0/month.
