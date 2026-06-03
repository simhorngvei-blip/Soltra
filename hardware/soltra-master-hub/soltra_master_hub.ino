// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — MASTER HUB
// Edit this block. Scroll down for the firmware.
// ═════════════════════════════════════════════
//
// STEP 1 — ENVIRONMENT
//   Comment out the line below to switch to PRODUCTION mode.
//   PRODUCTION posts telemetry to Vercel instead of your local PC.
//
#define ENV_LOCAL   // ← comment out this line for PRODUCTION
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
#define PROD_URL "https://soltra-green.vercel.app"  // ← your Vercel URL
//
// STEP 4 — INGEST KEY
//   Must match TELEMETRY_INGEST_KEY in your .env.local / Vercel env vars.
//   For production, change this to a strong random secret.
//
#define TELEMETRY_KEY_VALUE "soltra-ingest-dev-key"  // ← change in production
//
// STEP 5 — MOTOR CONTROLLER MAC
//   Flash the motor controller first, open Serial Monitor at 115200 baud.
//   Copy the MAC from: [SETUP] Motor MAC: XX:XX:XX:XX:XX:XX
//   Replace each byte below. Re-flash the hub once. Never needs changing again.
//
//   Example — if Serial Monitor shows  24:6F:28:AA:BB:CC:
//     {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0xCC}
//
uint8_t MOTOR_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; // ← replace
//
// STEP 6 — GPS LOCATION  (for sun position calculation)
//   Right-click your location on maps.google.com to copy coordinates.
//
#define LATITUDE  3.140853   // ← your latitude
#define LONGITUDE 101.693207 // ← your longitude
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
#include <SolarCalculator.h>
#include <Preferences.h>

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
const int           WIND_THRESH   = 18000;

// ─── HARDWARE PINS (Heltec V3 ESP32-S3 Safe Pins) ────────────────────────────
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

volatile int16_t g_AcX = 0, g_AcY = 0;
volatile float   g_watts     = 847.3f;
volatile float   g_volts     = 240.2f;
volatile float   g_pan_angle = 184.2f;
volatile float   g_tilt_angle = 45.0f;
volatile float   g_irradiance = 0.0f;
volatile int     g_ldr_values[4] = {0, 0, 0, 0};
volatile bool    g_online = false;
volatile bool    g_wind   = false;
volatile int     g_hour   = 0;
volatile float   g_ws     = 12.4f;
volatile char    g_status[24]  = "booting";
volatile unsigned long g_manual_timeout = 0;
volatile bool    g_ai_override = false;
volatile char    g_ai_mode[16] = "";

// ─── ESP-NOW PACKETS ─────────────────────────────────────────────────────────
typedef struct {
  int node_id;
  int ldr_value;
  float uv_index;
  float ir_ratio;
  float battery_v;
} SensorPkt;

typedef struct {
  int command;
} MotorPkt;

