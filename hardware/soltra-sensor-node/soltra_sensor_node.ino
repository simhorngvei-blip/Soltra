// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — SENSOR NODE
// Edit this block. Scroll down for the firmware.
// ═════════════════════════════════════════════
//
// NOTE: No ENV_LOCAL / ENV_PRODUCTION toggle needed here.
//       Sensor nodes speak ESP-NOW only — they never talk to
//       the internet directly. Only the Master Hub does.
//
// STEP 1 — NODE ID  (⚠️ THE ONLY CHANGE PER BOARD ⚠️)
//   Change this number (1–4) for each board before flashing.
//   Each sensor node must have a unique ID.
//
#define NODE_ID 1   // ← change to 1, 2, 3, or 4 for each board
//
// STEP 2 — HUB MAC ADDRESS
//   Must match the WiFi MAC of your Heltec Master Hub.
//   How to find it:
//     a) Flash the Master Hub, open Serial Monitor at 115200 baud.
//     b) Look for: [Core0] WiFi OK | MAC=XX:XX:XX:XX:XX:XX | CH=N
//     c) Copy that MAC, convert XX to 0xXX bytes, paste below.
//
//   Example — MAC=F0:9E:9E:77:7B:F4:
//     {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4}
//
uint8_t HUB_MAC[] = {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4}; // ← replace with your hub MAC
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

/*
 * PROJECT SOLTRA — Sensor Node (XIAO ESP32C3)
 *
 * ─── ZERO-CONFIGURATION SETUP ────────────────────────────────────────────────
 * On FIRST boot, the node creates a hotspot "Soltra-Node-X-Setup".
 * Connect your phone, enter your WiFi password. Channel auto-detected.
 * Config saved to flash. Never needs reconfiguring.
 *
 * Hold BOOT (GPIO 9) on power-up to reset WiFi channel.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Hardware:
 * - XIAO ESP32C3 or compatible
 * - Adafruit TSL2591 light sensor (I2C)
 * - LDR on A1, UV sensor on A2, Battery on A0, LED on D3
 */

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include "Adafruit_TSL2591.h"
#include <Preferences.h>
#include <WiFiManager.h>

// ─── BOOT CONFIG CLEAR BUTTON ────────────────────────────────────────────────
// Hold GPIO 9 (BOOT button on XIAO C3) on power-up to clear saved WiFi
// channel and trigger the captive portal setup on next boot.
#define CLEAR_CONFIG_PIN 9

// ─── PINS ─────────────────────────────────────────────────────────────────────
const int BAT_PIN = A0;
const int LDR_PIN = A1;
const int UV_PIN  = A2;
const int LED_PIN = D3;

Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
bool tsl_found = false;

Preferences prefs;

typedef struct {
  int node_id;
  int ldr_value;
  float uv_index;
  float ir_ratio;
  float battery_v;
} SensorPkt;

SensorPkt txData;
esp_now_peer_info_t peerInfo;

void OnDataSent(const wifi_tx_info_t* info, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] TX %s\n", status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

// ─── STORED CHANNEL ──────────────────────────────────────────────────────────
int getStoredChannel() {
  prefs.begin("soltra-node", true);
  int ch = prefs.getInt("wifi_channel", -1);
  prefs.end();
  return ch;
}

void saveChannel(int ch) {
  prefs.begin("soltra-node", false);
  prefs.putInt("wifi_channel", ch);
  prefs.end();
  Serial.printf("[Prefs] Channel %d saved\n", ch);
}

