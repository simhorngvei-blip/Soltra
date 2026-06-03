# Project Soltra: Status Report & Engineering Roadmap

**Status:** Active Sprint - Monetization & Go-to-Market

---

## Phase 1: Hardware Decoupling & Diagnostics (COMPLETED)
**Objective:** Transition the physical solar tracker from a monolithic, hardwired system to a modular, wireless edge-network.

* **Legacy Teardown:** We successfully isolated the original DC motors and mechanical chassis, stripping out the legacy Arduino and hardwired L298N logic.
* **Failure Analysis:** We conducted bare-metal PWM tests and successfully diagnosed a burnt H-Bridge channel on the legacy L298N driver, which was causing the Tilt (Motor B) stall.
* **The Hardware Upgrade:** We specified the **Cytron MDD3A** as the modern, high-efficiency solid-state replacement for the motor driver.
* **The "Brain Transplant":** We integrated the **Wemos D1 R32** (ESP32) as a dedicated "Motor Node," perfectly mapping the legacy Arduino form factor to modern 3.3V logic.
* **Sensor Relocation:** We physically moved the MPU6050 (Gyrometer) and RTC from the mechanical tracker to the stationary **Heltec V3 Master Hub**.
* **Wireless Protocol Established:** We architected the ESP-NOW peer-to-peer radio link, allowing the Heltec Hub to calculate solar trajectories and wirelessly broadcast movement commands to the Wemos Motor Node.

---

## Phase 2: SaaS Architecture & Tech Stack Definition (COMPLETED)
**Objective:** Define the software infrastructure required to monetize the hardware for both Residential (B2C) and Agricultural (B2B) markets.

* **The Unified Platform Strategy:** We mapped out a single Next.js application that dynamically serves two distinct user experiences based on role-based access control (`homeowner` vs. `fleet_admin`).
* **Tech Stack Lock-In:**
    * **Frontend:** Next.js (App Router), Tailwind CSS, shadcn/ui.
    * **Real-time Data:** HiveMQ Cloud with `mqtt.js` over WebSockets.
    * **Backend/Auth:** Supabase (PostgreSQL).
    * **Billing:** Stripe.
* **Database Schema Design:** We structured the core relational database to ensure horizontal scalability (`Users` -> `Sites` -> `Nodes` -> `Telemetry`).

---

## Phase 3: The Data Pipeline & Frontend Skeleton (COMPLETED)
**Objective:** Scaffold the Next.js application and establish a live, one-way telemetry link from the hardware to the browser.

* **[COMPLETED] Deliverable 1:** Initialize the Next.js repository using the Antigravity Agent.
* **[COMPLETED] Deliverable 2:** Create the Supabase SQL tables based on our defined schema.
* **[COMPLETED] Deliverable 3:** Write the `useSoltraMqtt.ts` React hook to catch live JSON telemetry (Watts, Volts, Angles) from the Heltec Hub and display it natively in the browser without page reloads.

---

## Phase 4: Security & Access Control (COMPLETED)
**Objective:** Lock down the data perimeter so users can only view and control the hardware assigned to them.

* **Task 1: Supabase Authentication:** Implement the login/registration portal using `@supabase/ssr`.
* **Task 2: Row Level Security (RLS):** Write the strict Postgres SQL policies ensuring a user can only query `Nodes` linked to their specific `site_id`.
* **Task 3: Next.js Route Guards:** Implement Next.js Middleware to automatically redirect unauthorized users away from the `/fleet` or `/homeowner` dashboards.

---

## Phase 5: Bidirectional Command—The Web Joystick (COMPLETED)
**Objective:** Transform the website from a passive monitor into an active remote control.

* **Task 1: Frontend UI:** Build the digital D-Pad and E-Stop buttons using shadcn/ui.
* **Task 2: MQTT Publishing:** Wire the React components to publish motor commands (e.g., `{"cmd": "pan_left", "speed": 255}`) to a specific device topic.
* **Task 3: C++ Firmware Update:** Write the JSON parsing logic for the Heltec Hub so it can catch the web command via MQTT and instantly translate it into an ESP-NOW radio packet for the Cytron driver.

---

## Phase 6: Monetization & Go-to-Market (IN PROGRESS)
**Objective:** Integrate the billing engine and polish the user experience for commercial deployment.

* **Task 1: Stripe Integration:** Build the pricing tiers (Free, Pro, Enterprise SLA) and wire up the Stripe Checkout APIs.
* **Task 2: Webhook Automation:** Create the Next.js API route to catch Stripe payment confirmations and automatically update the user's Supabase `subscription_tier`.
* **Task 3: UX Polish (B2C):** Implement Recharts to visualize historical power generation and convert Wattage into gamified metrics (Money Saved, CO2 Offset).
* **Task 4: UX Polish (B2B):** Finalize the Google Maps API integration for the Fleet Manager satellite overwatch.

---

## Phase 7: AI Integrations & Mobile Deployment (COMPLETED)
**Objective:** Deliver an offline-first AI processing backend for dynamic telemetric reporting and port the operator HUD to Android natively.

* **Task 1: Mobile HUD Porting:** Wrap the SvelteKit operator UI in Capacitor for native Android deployment (`soltra-hud-mobile`).
* **Task 2: AI Voice Architecture:** Develop a local Python microservice (`soltra-tts`) utilizing Kokoro ONNX for high-speed primary TTS and Chatterbox Multilingual for voice cloning.
* **Task 3: Dynamic LLM Reporting:** Wire up local Ollama (`qwen2.5:0.5b`) inside the HUDs to instantly generate Daily Reports from Live MQTT sensor values.
* **Task 4: S3 Sense Integration:** Embed the direct Wi-Fi camera stream from the Seeed Studio XIAO ESP32-S3 Sense node directly into the operator interfaces.
