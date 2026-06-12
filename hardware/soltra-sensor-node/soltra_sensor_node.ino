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
// STEP 2 — TEST MODE
//   Uncomment the line below to disable deep sleep. This makes continuous 
//   flashing and testing much easier as the USB serial port won't disconnect.
//
#define DISABLE_DEEP_SLEEP
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

/*
 * PROJECT SOLTRA — Sensor Node (XIAO ESP32C3)
 *
 * ─── ZERO-CONFIGURATION SETUP ────────────────────────────────────────────────
 * On FIRST boot, the node scans channels 1-13, broadcasting a Pairing Request.
 * When the Master Hub responds, the node saves the Hub's MAC and channel.
 *
 * Hold BOOT (GPIO 9) on power-up to reset saved pairing and scan again.
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

// ─── BOOT CONFIG CLEAR BUTTON ────────────────────────────────────────────────
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
  uint32_t lux;
  float battery_v;
} SensorPkt;

typedef struct {
  uint8_t magic; // 0x99
  uint8_t device_type; 
} PairingReqPkt;

typedef struct {
  uint8_t magic; // 0xAA
  uint8_t channel;
} PairingAckPkt;

SensorPkt txData;
esp_now_peer_info_t peerInfo;

uint8_t HUB_MAC[6] = {0};
bool hub_paired = false;
volatile bool got_ack = false;

void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] TX %s\n", status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
  if (status != ESP_NOW_SEND_SUCCESS && hub_paired) {
      Serial.println("[ESP-NOW] Send failed. Clearing pairing config to retry next boot.");
      prefs.begin("soltra-node", false);
      prefs.clear();
      prefs.end();
  }
}

void onRecv(const esp_now_recv_info* info, const uint8_t* data, int len) {
  if (len == sizeof(PairingAckPkt) && data[0] == 0xAA) {
    PairingAckPkt ack; memcpy(&ack, data, sizeof(ack));
    memcpy(HUB_MAC, info->src_addr, 6);
    got_ack = true;
    Serial.printf("[PAIRING] Got ACK from Hub on channel %d!\n", ack.channel);
  }
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

  pinMode(CLEAR_CONFIG_PIN, INPUT_PULLUP);
  delay(100);
  if (digitalRead(CLEAR_CONFIG_PIN) == LOW) {
    clearConfig();
    Serial.println("[Setup] BOOT held — config cleared.");
  }

  WiFi.mode(WIFI_STA);
  esp_wifi_set_promiscuous(true);

  prefs.begin("soltra-node", false);
  int wifi_channel = prefs.getInt("wifi_channel", -1);
  size_t mac_len = prefs.getBytesLength("hub_mac");
  if (mac_len == 6) {
    prefs.getBytes("hub_mac", HUB_MAC, 6);
    hub_paired = true;
  }
  prefs.end();

  if (wifi_channel == -1 || !hub_paired) {
    Serial.println("[Setup] Not paired. Scanning channels for Hub...");
    if (esp_now_init() != ESP_OK) goto sleep_now;
    esp_now_register_recv_cb(onRecv);

    uint8_t broadcast_mac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    esp_now_peer_info_t bc_peer = {};
    memcpy(bc_peer.peer_addr, broadcast_mac, 6);
    bc_peer.encrypt = false;
    
    bool found = false;
    for (int ch = 1; ch <= 13; ch++) {
      esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
      bc_peer.channel = ch;
      if (esp_now_is_peer_exist(broadcast_mac)) {
        esp_now_del_peer(broadcast_mac);
      }
      esp_now_add_peer(&bc_peer);

      PairingReqPkt req = {0x99, NODE_ID};
      got_ack = false;
      esp_now_send(broadcast_mac, (uint8_t*)&req, sizeof(req));
      
      delay(150);
      if (got_ack) {
        wifi_channel = ch;
        found = true;
        prefs.begin("soltra-node", false);
        prefs.putInt("wifi_channel", wifi_channel);
        prefs.putBytes("hub_mac", HUB_MAC, 6);
        prefs.end();
        break;
      }
    }
    
    if (!found) {
      Serial.println("[Setup] Hub not found. Sleeping and retrying later.");
      goto sleep_now;
    }
  }

  esp_wifi_set_channel(wifi_channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  esp_now_deinit();
  if (esp_now_init() != ESP_OK) goto sleep_now;
  
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

read_sensors_label:
  {
    int raw_bat   = analogRead(BAT_PIN);
    float battery_v = (raw_bat / 4095.0) * 3.3 * 2.0;
    int ldr_raw   = 4095 - analogRead(LDR_PIN);
    int uv_raw    = analogRead(UV_PIN);
    float uv_voltage = (uv_raw / 4095.0) * 3.3;
    float uv_index   = uv_voltage / 0.1;
    float ir_ratio   = 0.0;
    uint32_t lux     = 0;

    if (tsl_found) {
      uint32_t lum = tsl.getFullLuminosity();
      uint16_t ir  = lum >> 16;
      uint16_t full = lum & 0xFFFF;
      ir_ratio = (full > 0) ? ((float)ir / (float)full) : 0.0;
      lux = tsl.calculateLux(full, ir);
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
    txData.lux       = lux;
    txData.battery_v = battery_v;

    Serial.printf("Node %d | CH:%d | Bat:%.2fV | LDR:%d | UV:%.2f | IR:%.2f\n",
      NODE_ID, wifi_channel, battery_v, ldr_raw, uv_index, ir_ratio);

    esp_now_send(HUB_MAC, (uint8_t*)&txData, sizeof(txData));

    digitalWrite(LED_PIN, LOW); delay(50); digitalWrite(LED_PIN, HIGH);
  }

sleep_now:
#ifdef DISABLE_DEEP_SLEEP
  Serial.println("[TEST] Delaying 2s instead of sleeping...");
  delay(2000);
  goto read_sensors_label;
#else
  Serial.println("[SLEEP] Deep sleep 2s...");
  esp_sleep_enable_timer_wakeup(2000000ULL);
  esp_deep_sleep_start();
#endif
}

void loop() {
}