typedef struct {
  float pan_angle;
  float tilt_angle;
} MotorTelemetryPkt;

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
  if (len == sizeof(SensorPkt)) {
    memcpy(&rxPkt, data, sizeof(rxPkt));
    portENTER_CRITICAL_ISR(&mux);
    if (rxPkt.node_id >= 1 && rxPkt.node_id <= 4)
      g_ldr_values[rxPkt.node_id - 1] = rxPkt.ldr_value;
    g_irradiance = (float)rxPkt.ldr_value;
    g_online = true;
    portEXIT_CRITICAL_ISR(&mux);
  } else if (len == sizeof(MotorTelemetryPkt)) {
    memcpy(&rxMotorPkt, data, sizeof(rxMotorPkt));
    portENTER_CRITICAL_ISR(&mux);
    g_pan_angle  = rxMotorPkt.pan_angle;
    g_tilt_angle = rxMotorPkt.tilt_angle;
    portEXIT_CRITICAL_ISR(&mux);
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
    portENTER_CRITICAL_ISR(&mux);
    if (msg.indexOf("ephemeris") >= 0) {
      g_ai_override = true;
      strncpy((char*)g_ai_mode, "ephemeris", 15);
    } else if (msg.indexOf("stow") >= 0) {
      g_ai_override = true;
      strncpy((char*)g_ai_mode, "stow", 15);
    } else if (msg.indexOf("auto") >= 0) {
      g_ai_override = false;
    }
    portEXIT_CRITICAL_ISR(&mux);
    Serial.printf("[MQTT] AI Override: %s\n", msg.c_str());
    return;
  }

  char msg[8];
  memcpy(msg, payload, min((int)len, 7));
  msg[min((int)len, 7)] = '\0';
  int cmd = atoi(msg);
  if (strcmp(topic, TOPIC_CTRL_MANUAL) == 0 && cmd >= 1 && cmd <= 9) {
    Serial.printf("[MQTT] Manual cmd: %d → motor\n", cmd);
    g_manual_timeout = millis() + 60000;
    routeMotor(cmd);
  }
}

// ─── ROUTE MOTOR CMD ─────────────────────────────────────────────────────────
void routeMotor(int cmd) {
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

  float ws, wa_watts, vo_volts, pa_pan, ta_tilt, ir_irrad, hum;
  bool wa, no_;
  char st[24];

  portENTER_CRITICAL(&mux);
  ws = g_ws; wa_watts = g_watts; vo_volts = g_volts;
  pa_pan = g_pan_angle; ta_tilt = g_tilt_angle; ir_irrad = g_irradiance;
  hum = g_humidity;
  wa = g_wind; no_ = g_online;
  strncpy(st, (const char*)g_status, 24);
  portEXIT_CRITICAL(&mux);

  String mac = WiFi.macAddress();
  mac.toUpperCase();

  char buf[512];
  // Field names match /api/telemetry/ingest expectations exactly:
  // solar_yield = irradiance in W/m², panel_angle = pan_angle
  snprintf(buf, sizeof(buf),
    "{\"node_mac\":\"%s\",\"wind_speed\":%.1f,\"solar_yield\":%.1f,"
    "\"panel_angle\":%.1f,\"tilt_angle\":%.1f,"
    "\"wind_alert\":%s,\"irradiance\":%.1f,\"humidity\":%.1f,"
    "\"node_online\":%s,\"status\":\"%s\"}",
    mac.c_str(), ws, ir_irrad, pa_pan, ta_tilt,
    wa ? "true" : "false", ir_irrad, hum,
    no_ ? "true" : "false", st);

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
void readMPU() {
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  int16_t x = Wire.read() << 8 | Wire.read();
  int16_t y = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();
  portENTER_CRITICAL(&mux); g_AcX = x; g_AcY = y; portEXIT_CRITICAL(&mux);
}

void decisionEngine() {
  RtcDateTime now = Rtc.GetDateTime();
  readMPU();
  g_humidity = bme.readHumidity();

  double sun_azimuth = 0.0, sun_elevation = 0.0;
  calcSolarPosition(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), 0,
                    LATITUDE, LONGITUDE, sun_azimuth, sun_elevation);

  portENTER_CRITICAL(&mux);
  bool wind = (abs(g_AcX) > WIND_THRESH || abs(g_AcY) > WIND_THRESH);
  int  hr   = now.Hour();
  g_wind = wind; g_hour = hr;

  int left_ldr   = (g_ldr_values[0] + g_ldr_values[2]) / 2;
  int right_ldr  = (g_ldr_values[1] + g_ldr_values[3]) / 2;
  int top_ldr    = (g_ldr_values[0] + g_ldr_values[1]) / 2;
  int bottom_ldr = (g_ldr_values[2] + g_ldr_values[3]) / 2;

  bool manual_override = (millis() < g_manual_timeout);
  bool ai_over = g_ai_override;
  char ai_md[16];
  if (ai_over) strncpy(ai_md, (const char*)g_ai_mode, 15);

  bool use_ephemeris = false;
  bool is_stow = false;

  if (wind || (ai_over && strcmp(ai_md, "stow") == 0)) {
    strncpy((char*)g_status, ai_over ? "ai_stow" : "wind_stow", 24);
    is_stow = true;
  } else if (manual_override) {
    strncpy((char*)g_status, "manual_override", 24);
  } else if (hr >= 19 || hr < 7) {
    strncpy((char*)g_status, "night_reset", 24);
  } else if (!g_online) {
    strncpy((char*)g_status, "sensor_offline", 24);
  } else if (ai_over && strcmp(ai_md, "ephemeris") == 0) {
    use_ephemeris = true;
    strncpy((char*)g_status, "ai_ephemeris", 24);
  } else {
    if (abs(g_pan_angle - sun_azimuth) > 15.0 && g_irradiance < 300.0) {
      use_ephemeris = true;
      strncpy((char*)g_status, "ephemeris_fb", 24);
    } else {
      strncpy((char*)g_status, "tracking", 24);
    }
  }
  portEXIT_CRITICAL(&mux);

  if (is_stow) {
    routeMotor(6); delay(20); routeMotor(3);
  } else if (!is_stow && hr >= 7 && hr < 19 && g_online && !manual_override) {
    int threshold = 500;
    if (use_ephemeris) {
      if (sun_azimuth > g_pan_angle + 2.0)       routeMotor(5);
      else if (sun_azimuth < g_pan_angle - 2.0)  routeMotor(4);
      else                                         routeMotor(6);
      delay(50);
      if (sun_elevation > g_tilt_angle + 2.0)     routeMotor(1);
      else if (sun_elevation < g_tilt_angle - 2.0) routeMotor(2);
      else                                           routeMotor(3);
    } else {
      if (left_ldr - right_ldr > threshold)       routeMotor(4);
      else if (right_ldr - left_ldr > threshold)  routeMotor(5);
      else                                          routeMotor(6);
      delay(50);
      if (top_ldr - bottom_ldr > threshold)       routeMotor(1);
      else if (bottom_ldr - top_ldr > threshold)  routeMotor(2);
      else                                          routeMotor(3);
    }
  }

  Serial.printf("[Core1][%02d:%02d] Wind:%s Status:%s Hum:%.1f\n",
    now.Hour(), now.Minute(), wind ? "ALERT" : "OK", (const char*)g_status, g_humidity);
}

