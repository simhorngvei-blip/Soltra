// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — MASTER HUB
// Edit this block. Scroll down for the firmware.
// ═════════════════════════════════════════════
//
// STEP 1 — ENVIRONMENT
//   Comment out the line below to switch to PRODUCTION mode.
//   PRODUCTION posts telemetry to Vercel instead of your local PC.
//
// #define ENV_LOCAL   // ← comment out this line for PRODUCTION
//
// STEP 2 — LOCAL PC IP  (only needed when ENV_LOCAL is defined)
//   Find your PC's IP: open PowerShell → type `ipconfig`
//   Look for "IPv4 Address" under your WiFi adapter.
//
#define LOCAL_PC_IP "192.168.1.100"   // ← replace with your PC's IP
//
// STEP 3 — PRODUCTION URL  (only needed when ENV_LOCAL is commented out)
//   After deploying soltra-saas to Vercel, paste your URL here.
//
#define PROD_URL "https://soltra-saas.vercel.app"  // ← your Vercel URL
//
// STEP 4 — INGEST KEY
//   Must match TELEMETRY_INGEST_KEY in your .env.local / Vercel env vars.
//   For production, change this to a strong random secret.
//
#define TELEMETRY_KEY_VALUE "soltra-ingest-prod-key-777"  // ← change in production
//
// STEP 5 — GPS LOCATION  (for sun position calculation)
//   Right-click your location on maps.google.com to copy coordinates.
//
#define LATITUDE  3.140853   // ← your latitude
#define LONGITUDE 101.693207 // ← your longitude
//
//
// STEP 6 — LDR TEST MODE (INDOORS/RAINY DAY)
//   Change this to 1 to force the tracker to use the LDR light sensors
//   and ignore Ephemeris/Sun-position, Night-time reset, and Low-light standby.
//   Useful for testing auto-tracking with a flashlight indoors.
//
#define FORCE_LDR_TEST_MODE 0
//
// STEP 7 — EPHEMERIS TOGGLE
//   Change this to false to permanently disable Ephemeris (Sun-position) tracking fallback.
//   You can also toggle this at runtime via MQTT ("ephemeris_on" / "ephemeris_off").
//
#define ENABLE_EPHEMERIS false
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

