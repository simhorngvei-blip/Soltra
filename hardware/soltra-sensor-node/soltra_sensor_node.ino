#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h> 
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include "Adafruit_TSL2591.h"

// ==========================================================
// ⚠️ NODE IDENTITY & NETWORK SETTINGS ⚠️
// ==========================================================
const int NODE_ID = 2; // <--- CHANGE THIS TO 1, 2, or 3 FOR EACH BOARD!

uint8_t HUB_MAC[] = {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4}; 
const int WIFI_CHANNEL = 11; 
// ==========================================================

const int BAT_PIN = A0; 
const int LDR_PIN = A1;
const int UV_PIN  = A2; 
const int LED_PIN = D3; 

Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
bool tsl_found = false;

typedef struct { 
  int node_id; 
  int ldr_value;
  float uv_index;
  float ir_ratio;
  float battery_v;
} SensorPkt;

SensorPkt txData;
esp_now_peer_info_t peerInfo;

void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  Serial.print("[ESP-NOW] TX Status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  unsigned long start_wait = millis();
  while (!Serial && millis() - start_wait < 3000) { delay(10); }

  Serial.printf("\n==========================================\n");
  Serial.printf("   SOLTRA C3 NODE %d - ESP-NOW TX MODE     \n", NODE_ID);
  Serial.printf("==========================================\n");

  WiFi.mode(WIFI_STA);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_send_cb(OnDataSent);
  
  memcpy(peerInfo.peer_addr, HUB_MAC, 6);
  peerInfo.channel = WIFI_CHANNEL;  
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  analogSetAttenuation(ADC_11db); 
  Wire.begin();
  if (tsl.begin()) {
    tsl.setGain(TSL2591_GAIN_LOW); 
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
    tsl_found = true;
  }
  
  txData.node_id = NODE_ID; 

  int raw_bat = analogRead(BAT_PIN);
  float battery_v = (raw_bat / 4095.0) * 3.1 * 2.0; 
  int ldr_raw = 4095 - analogRead(LDR_PIN);
  
  int uv_raw = analogRead(UV_PIN);
  float uv_voltage = (uv_raw / 4095.0) * 3.1; 
  float uv_index = uv_voltage / 0.1; 
  
  float ir_ratio = 0.0;
  if (tsl_found) {
    uint32_t lum = tsl.getFullLuminosity();
    uint16_t ir = lum >> 16;
    uint16_t full = lum & 0xFFFF;
    ir_ratio = (full > 0) ? ((float)ir / (float)full) : 0.0;
  }
  
  Serial.printf("Node %d -> Bat: %.2fV | LDR: %d | UV: %.2f | IR: %.2f\n", NODE_ID, battery_v, ldr_raw, uv_index, ir_ratio);

  txData.ldr_value = ldr_raw;
  txData.uv_index  = uv_index;
  txData.ir_ratio  = ir_ratio;
  txData.battery_v = battery_v;

  esp_now_send(HUB_MAC, (uint8_t *) &txData, sizeof(txData));
  
  digitalWrite(LED_PIN, LOW); delay(50); digitalWrite(LED_PIN, HIGH);
  
  Serial.println("[SLEEP] Entering Deep Sleep for 2 seconds...");
  esp_sleep_enable_timer_wakeup(2000000ULL);
  esp_deep_sleep_start();
}

void loop() {
  // Empty, deep sleep triggers reset instead
}