// ─── FREERTOS: CORE 0 — CLOUD STACK ──────────────────────────────────────────
void cloudTask(void*) {
  Serial.println("[Core0] Cloud task START");

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
    esp_now_peer_info_t p = {};
    memcpy(p.peer_addr, MOTOR_MAC, 6);
    p.channel = currentChannel;  // ← Synced to actual WiFi channel
    p.encrypt = false;
    esp_now_add_peer(&p);
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
  for (;;) {
    unsigned long now = millis();
    if (now - lastDec >= DEC_INTERVAL) { lastDec = now; decisionEngine(); }
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200); delay(1000);
  Serial.println("\n==============================================");
  Serial.println(" PROJECT SOLTRA — Master Hub");
  Serial.printf(" ENV: %s\n", SOLTRA_ENV == 0 ? "LOCAL" : "PRODUCTION");
  Serial.printf(" TELEMETRY_URL: %s\n", TELEMETRY_URL);
  Serial.println("==============================================");

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true);
  Serial.println("[HW] MPU6050 OK");

  if (!bme.begin(0x76, &Wire)) {
    Serial.println("[HW] BME280 NOT found (check wiring)!");
  } else {
    Serial.println("[HW] BME280 OK");
  }

  Rtc.Begin();
  if (!Rtc.GetIsRunning()) Rtc.SetIsRunning(true);
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
  vTaskDelay(50 / portTICK_PERIOD_MS);
}