/*
 * PROJECT SOLTRA — Heltec WiFi LoRa 32 V3 (ESP32-S3)
 * Master Hub Firmware
 *
 * ─── ZERO-CONFIGURATION SETUP ────────────────────────────────────────────────
 * WiFi:  Connect to "Helios-Setup" hotspot → enter your WiFi password.
 *        Device reboots and connects. Done.
 *
 * Motor: Flash motor controller, copy MAC from Serial Monitor,
 *        paste into STEP 5 above, re-flash hub once.
 *
 * Env:   Toggle ENV_LOCAL (STEP 1) to switch between local dev and cloud.
 * ──────────────────────────────────────────────────────────────────────
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <Wire.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <ArduinoOTA.h>
#include <Adafruit_BME280.h>
// SolarCalculator replaced with inline implementation — no library needed
#include <Preferences.h>
#include <HTTPUpdate.h>

// ─── Resolve ENV to concrete values ───────────────────────────────────────────────
#ifdef ENV_LOCAL
  #define TELEMETRY_URL  "http://" LOCAL_PC_IP ":3000/api/telemetry/ingest"
#else
  #define TELEMETRY_URL  PROD_URL "/api/telemetry/ingest"
#endif
#define TELEMETRY_KEY TELEMETRY_KEY_VALUE

// ─── MQTT BROKER (HiveMQ Cloud — same for local and production) ─────────────────
#define MQTT_HOST      "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USER      "User_1"
#define MQTT_PASS      "hv8y5S9vFwLDJAP"
#define MQTT_CLIENT_ID "HeliosHub-ESP32-001"

// ─── WiFi captive portal ──────────────────────────────────────────────────────
#define CAPTIVE_AP   "Helios-Setup"
#define CAPTIVE_PASS "helios2025"

uint8_t MOTOR_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ─── OTA UPDATE URL ──────────────────────────────────────────────────────────
#ifdef ENV_LOCAL
  #define OTA_URL "http://" LOCAL_PC_IP ":3000/api/firmware/update?type=master-hub"
#else
  #define OTA_URL PROD_URL "/api/firmware/update?type=master-hub"
#endif

// ─── MQTT TOPICS ─────────────────────────────────────────────────────────────
#define TOPIC_TELEMETRY   "helios/telemetry"
#define TOPIC_CTRL_MANUAL "helios/control/manual"
#define TOPIC_CTRL_AI     "helios/control/ai_override"
#define TOPIC_STATUS      "helios/status"

// ─── ISRG Root X1 Certificate (Let's Encrypt root CA) ────────────────────────
// HiveMQ Cloud uses Let's Encrypt TLS certificates signed by ISRG Root X1.
// This is the real, valid certificate — DO NOT replace with anything else.
const char* root_ca = \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"reGCc=\n" \
"-----END CERTIFICATE-----\n";

const unsigned long PUB_INTERVAL  = 5000;
const unsigned long DEC_INTERVAL  = 1000;
const int           WIND_THRESH   = 4000; // Adjusted for high-pass delta filtering

// ─── HARDWARE PINS (Heltec V3 ESP32-S3 Safe Pins) ────────────────────────────
#define VEXT_PIN 36
#define I2C_SDA  41
#define I2C_SCL  42
#define MPU_ADDR 0x68

ThreeWire myWire(5, 6, 4);  // DAT, CLK, RST
RtcDS1302<ThreeWire> Rtc(myWire);
Adafruit_BME280 bme;

Preferences prefs;  // NVS storage for persisted config

volatile float g_humidity = 0.0f;

// ─── SHARED STATE (mutex-protected) ──────────────────────────────────────────
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

volatile int16_t g_max_vib = 0;
volatile float   g_watts     = 847.3f;
volatile float   g_volts     = 240.2f;
volatile float   g_pan_angle = 184.2f;
volatile float   g_tilt_angle = 45.0f;
volatile float   g_irradiance = 0.0f;
volatile int     g_ldr_values[4] = {0, 0, 0, 0};
volatile uint32_t g_node_lux[4]  = {0, 0, 0, 0};
volatile float   g_node_uv[4]   = {0, 0, 0, 0};
volatile float   g_node_bat[4]  = {0, 0, 0, 0};
volatile uint32_t g_lux = 0;
volatile float   g_battery_v = 0.0f;
volatile float   g_uv_index = 0.0f;
volatile bool    g_online = false;
volatile bool    g_wind   = false;
volatile int     g_hour   = 0;
volatile float   g_ws     = 12.4f;
volatile char    g_status[24]  = "booting";
volatile unsigned long g_manual_timeout = 0;
volatile bool    g_ai_override = false;
volatile char    g_ai_mode[16] = "";
volatile bool    g_ephemeris_enabled = ENABLE_EPHEMERIS;

// ─── Mobile app workaround state ─────────────────────────────────────────────
volatile unsigned long g_auto_stop_pan = 0;
volatile unsigned long g_auto_stop_tilt = 0;
volatile unsigned long g_last_start_pan = 0;
volatile unsigned long g_last_start_tilt = 0;

// ─── ESP-NOW PACKETS ─────────────────────────────────────────────────────────
typedef struct {
  int node_id;
  int ldr_value;
  float uv_index;
  float ir_ratio;
  uint32_t lux;
  float battery_v;
} SensorPkt;

typedef struct {
  int command;
} MotorPkt;

typedef struct {
  float pan_angle;
  float tilt_angle;
} MotorTelemetryPkt;

typedef struct {
  uint8_t magic; // 0x99
  uint8_t device_type; // 5
  float pan_delta;
  float tilt_delta;
} CameraAIPkt;

typedef struct {
  uint8_t magic; // 0x99
  uint8_t device_type; // 0=Motor, 1..4=Sensor, 5=Camera
} PairingReqPkt;

typedef struct {
  uint8_t magic; // 0xAA
  uint8_t channel;
} PairingAckPkt;

SensorPkt       rxPkt;
MotorPkt        txPkt;
MotorTelemetryPkt rxMotorPkt;

// ─── MQTT / TLS ───────────────────────────────────────────────────────────────
WiFiClientSecure tlsClient;
PubSubClient     mqtt(tlsClient);

void connectMQTT();
void publishTelemetry();
void routeMotor(int cmd);

// ─── ESP-NOW CALLBACKS ───────────────────────────────────────────────────────
void onRecv(const esp_now_recv_info* info, const uint8_t* data, int len) {
  if (len == sizeof(PairingReqPkt) && data[0] == 0x99) {
    PairingReqPkt req; memcpy(&req, data, sizeof(req));
    Serial.printf("[PAIRING] Request from type %d\n", req.device_type);
    
    // Add the sender as a peer so we can reply with an ACK
    if (!esp_now_is_peer_exist(info->src_addr)) {
      esp_now_peer_info_t p = {};
      memcpy(p.peer_addr, info->src_addr, 6);
      p.channel = WiFi.channel();
      p.encrypt = false;
      esp_now_add_peer(&p);
    }

    // If it's a motor controller, save its MAC for telemetry routing
    if (req.device_type == 0) {
      memcpy(MOTOR_MAC, info->src_addr, 6);
      prefs.begin("soltra", false);
      prefs.putBytes("motor_mac", MOTOR_MAC, 6);
      prefs.end();
      Serial.println("[PAIRING] Motor Controller paired!");
    }

    // Send ACK back
    PairingAckPkt ack = {0xAA, WiFi.channel()};
    esp_now_send(info->src_addr, (uint8_t*)&ack, sizeof(ack));
    return;
  }

  if (len == sizeof(SensorPkt)) {
    memcpy(&rxPkt, data, sizeof(rxPkt));
    portENTER_CRITICAL_ISR(&mux);
    if (rxPkt.node_id >= 1 && rxPkt.node_id <= 4) {
      int idx = rxPkt.node_id - 1;
      g_ldr_values[idx] = rxPkt.ldr_value;
      g_node_lux[idx]   = rxPkt.lux;
      g_node_uv[idx]    = rxPkt.uv_index;
      g_node_bat[idx]   = rxPkt.battery_v;
    }
    // Use node 1 as the primary irradiance/lux source (or aggregate)
    g_irradiance = (float)rxPkt.lux * 0.0079f;
    g_lux = rxPkt.lux;
    g_battery_v = rxPkt.battery_v;
    g_uv_index = rxPkt.uv_index;
    g_online = true;
    portEXIT_CRITICAL_ISR(&mux);
  } else if (len == sizeof(MotorTelemetryPkt)) {
    memcpy(&rxMotorPkt, data, sizeof(rxMotorPkt));
    portENTER_CRITICAL_ISR(&mux);
    g_pan_angle  = rxMotorPkt.pan_angle;
    g_tilt_angle = rxMotorPkt.tilt_angle;
    portEXIT_CRITICAL_ISR(&mux);
  } else if (len == sizeof(CameraAIPkt) && data[0] == 0x99 && data[1] == 5) {
    CameraAIPkt aiPkt;
    memcpy(&aiPkt, data, sizeof(aiPkt));
    portENTER_CRITICAL_ISR(&mux);
    g_ai_override = true;
    strncpy((char*)g_ai_mode, "EDGE_AI", 15);
    g_manual_timeout = millis() + 5000;
    portEXIT_CRITICAL_ISR(&mux);
    
    // We send pan/tilt directly just like the MQTT callback does
    bool pan_right  = aiPkt.pan_delta  >  0.1f;
    bool pan_left   = aiPkt.pan_delta  < -0.1f;
    bool tilt_up    = aiPkt.tilt_delta >  0.1f;
    bool tilt_down  = aiPkt.tilt_delta < -0.1f;

    if (pan_right) routeMotor(0); else if (pan_left) routeMotor(1); else routeMotor(2);
    if (tilt_up)   routeMotor(3); else if (tilt_down) routeMotor(4); else routeMotor(5);
  }
}

void onSent(const wifi_tx_info_t* info, esp_now_send_status_t s) {}

// ─── MQTT CALLBACK ───────────────────────────────────────────────────────────
void mqttCb(char* topic, byte* payload, unsigned int len) {
  if (len == 0) return;

  if (strcmp(topic, TOPIC_CTRL_AI) == 0) {
    char payloadStr[len + 1];
    memcpy(payloadStr, payload, len);
    payloadStr[len] = '\0';
    String msg = String(payloadStr);

    // ── Keyword mode (legacy: "ephemeris", "stow", "auto") ──────────────────
    if (msg.indexOf("stow") >= 0) {
      portENTER_CRITICAL_ISR(&mux);
      g_ai_override = true;
      strncpy((char*)g_ai_mode, "stow", 15);
      portEXIT_CRITICAL_ISR(&mux);
      Serial.println("[MQTT] AI Mode: STOW");
      return;
    }
    if (msg.indexOf("auto") >= 0 && msg.indexOf("CV_SUN_TRACK") < 0) {
      portENTER_CRITICAL_ISR(&mux);
      g_ai_override = false;
      portEXIT_CRITICAL_ISR(&mux);
      Serial.println("[MQTT] AI Mode: AUTO (ephemeris)");
      return;
    }
    if (msg.indexOf("ephemeris_off") >= 0) {
      g_ephemeris_enabled = false;
      Serial.println("[MQTT] Ephemeris Disabled");
      return;
    }
    if (msg.indexOf("ephemeris_on") >= 0) {
      g_ephemeris_enabled = true;
      Serial.println("[MQTT] Ephemeris Enabled");
      return;
    }

    // ── CV Sun Tracker: parse pan_delta / tilt_delta from sun_tracker.py ────
    // Payload format: {"mode":"CV_SUN_TRACK","pan_delta":1.5,"tilt_delta":-0.8,...}
    if (msg.indexOf("CV_SUN_TRACK") >= 0) {
      // Extract pan_delta
      float pan_delta  = 0.0f;
      float tilt_delta = 0.0f;

      int pan_idx = msg.indexOf("\"pan_delta\":");
      if (pan_idx >= 0) pan_delta = msg.substring(pan_idx + 12).toFloat();

      int tilt_idx = msg.indexOf("\"tilt_delta\":");
      if (tilt_idx >= 0) tilt_delta = msg.substring(tilt_idx + 13).toFloat();

      bool pan_right  = pan_delta  >  0.1f;
      bool pan_left   = pan_delta  < -0.1f;
      bool tilt_up    = tilt_delta >  0.1f;
      bool tilt_down  = tilt_delta < -0.1f;

      portENTER_CRITICAL_ISR(&mux);
      g_ai_override = true;
      strncpy((char*)g_ai_mode, "CV_SUN_TRACK", 15);
      portEXIT_CRITICAL_ISR(&mux);
      g_manual_timeout = millis() + 1000; // auto-stop after 1s if no new CV cmd

      // Dispatch sequentially: prioritize Pan.
      if (pan_right || pan_left) {
        if (pan_right) routeMotor(5);
        else routeMotor(4);
        delay(300);    // Hold movement
        routeMotor(6); // Stop pan
        delay(500);    // Wait for system to settle
      } else if (tilt_up || tilt_down) {
        if (tilt_up) routeMotor(1);
        else routeMotor(2);
        delay(300);    // Hold movement
        routeMotor(3); // Stop tilt
        delay(500);    // Wait for system to settle
      } else {
        routeMotor(9); // Stop all
      }

      Serial.printf("[CV] pan=%.2f tilt=%.2f\n", pan_delta, tilt_delta);
      return;
    }

    Serial.printf("[MQTT] AI Override: unknown payload: %s\n", payloadStr);
    return;
  }


  char msg[8];
  memcpy(msg, payload, min((int)len, 7));
  msg[min((int)len, 7)] = '\0';
  int cmd = atoi(msg);
  if (strcmp(topic, TOPIC_CTRL_MANUAL) == 0 && cmd >= 1 && cmd <= 9) {
    Serial.printf("[MQTT] Manual cmd: %d → motor\n", cmd);
    g_manual_timeout = millis() + 60000;

    // WORKAROUND: The mobile app either sends a STOP command (3 or 6) immediately
    // or fails to send it at all due to its disabled-button logic on touchscreens.
    // We enforce a minimum movement duration of 600ms and ignore rapid stops.
    unsigned long now = millis();
    if (cmd == 1 || cmd == 2) {
      g_last_start_tilt = now;
      g_auto_stop_tilt = now + 600;
    } else if (cmd == 4 || cmd == 5) {
      g_last_start_pan = now;
      g_auto_stop_pan = now + 600;
    } else if (cmd == 3) {
      if (now - g_last_start_tilt < 400) {
        Serial.println("[MQTT] Ignoring rapid STOP tilt (mobile app bug workaround)");
        return;
      }
      g_auto_stop_tilt = 0;
    } else if (cmd == 6) {
      if (now - g_last_start_pan < 400) {
        Serial.println("[MQTT] Ignoring rapid STOP pan (mobile app bug workaround)");
        return;
      }
      g_auto_stop_pan = 0;
    } else if (cmd == 9) {
      g_auto_stop_tilt = 0;
      g_auto_stop_pan = 0;
    }

    routeMotor(cmd);
  }
}

// ─── ROUTE MOTOR CMD ─────────────────────────────────────────────────────────
// BUG 2 FIX: Dedup guard is now timeout-aware.
// Same command is suppressed only within DEDUP_MS of the previous send.
// This allows a stop command to retry on the next decision-engine cycle
// if the first packet was lost over ESP-NOW — preventing runaway motor.
void routeMotor(int cmd) {
  static int last_pan_cmd   = -1;
  static int last_tilt_cmd  = -1;
  static unsigned long last_pan_time  = 0;
  static unsigned long last_tilt_time = 0;
  const unsigned long DEDUP_MS = 900; // Suppress repeats only within 900ms
  
  // SOFT CAP: Prevent continuous twitching by rate-limiting direction changes
  // STOP commands (3, 6, 9) are always allowed instantly for safety.
  const unsigned long SOFT_CAP_MS = 1000;
  static unsigned long last_pan_change  = 0;
  static unsigned long last_tilt_change = 0;

  unsigned long now_ms = millis();

  bool is_pan = (cmd == 4 || cmd == 5 || cmd == 6);
  bool is_tilt = (cmd == 1 || cmd == 2 || cmd == 3);
  bool is_stop = (cmd == 3 || cmd == 6 || cmd == 9);

  // Sequential Movement Enforcement: Stop the other axis before moving
  if (is_pan && !is_stop && last_tilt_cmd != 3) {
    txPkt.command = 3;
    esp_now_send(MOTOR_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
    // Serial.println("[ESP-NOW] Sequential lock: Tilt STOP forced");
    last_tilt_cmd = 3;
    last_tilt_time = now_ms;
    delay(50);
  } else if (is_tilt && !is_stop && last_pan_cmd != 6) {
    txPkt.command = 6;
    esp_now_send(MOTOR_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
    // Serial.println("[ESP-NOW] Sequential lock: Pan STOP forced");
    last_pan_cmd = 6;
    last_pan_time = now_ms;
    delay(50);
  }

  if (is_pan) {
    if (cmd == last_pan_cmd && (now_ms - last_pan_time) < DEDUP_MS) return; // Dedup
    if (!is_stop && cmd != last_pan_cmd && (now_ms - last_pan_change) < SOFT_CAP_MS) {
      cmd = 6; // Force STOP during the cooldown period instead of continuing old movement
      is_stop = true;
    }
    if (cmd != last_pan_cmd) last_pan_change = now_ms;
    last_pan_cmd  = cmd;
    last_pan_time = now_ms;
  } else if (is_tilt) {
    if (cmd == last_tilt_cmd && (now_ms - last_tilt_time) < DEDUP_MS) return; // Dedup
    if (!is_stop && cmd != last_tilt_cmd && (now_ms - last_tilt_change) < SOFT_CAP_MS) {
      cmd = 3; // Force STOP during the cooldown period instead of continuing old movement
      is_stop = true;
    }
    if (cmd != last_tilt_cmd) last_tilt_change = now_ms;
    last_tilt_cmd  = cmd;
    last_tilt_time = now_ms;
  } else if (cmd == 9) {
    last_pan_cmd = 6; last_pan_time = now_ms; last_pan_change = now_ms;
    last_tilt_cmd = 3; last_tilt_time = now_ms; last_tilt_change = now_ms;
  }

  if (cmd == 1 || cmd == 2 || cmd == 4 || cmd == 5) {
    int stopCmd = (cmd == 1 || cmd == 2) ? 3 : 6;
    Serial.printf("[ESP-NOW] Over-the-air soft start for cmd %d...\n", cmd);
    for (int i = 0; i < 3; i++) {
      txPkt.command = cmd;
      esp_now_send(MOTOR_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
      delay(15 + i * 10); // Increasing ON duration: 15ms, 25ms, 35ms
      txPkt.command = stopCmd;
      esp_now_send(MOTOR_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
      delay(10); // 10ms OFF duration
    }
  }

  txPkt.command = cmd;
  esp_err_t r = esp_now_send(MOTOR_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
  Serial.printf("[ESP-NOW] Motor cmd %d → %s\n", cmd, r == ESP_OK ? "OK" : "FAIL");
}

// ─── CONNECT MQTT ─────────────────────────────────────────────────────────────
void connectMQTT() {
  int tries = 0;
  while (!mqtt.connected() && tries < 5) {
    Serial.printf("[MQTT] Connecting to %s ... ", MQTT_HOST);
    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("CONNECTED!");
      mqtt.subscribe(TOPIC_CTRL_MANUAL);
      mqtt.subscribe(TOPIC_CTRL_AI);
      mqtt.publish(TOPIC_STATUS, "{\"status\":\"online\"}");
    } else {
      Serial.printf("FAILED rc=%d, retry in 3s\n", mqtt.state());
      vTaskDelay(3000 / portTICK_PERIOD_MS);
      tries++;
    }
  }
}

// ─── PUBLISH TELEMETRY ────────────────────────────────────────────────────────
void publishTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[MQTT] ERR: WiFi not connected");
    return;
  }

  float ws, wa_watts, vo_volts, pa_pan, ta_tilt, hum;
  uint32_t rx_lux;
  float rx_bat_v, rx_uv;
  bool wa, no_;
  char st[24];

  portENTER_CRITICAL(&mux);
  ws = g_ws; wa_watts = g_watts; vo_volts = g_volts;
  pa_pan = g_pan_angle; ta_tilt = g_tilt_angle;
  hum = g_humidity;
  rx_lux = g_lux; rx_bat_v = g_battery_v; rx_uv = g_uv_index;
  wa = g_wind; no_ = g_online;
  uint16_t ldr_t = g_ldr_values[0], ldr_r = g_ldr_values[1], ldr_b = g_ldr_values[2], ldr_l = g_ldr_values[3];
  // Per-node full readings
  uint32_t n_lux[4];  float n_uv[4]; float n_bat[4]; int n_ldr[4];
  for (int i = 0; i < 4; i++) {
    n_lux[i] = g_node_lux[i]; n_uv[i] = g_node_uv[i];
    n_bat[i] = g_node_bat[i]; n_ldr[i] = g_ldr_values[i];
  }
  strncpy(st, (const char*)g_status, 24);
  portEXIT_CRITICAL(&mux);

  String mac = WiFi.macAddress();
  mac.toUpperCase();

  int battery_pct = 0;
  if (rx_bat_v >= 4.2f) battery_pct = 100;
  else if (rx_bat_v <= 3.3f) battery_pct = 0;
  else battery_pct = (int)((rx_bat_v - 3.3f) / (4.2f - 3.3f) * 100.0f);

  float irradiance_wm2 = (float)rx_lux * 0.0079f;

  char buf[900];
  snprintf(buf, sizeof(buf),
    "{\"node_mac\":\"%s\",\"battery_pct\":%d,\"uv_index\":%.1f,\"lux\":%u,"
    "\"irradiance_wm2\":%.1f,\"humidity_pct\":%.1f,\"power_watts\":%.1f,\"panel_volts\":%.1f,"
    "\"wind_speed_ms\":%.1f,\"wind_alert\":%s,\"pan_angle_deg\":%.1f,\"tilt_angle_deg\":%.1f,"
    "\"ldr_top\":%u,\"ldr_right\":%u,\"ldr_bottom\":%u,\"ldr_left\":%u,"
    "\"nodes\":[{\"id\":1,\"ldr\":%d,\"lux\":%u,\"uv\":%.1f,\"bat\":%.2f},"
    "{\"id\":2,\"ldr\":%d,\"lux\":%u,\"uv\":%.1f,\"bat\":%.2f},"
    "{\"id\":3,\"ldr\":%d,\"lux\":%u,\"uv\":%.1f,\"bat\":%.2f},"
    "{\"id\":4,\"ldr\":%d,\"lux\":%u,\"uv\":%.1f,\"bat\":%.2f}],"
    "\"status\":\"%s\"}",
    mac.c_str(), battery_pct, rx_uv, rx_lux,
    irradiance_wm2, hum, wa_watts, vo_volts,
    ws, wa ? "true" : "false", pa_pan, ta_tilt,
    ldr_t, ldr_r, ldr_b, ldr_l,
    n_ldr[0], n_lux[0], n_uv[0], n_bat[0],
    n_ldr[1], n_lux[1], n_uv[1], n_bat[1],
    n_ldr[2], n_lux[2], n_uv[2], n_bat[2],
    n_ldr[3], n_lux[3], n_uv[3], n_bat[3],
    st);

  Serial.print("[MQTT] TX → "); Serial.println(buf);

  // Publish to HiveMQ (live dashboard)
  if (mqtt.connected()) mqtt.publish(TOPIC_TELEMETRY, buf);

  // POST to Next.js API (persistent storage in Supabase)
  WiFiClientSecure httpClient;
  httpClient.setInsecure(); // For HTTPS without cert pinning on HTTP posts
  HTTPClient http;
  http.begin(httpClient, TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + TELEMETRY_KEY);
  int code = http.POST(buf);
  Serial.printf("[HTTP] Ingest response: %d\n", code);
  http.end();
}

// ─── DECISION ENGINE (Core 1) ────────────────────────────────────────────────
void pollVibration() {
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  int16_t x = Wire.read() << 8 | Wire.read();
  int16_t y = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();
  
  static int16_t avg_x = x;
  static int16_t avg_y = y;
  
  // High-pass filter: subtract low-pass (gravity) from raw reading
  avg_x = (avg_x * 7 + x) / 8;
  avg_y = (avg_y * 7 + y) / 8;
  
  int16_t dx = abs(x - avg_x);
  int16_t dy = abs(y - avg_y);
  int16_t vib = (dx > dy) ? dx : dy;
  
  portENTER_CRITICAL(&mux);
  if (vib > g_max_vib) g_max_vib = vib;
  portEXIT_CRITICAL(&mux);
}

// ─── INLINE SOLAR POSITION (no external library needed) ─────────────────────
void calcSolarPosition(int year, int month, int day, int hour, int minute, int second,
                       double lat, double lon, double &azimuth, double &elevation) {
  int a = (14 - month) / 12;
  int y = year + 4800 - a;
  int m = month + 12 * a - 3;
  double JD = day + (153*m+2)/5 + 365*y + y/4 - y/100 + y/400 - 32045;
  JD += (hour - 12) / 24.0 + minute / 1440.0 + second / 86400.0;
  double T  = (JD - 2451545.0) / 36525.0;
  double L0 = fmod(280.46646 + 36000.76983 * T, 360.0);
  double M  = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG_TO_RAD;
  double C  = (1.914602 - 0.004817*T - 0.000014*T*T)*sin(M)
            + (0.019993 - 0.000101*T)*sin(2*M)
            + 0.000289*sin(3*M);
  double lam = fmod(L0 + C - 0.00569 - 0.00478*sin((125.04-1934.136*T)*DEG_TO_RAD), 360.0) * DEG_TO_RAD;
  double eps = (23.439291 - 0.013004*T) * DEG_TO_RAD;
  double dec = asin(sin(eps)*sin(lam));
  double RA  = atan2(cos(eps)*sin(lam), cos(lam)) * RAD_TO_DEG;
  if (RA < 0) RA += 360.0;
  double GMST = fmod(280.46061837 + 360.98564736629*(JD-2451545.0) + 0.000387933*T*T, 360.0);
  if (GMST < 0) GMST += 360.0;
  double HA = fmod(GMST + lon - RA, 360.0);
  if (HA > 180) HA -= 360.0; if (HA < -180) HA += 360.0;
  HA *= DEG_TO_RAD;
  double latR = lat * DEG_TO_RAD;
  double sinAlt = sin(latR)*sin(dec) + cos(latR)*cos(dec)*cos(HA);
  elevation = asin(constrain(sinAlt, -1.0, 1.0)) * RAD_TO_DEG;
  double cosAz = (sin(dec) - sin(latR)*sinAlt) / (cos(latR)*cos(asin(constrain(sinAlt,-1.0,1.0))));
  azimuth = acos(constrain(cosAz, -1.0, 1.0)) * RAD_TO_DEG;
  if (sin(HA) > 0) azimuth = 360.0 - azimuth;
}

void decisionEngine() {
  RtcDateTime now = Rtc.GetDateTime();
  // pollVibration() is called continuously by radioTask
  g_humidity = bme.readHumidity();

  double sun_azimuth = 0.0, sun_elevation = 0.0;
  calcSolarPosition(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), 0,
                    LATITUDE, LONGITUDE, sun_azimuth, sun_elevation);

  int current_vib = 0;
  
  portENTER_CRITICAL(&mux);
  current_vib = g_max_vib;
  bool wind = (current_vib > WIND_THRESH);
  g_max_vib = 0; // Reset peak detector for the next interval
  int  hr   = now.Hour();
  g_wind = wind; g_hour = hr;
  g_ws = (float)current_vib / 150.0f; // Scale raw vibration down to a dashboard-friendly "m/s" number

  // BUG 4 FIX: Capture raw per-node LDR values alongside averaged groups
  // so we can log them and verify deltas are crossing the threshold.
  int n0 = g_ldr_values[0]; // Node 1 — top-left
  int n1 = g_ldr_values[1]; // Node 2 — top-right
  int n2 = g_ldr_values[2]; // Node 3 — bottom-left
  int n3 = g_ldr_values[3]; // Node 4 — bottom-right

  int left_ldr   = (n0 + n2) / 2;  // Nodes 1 + 3
  int right_ldr  = (n1 + n3) / 2;  // Nodes 2 + 4
  int top_ldr    = (n0 + n1) / 2;  // Nodes 1 + 2
  int bottom_ldr = (n2 + n3) / 2;  // Nodes 3 + 4

  bool manual_override = (millis() < g_manual_timeout);
  bool ai_over = g_ai_override;
  char ai_md[16];
  if (ai_over) strncpy(ai_md, (const char*)g_ai_mode, 15);

  bool use_ephemeris = false;
  bool is_stow = false;
  bool is_standby = false;

  if (FORCE_LDR_TEST_MODE) {
    strncpy((char*)g_status, "ldr_test_mode", 24);
    use_ephemeris = false;
    // BUG 4 FIX: In test mode, if no node has sent yet, show a clear warning
    // instead of silently failing. g_online will be true once any node sends.
    if (!g_online) {
      strncpy((char*)g_status, "ldr_test_no_nodes", 24);
    }
  } else if (wind || (ai_over && strcmp(ai_md, "stow") == 0)) {
    strncpy((char*)g_status, ai_over ? "ai_stow" : "wind_stow", 24);
    is_stow = true;
  } else if (manual_override) {
    strncpy((char*)g_status, "manual_override", 24);
  } else if (hr >= 19 || hr < 7) {
    strncpy((char*)g_status, "night_reset", 24);
  } else if (!g_online) {
    strncpy((char*)g_status, "sensor_offline", 24);
  } else if (g_irradiance < 10.0 && !ai_over) {
    strncpy((char*)g_status, "low_light_standby", 24);
    is_standby = true;
  } else if (ai_over && strcmp(ai_md, "ephemeris") == 0) {
    if (g_ephemeris_enabled) {
      use_ephemeris = true;
      strncpy((char*)g_status, "ai_ephemeris", 24);
    } else {
      strncpy((char*)g_status, "tracking", 24);
    }
  } else {
    if (g_ephemeris_enabled && abs(g_pan_angle - sun_azimuth) > 15.0 && g_irradiance < 300.0) {
      use_ephemeris = true;
      strncpy((char*)g_status, "ephemeris_fb", 24);
    } else {
      strncpy((char*)g_status, "tracking", 24);
    }
  }
  portEXIT_CRITICAL(&mux);

  if (is_stow || is_standby) {
    routeMotor(6); delay(20); routeMotor(3);
  } else if (!is_stow && !is_standby && g_online && !manual_override && (FORCE_LDR_TEST_MODE || (hr >= 7 && hr < 19))) {
    int threshold = 350;
    if (use_ephemeris) {
      bool pan_needs_move = false;
      if (sun_azimuth > g_pan_angle + 2.0)       { routeMotor(5); pan_needs_move = true; }
      else if (sun_azimuth < g_pan_angle - 2.0)  { routeMotor(4); pan_needs_move = true; }

      if (!pan_needs_move) {
        if (sun_elevation > g_tilt_angle + 2.0) {
          routeMotor(1);
          delay(300); routeMotor(3); delay(500);
        } else if (sun_elevation < g_tilt_angle - 2.0) {
          routeMotor(2);
          delay(300); routeMotor(3); delay(500);
        } else {
          routeMotor(9);
        }
      } else {
        delay(300); routeMotor(6); delay(500);
      }
    } else {
      // BUG 4 DIAGNOSTIC: Log raw deltas every cycle so you can confirm
      // the flashlight is producing a delta above threshold (350).
      int pan_delta  = left_ldr - right_ldr;  // >0 = light is more on the left
      int tilt_delta = top_ldr  - bottom_ldr; // >0 = light is more on the top
      Serial.printf("[LDR] N1=%d N2=%d N3=%d N4=%d | L=%d R=%d T=%d B=%d | dPan=%d dTilt=%d | Vib=%d\n",
        n0, n1, n2, n3, left_ldr, right_ldr, top_ldr, bottom_ldr, pan_delta, tilt_delta, current_vib);

      // Deadband / Hysteresis
      static int current_pan_cmd = 6;
      static int current_tilt_cmd = 3;
      int stop_threshold = 200; // hysteresis

      // Pan logic
      if (current_pan_cmd == 6) {
          if (pan_delta > threshold) current_pan_cmd = 4;
          else if (-pan_delta > threshold) current_pan_cmd = 5;
      } else if (current_pan_cmd == 4) {
          if (pan_delta < stop_threshold) current_pan_cmd = 6;
      } else if (current_pan_cmd == 5) {
          if (-pan_delta < stop_threshold) current_pan_cmd = 6;
      }

      // Tilt logic
      if (current_tilt_cmd == 3) {
          if (tilt_delta > threshold) current_tilt_cmd = 2;
          else if (-tilt_delta > threshold) current_tilt_cmd = 1;
      } else if (current_tilt_cmd == 2) {
          if (tilt_delta < stop_threshold) current_tilt_cmd = 3;
      } else if (current_tilt_cmd == 1) {
          if (-tilt_delta < stop_threshold) current_tilt_cmd = 3;
      }

      // Dispatch sequentially: prioritize Pan
      if (current_pan_cmd != 6) {
        routeMotor(current_pan_cmd);
        delay(300);    // Hold movement
        routeMotor(6); // Stop pan
        delay(500);    // Wait for system to settle
      } else if (current_tilt_cmd != 3) {
        routeMotor(current_tilt_cmd);
        delay(300);    // Hold movement
        routeMotor(3); // Stop tilt
        delay(500);    // Wait for system to settle
      } else {
        routeMotor(9); // Stop all
      }
    }
  }

  Serial.printf("[Core1][%02d:%02d] Wind:%s Status:%s Hum:%.1f online:%d\n",
    now.Hour(), now.Minute(), wind ? "ALERT" : "OK", (const char*)g_status, g_humidity, (int)g_online);
}

// ─── FREERTOS: CORE 0 — CLOUD STACK ──────────────────────────────────────────
void cloudTask(void*) {
  Serial.println("[Core0] Cloud task START");

  pinMode(0, INPUT_PULLUP);
  delay(100);
  if (digitalRead(0) == LOW) {
    Serial.println("[Core0] BOOT button held — Factory Reset!");
    WiFiManager wm;
    wm.resetSettings();
    prefs.begin("soltra", false);
    prefs.clear();
    prefs.end();
    Serial.println("[Core0] Reset complete. Rebooting...");
    ESP.restart();
  }

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect(CAPTIVE_AP, CAPTIVE_PASS)) {
    Serial.println("[Core0] WiFiManager: failed. Restart.");
    ESP.restart();
  }

  uint8_t currentChannel = WiFi.channel();
  Serial.printf("[Core0] WiFi OK | IP=%s | MAC=%s | CH=%d\n",
    WiFi.localIP().toString().c_str(),
    WiFi.macAddress().c_str(),
    currentChannel);

  // Re-init ESP-NOW on the correct WiFi channel (auto-detected)
  esp_now_deinit();
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onRecv);
    esp_now_register_send_cb(onSent);
    
    // Load Motor MAC from preferences if it exists
    prefs.begin("soltra", true);
    if (prefs.getBytesLength("motor_mac") == 6) {
      prefs.getBytes("motor_mac", MOTOR_MAC, 6);
      Serial.printf("[Core0] Loaded Motor MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
        MOTOR_MAC[0], MOTOR_MAC[1], MOTOR_MAC[2], MOTOR_MAC[3], MOTOR_MAC[4], MOTOR_MAC[5]);
      esp_now_peer_info_t p = {};
      memcpy(p.peer_addr, MOTOR_MAC, 6);
      p.channel = currentChannel;
      p.encrypt = false;
      esp_now_add_peer(&p);
    }
    prefs.end();
    // Publish hub's channel so sensor nodes can read it (via MQTT)
    char chanBuf[32];
    snprintf(chanBuf, sizeof(chanBuf), "{\"channel\":%d}", currentChannel);
    // Will publish after MQTT connects — stored locally for now
  }

  tlsClient.setCACert(root_ca);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCb);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(1024);
  connectMQTT();

  ArduinoOTA.setHostname("Helios-Master-Hub");
  ArduinoOTA.begin();

  // Publish WiFi channel to MQTT so sensor nodes can reference it
  char chanBuf[32];
  snprintf(chanBuf, sizeof(chanBuf), "{\"channel\":%d,\"mac\":\"%s\"}", 
    WiFi.channel(), WiFi.macAddress().c_str());
  if (mqtt.connected()) {
    mqtt.publish("helios/config/channel", chanBuf, true); // Retained message
    Serial.printf("[MQTT] Published channel config: %s\n", chanBuf);
  }

  // Check for OTA Update
  Serial.println("[OTA] Checking for cloud firmware update...");
  httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return ret = httpUpdate.update(tlsClient, OTA_URL);
  switch (ret) {
    case HTTP_UPDATE_FAILED: Serial.printf("[OTA] Update failed (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str()); break;
    case HTTP_UPDATE_NO_UPDATES: Serial.println("[OTA] No updates available"); break;
    case HTTP_UPDATE_OK: Serial.println("[OTA] Update OK"); break;
  }

  unsigned long lastPub = 0, lastBeat = 0;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Core0] WiFi lost. Reconnecting...");
      WiFi.reconnect();
      vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();
    ArduinoOTA.handle();

    unsigned long now = millis();
    if (now - lastPub  >= PUB_INTERVAL)  { lastPub = now;  publishTelemetry(); }
    if (now - lastBeat >= 30000)         { lastBeat = now;
      if (mqtt.connected()) mqtt.publish(TOPIC_STATUS, "{\"status\":\"alive\"}"); }

    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ─── FREERTOS: CORE 1 — RADIO + MOTORS + SENSORS ─────────────────────────────
void radioTask(void*) {
  Serial.println("[Core1] Radio task START");
  vTaskDelay(2000 / portTICK_PERIOD_MS);

  unsigned long lastDec = 0;
  unsigned long lastVib = 0;
  for (;;) {
    unsigned long now = millis();
    if (now - lastVib >= 50) { lastVib = now; pollVibration(); }
    if (now - lastDec >= DEC_INTERVAL) { lastDec = now; decisionEngine(); }
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200); delay(1000);

  // Turn on Vext to power external I2C sensors (active LOW on Heltec V3)
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(50); // give sensors time to power up

  Serial.println("\n==============================================");
  Serial.println(" PROJECT SOLTRA — Master Hub");
#ifdef ENV_LOCAL
  Serial.println(" ENV: LOCAL");
#else
  Serial.println(" ENV: PRODUCTION");
#endif
  Serial.printf(" TELEMETRY_URL: %s\n", TELEMETRY_URL);
  Serial.println("==============================================");

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x6B); Wire.write(0); 
  if (Wire.endTransmission(true) == 0) {
    Serial.println("[HW] MPU6050 OK");
  } else {
    Serial.println("[HW] MPU6050 NOT found (check wiring)!");
  }

  if (!bme.begin(0x76, &Wire) && !bme.begin(0x77, &Wire)) {
    Serial.println("[HW] BME280 NOT found (check wiring)!");
  } else {
    Serial.println("[HW] BME280 OK");
  }

  Rtc.Begin();
  if (!Rtc.GetIsRunning()) Rtc.SetIsRunning(true);
  
  RtcDateTime compiled = RtcDateTime(__DATE__, __TIME__);
  if (Rtc.GetDateTime() < compiled) {
    Serial.println("[HW] RTC was out of date. Updating to compile time...");
    Rtc.SetDateTime(compiled);
  }
  Serial.println("[HW] DS1302 RTC OK");

  WiFi.mode(WIFI_STA);

  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onRecv);
    esp_now_register_send_cb(onSent);
    Serial.println("[ESP-NOW] Pre-init OK");
  }

  xTaskCreatePinnedToCore(cloudTask, "Cloud", 8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(radioTask, "Radio", 4096, NULL, 2, NULL, 1);

  Serial.println("[System] Tasks launched. Entering FreeRTOS scheduler.\n");
}

void loop() {
  if (Serial.available() > 0) {
    char c = Serial.read();
    if (c >= '1' && c <= '9') {
      int cmd = c - '0';
      g_manual_timeout = millis() + 60000;
      Serial.printf("\n[MANUAL] Serial Cmd: %d -> motor\n", cmd);
      routeMotor(cmd);
    }
  }

  // Handle auto-stop for manual MQTT commands
  unsigned long now = millis();
  if (g_auto_stop_tilt > 0 && now > g_auto_stop_tilt) {
    g_auto_stop_tilt = 0;
    Serial.println("[AUTO-STOP] Tilt");
    routeMotor(3);
  }
  if (g_auto_stop_pan > 0 && now > g_auto_stop_pan) {
    g_auto_stop_pan = 0;
    Serial.println("[AUTO-STOP] Pan");
    routeMotor(6);
  }

  vTaskDelay(50 / portTICK_PERIOD_MS);
}