void clearConfig() {
  prefs.begin("soltra-node", false);
  prefs.clear();
  prefs.end();
  Serial.println("[Prefs] Config cleared");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  unsigned long start_wait = millis();
  while (!Serial && millis() - start_wait < 3000) { delay(10); }

  Serial.printf("\n==========================================\n");
  Serial.printf("   SOLTRA SENSOR NODE %d\n", NODE_ID);
  Serial.printf("==========================================\n");

  // ── Check BOOT button for clear ──────────────────────────────────────────
  pinMode(CLEAR_CONFIG_PIN, INPUT_PULLUP);
  delay(100);
  if (digitalRead(CLEAR_CONFIG_PIN) == LOW) {
    clearConfig();
    Serial.println("[Setup] BOOT held — config cleared. Entering setup portal...");
  }

  // ── Determine channel: stored or auto-detect via WiFiManager ─────────────
  int wifi_channel = getStoredChannel();

  if (wifi_channel == -1) {
    // First boot or cleared: use WiFiManager to get WiFi credentials.
    // WiFiManager will connect to the router, giving us the actual channel.
    Serial.println("[Setup] No stored channel — starting captive portal...");
    Serial.printf("[Setup] Connect to 'Soltra-Node-%d-Setup' to configure\n", NODE_ID);

    WiFiManager wm;
    wm.setConfigPortalTimeout(120);  // 2 minutes to configure

    char apName[32];
    snprintf(apName, sizeof(apName), "Soltra-Node-%d-Setup", NODE_ID);

    if (wm.autoConnect(apName, "soltra2025")) {
      wifi_channel = WiFi.channel();
      Serial.printf("[Setup] WiFi connected on channel %d\n", wifi_channel);
      saveChannel(wifi_channel);
      WiFi.disconnect(true, false);  // Disconnect from AP, keep credentials in NVS
    } else {
      Serial.println("[Setup] Portal timeout — defaulting to channel 1");
      wifi_channel = 1;
      saveChannel(wifi_channel);
    }
  } else {
    Serial.printf("[Setup] Using stored channel: %d\n", wifi_channel);
  }

  // ── Init ESP-NOW on the correct channel ───────────────────────────────────
  WiFi.mode(WIFI_STA);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(wifi_channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED — check hub power");
    goto sleep_now;
  }
  esp_now_register_send_cb(OnDataSent);

  memcpy(peerInfo.peer_addr, HUB_MAC, 6);
  peerInfo.channel = wifi_channel;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  // ── Read sensors ──────────────────────────────────────────────────────────
  analogSetAttenuation(ADC_11db);
  Wire.begin();
  if (tsl.begin()) {
    tsl.setGain(TSL2591_GAIN_LOW);
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
    tsl_found = true;
  }

  {
    int raw_bat   = analogRead(BAT_PIN);
    float battery_v = (raw_bat / 4095.0) * 3.3 * 2.0;
    int ldr_raw   = 4095 - analogRead(LDR_PIN);
    int uv_raw    = analogRead(UV_PIN);
    float uv_voltage = (uv_raw / 4095.0) * 3.3;
    float uv_index   = uv_voltage / 0.1;
    float ir_ratio   = 0.0;

    if (tsl_found) {
      uint32_t lum = tsl.getFullLuminosity();
      uint16_t ir  = lum >> 16;
      uint16_t full = lum & 0xFFFF;
      ir_ratio = (full > 0) ? ((float)ir / (float)full) : 0.0;
    }

    // ── Per-Node Calibration ────────────────────────────────────────────────
    float ldr_mult = 1.0; int ldr_off = 0;
    float uv_mult  = 1.0; float uv_off  = 0.0;
    float ir_mult  = 1.0; float ir_off  = 0.0;

    if      (NODE_ID == 1) { /* Baseline — no adjustment */ }
    else if (NODE_ID == 2) { /* Node 2 calibration — add offsets when known */ }
    else if (NODE_ID == 3) { ldr_off = -659; ir_off = -0.17; }
    else if (NODE_ID == 4) { /* Node 4 calibration — add offsets when known */ }

    ldr_raw  = max(0, (int)(ldr_raw * ldr_mult) + ldr_off);
    uv_index = max(0.0f, (float)(uv_index * uv_mult) + uv_off);
    ir_ratio = max(0.0f, (float)(ir_ratio * ir_mult) + ir_off);

    txData.node_id   = NODE_ID;
    txData.ldr_value = ldr_raw;
    txData.uv_index  = uv_index;
    txData.ir_ratio  = ir_ratio;
    txData.battery_v = battery_v;

    Serial.printf("Node %d | CH:%d | Bat:%.2fV | LDR:%d | UV:%.2f | IR:%.2f\n",
      NODE_ID, wifi_channel, battery_v, ldr_raw, uv_index, ir_ratio);

    esp_now_send(HUB_MAC, (uint8_t*)&txData, sizeof(txData));

    digitalWrite(LED_PIN, LOW); delay(50); digitalWrite(LED_PIN, HIGH);
  }

sleep_now:
  Serial.println("[SLEEP] Deep sleep 2s...");
  esp_sleep_enable_timer_wakeup(2000000ULL);
  esp_deep_sleep_start();
}

void loop() {
  // Empty — deep sleep restarts from setup()
}