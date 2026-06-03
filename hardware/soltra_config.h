/*
 * PROJECT SOLTRA — Hardware Configuration Header
 * ================================================
 * Centralised config for all firmware modules.
 * Include this file in each .ino instead of scattering #defines across files.
 *
 * HOW TO USE:
 *   1. Copy this file to the same folder as your .ino sketch.
 *   2. Uncomment either ENV_LOCAL or ENV_PRODUCTION at the top.
 *   3. Fill in the values for your environment.
 *   4. #include "soltra_config.h" at the top of your .ino file.
 *
 * ENV A (LOCAL):   Hub posts telemetry to your PC's Next.js dev server.
 *                  TELEMETRY_URL points to 192.168.x.x:3000
 *
 * ENV B (PRODUCTION): Hub posts to Vercel.
 *                     TELEMETRY_URL points to your-project.vercel.app
 *
 * ⚠️  NEVER commit a file with real credentials to a public git repository.
 *     Keep this file local or add it to your .gitignore.
 */

#pragma once

// ─── ENVIRONMENT SELECT ───────────────────────────────────────────────────────
// Uncomment ONE of the two lines below:

// #define SOLTRA_ENV_LOCAL       // ENV A: posts to local dev server
#define SOLTRA_ENV_PRODUCTION    // ENV B: posts to Vercel (default)

// ─── GPS LOCATION ─────────────────────────────────────────────────────────────
// Used by the Master Hub for ephemeris sun-position calculation.
// Find your coordinates at: maps.google.com → right-click your location
#define LATITUDE  3.140853
#define LONGITUDE 101.693207

// ─── MQTT (HiveMQ Cloud) ──────────────────────────────────────────────────────
// Same credentials for both ENV A and ENV B.
// Get from: console.hivemq.cloud → your cluster → Credentials
#define MQTT_HOST      "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USER      "User_1"
#define MQTT_PASS      "hv8y5S9vFwLDJAP"
#define MQTT_CLIENT_ID "HeliosHub-ESP32-001"

// ─── CAPTIVE PORTAL (WiFiManager) ─────────────────────────────────────────────
// The WiFi hotspot name and password shown during first-boot setup.
#define CAPTIVE_AP   "Helios-Setup"
#define CAPTIVE_PASS "helios2025"

// ─── TELEMETRY INGEST ─────────────────────────────────────────────────────────
#ifdef SOLTRA_ENV_LOCAL
  // Local dev: replace 192.168.x.x with your PC's IP address on the LAN.
  // Find it with: ipconfig (Windows) or ip addr (Linux/macOS)
  #define TELEMETRY_URL "http://192.168.1.100:3000/api/telemetry/ingest"
  #define TELEMETRY_KEY "soltra-ingest-dev-key"
#else
  // Production: your Vercel deployment URL
  #define TELEMETRY_URL "https://soltra-green.vercel.app/api/telemetry/ingest"
  #define TELEMETRY_KEY "soltra-ingest-dev-key"  // ← change to your production secret
#endif

// ─── MOTOR CONTROLLER MAC ADDRESS ─────────────────────────────────────────────
// HOW TO FIND:
//   1. Flash soltra_motor_controller.ino
//   2. Open Serial Monitor (115200 baud)
//   3. Copy the MAC from: [SETUP] Motor MAC: XX:XX:XX:XX:XX:XX
//   4. Replace the 0xFF bytes below with your actual MAC bytes.
//
// Until updated, 0xFF:FF:FF:FF:FF:FF sends to all ESP-NOW devices (broadcast).
#define MOTOR_MAC_ADDR { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF }

// ─── HUB MAC ADDRESS (used by motor controller and sensor nodes) ───────────────
// HOW TO FIND:
//   1. Flash soltra_master_hub.ino and let it connect to WiFi
//   2. Check Serial Monitor for: [Core0] WiFi OK | MAC=XX:XX:XX:XX:XX:XX | CH=N
//   3. Replace the values below with your hub's MAC bytes and channel.
#define HUB_MAC_ADDR { 0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4 }  // ← your hub MAC
#define HUB_WIFI_CHANNEL 6  // ← your hub's WiFi channel (printed on hub boot)

// ─── MQTT TOPICS ──────────────────────────────────────────────────────────────
// Shared across hub, motor controller, and SaaS.
// Do not change unless you also update them in the SaaS useSoltraMqtt.ts.
#define TOPIC_TELEMETRY   "helios/telemetry"
#define TOPIC_CTRL_MANUAL "helios/control/manual"
#define TOPIC_CTRL_AI     "helios/control/ai_override"
#define TOPIC_STATUS      "helios/status"
#define TOPIC_CONFIG      "helios/config/channel"

// ─── TIMING ───────────────────────────────────────────────────────────────────
#define TELEMETRY_PUB_INTERVAL_MS  5000   // How often hub publishes telemetry (ms)
#define DECISION_ENGINE_INTERVAL_MS 1000  // How often hub runs tracking logic (ms)
#define SENSOR_SLEEP_US            2000000ULL  // Sensor node deep sleep (µs) = 2s

// ─── WIND SAFETY ──────────────────────────────────────────────────────────────
// MPU6050 raw acceleration threshold for wind stow trigger.
// Lower = more sensitive. At 18000 ≈ ~2g lateral force.
#define WIND_ACCEL_THRESHOLD 18000

// ─── ISRG Root X1 (Let's Encrypt Root CA) ────────────────────────────────────
// Required for TLS connection to HiveMQ Cloud.
// DO NOT replace — this is the real certificate.
#define ISRG_ROOT_X1 \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"reGCc=\n" \
"-----END CERTIFICATE-----\n"
