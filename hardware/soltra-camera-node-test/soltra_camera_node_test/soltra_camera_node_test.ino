// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — CAMERA NODE (TEST - NO SLEEP)
// Edit this block. Scroll down for the firmware.
// ═════════════════════════════════════════════
//
// NOTE: No ENV_LOCAL / ENV_PRODUCTION toggle needed here.
//       The camera node sends sensor data over ESP-NOW and serves
//       a local MJPEG stream via HTTP.
//
// STEP 1 — ACCESS THE CAMERA STREAM
//   After setup, the camera is accessible at:
//   http://soltra-camera.local/stream
//   Use that URL in soltra-hud/.env.local as VITE_CAMERA_STREAM_URL.
//
// STEP 2 — BOOT CONFIG CLEAR BUTTON
//   Hold GPIO 0 (BOOT button) on power-up to clear saved WiFi.
//
#define CLEAR_CONFIG_PIN 0
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

#include "esp_camera.h"
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "SensorModule.h" // Your custom isolated tab

// ==========================================
// ⚠️ CAMERA PINS (XIAO ESP32S3)
// ==========================================
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39
#define Y9_GPIO_NUM       48
#define Y8_GPIO_NUM       11
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       16
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM       17
#define Y2_GPIO_NUM       15
#define VSYNC_GPIO_NUM    38
#define HREF_GPIO_NUM     47
#define PCLK_GPIO_NUM     13

typedef struct { 
  int node_id; 
  int ldr_value;
  float uv_index;
  float ir_ratio;
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
Preferences prefs;

// Global Camera Config
camera_config_t camera_config; 

// External function for the web server tab
void startCameraServer(); 

// ==========================================
// CAMERA ON/OFF FUNCTIONS
// ==========================================
void initCameraConfig() {
  camera_config.ledc_channel = LEDC_CHANNEL_0;
  camera_config.ledc_timer = LEDC_TIMER_0;
  camera_config.pin_d0 = Y2_GPIO_NUM;
  camera_config.pin_d1 = Y3_GPIO_NUM;
  camera_config.pin_d2 = Y4_GPIO_NUM;
  camera_config.pin_d3 = Y5_GPIO_NUM;
  camera_config.pin_d4 = Y6_GPIO_NUM;
  camera_config.pin_d5 = Y7_GPIO_NUM;
  camera_config.pin_d6 = Y8_GPIO_NUM;
  camera_config.pin_d7 = Y9_GPIO_NUM;
  camera_config.pin_xclk = XCLK_GPIO_NUM;
  camera_config.pin_pclk = PCLK_GPIO_NUM;
  camera_config.pin_vsync = VSYNC_GPIO_NUM;
  camera_config.pin_href = HREF_GPIO_NUM;
  camera_config.pin_sccb_sda = SIOD_GPIO_NUM;
  camera_config.pin_sccb_scl = SIOC_GPIO_NUM;
  camera_config.pin_pwdn = PWDN_GPIO_NUM;
  camera_config.pin_reset = RESET_GPIO_NUM;
  
  camera_config.xclk_freq_hz = 10000000; // ⚡ 10MHz keeps the board much cooler
  camera_config.frame_size = FRAMESIZE_UXGA;
  camera_config.pixel_format = PIXFORMAT_JPEG; 
  camera_config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  camera_config.fb_location = CAMERA_FB_IN_PSRAM;
  camera_config.jpeg_quality = 12;
  camera_config.fb_count = 1;
  
  if(psramFound()){
    camera_config.jpeg_quality = 10;
    camera_config.fb_count = 2;
    camera_config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    camera_config.frame_size = FRAMESIZE_SVGA;
    camera_config.fb_location = CAMERA_FB_IN_DRAM;
  }
}

void turnCameraOn() {
  Serial.println("[CAMERA] Waking up...");
  if (esp_camera_init(&camera_config) == ESP_OK) {
    sensor_t * s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1); 
      s->set_brightness(s, 1); 
      s->set_saturation(s, 0); 
    }
  }
}

void turnCameraOff() {
  Serial.println("[CAMERA] Going to sleep to save power/heat.");
  esp_camera_deinit(); // Halts the XCLK and frees memory
}

// ==========================================
// ESP-NOW & SENSORS
// ==========================================
void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS && hub_paired) {
      Serial.println("[ESP-NOW] Send failed. Clearing pairing config to retry next boot.");
      prefs.begin("soltra-cam", false);
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

// Core 1 Task
void soltraSensorTask(void *pvParameters) {
  Serial.println("[Core 1] SOLTRA Sensor Task Started.");
  for(;;) {
    int ldr; float uv, ir, bat;
    
    readSensors(&ldr, &uv, &ir, &bat);

    // =========================================
    // TEST OUTPUT FOR SERIAL MONITOR
    // =========================================
    Serial.printf("[SENSOR TEST] Bat: %.2fV | LDR: %d | UV: %.2f | IR: %.2f\n", bat, ldr, uv, ir);

    txData.node_id = 4;
    txData.ldr_value = ldr;
    txData.uv_index  = uv;
    txData.ir_ratio  = ir;
    txData.battery_v = bat;

    if (hub_paired) {
      esp_now_send(HUB_MAC, (uint8_t *) &txData, sizeof(txData));
    }
    
    // ⚡ Yields CPU to FreeRTOS Idle Task for power saving
    vTaskDelay(pdMS_TO_TICKS(2000));
  }
}

// ==========================================
// SETUP & LOOP
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println("\n[SYSTEM] Booting SOLTRA S3 Camera Node 4 (TEST - NO SLEEP)...");

  pinMode(CLEAR_CONFIG_PIN, INPUT_PULLUP);
  delay(100);
  if (digitalRead(CLEAR_CONFIG_PIN) == LOW) {
    Serial.println("[Setup] Boot button held — factory reset.");
    WiFiManager wm;
    wm.resetSettings();
    prefs.begin("soltra-cam", false);
    prefs.clear();
    prefs.end();
    ESP.restart();
  }

  // Load settings but DO NOT turn on the camera yet
  initCameraConfig();

  // ⚡ DISABLE MODEM SLEEP FOR TESTING
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_NONE);
  
  WiFiManager wm;
  if (!wm.autoConnect("Soltra-Camera-Setup")) {
    Serial.println("[CAMERA] WiFiManager: failed. Restart.");
    ESP.restart();
  }
  
  Serial.println();
  
  // Set up mDNS
  if (MDNS.begin("soltra-camera")) {
    Serial.println("[mDNS] Responder started: http://soltra-camera.local/stream");
  }

  ArduinoOTA.setHostname("Soltra-Camera-Node");
  ArduinoOTA.begin();
  
  startCameraServer();
  Serial.print("[SERVER] Ready! Camera is ASLEEP until requested.\n");
  Serial.print("Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/stream");

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(onRecv);
  
  prefs.begin("soltra-cam", false);
  size_t mac_len = prefs.getBytesLength("hub_mac");
  if (mac_len == 6) {
    prefs.getBytes("hub_mac", HUB_MAC, 6);
    hub_paired = true;
  }
  prefs.end();

  if (!hub_paired) {
    Serial.println("[Setup] Not paired. Sending Pairing Request on current WiFi channel...");
    uint8_t broadcast_mac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    esp_now_peer_info_t bc_peer = {};
    memcpy(bc_peer.peer_addr, broadcast_mac, 6);
    bc_peer.channel = WiFi.channel();
    bc_peer.encrypt = false;
    esp_now_add_peer(&bc_peer);

    PairingReqPkt req = {0x99, 4}; // Device type 4 = Node 4
    for (int i=0; i<10; i++) {
      got_ack = false;
      esp_now_send(broadcast_mac, (uint8_t*)&req, sizeof(req));
      delay(200);
      if (got_ack) {
        hub_paired = true;
        prefs.begin("soltra-cam", false);
        prefs.putBytes("hub_mac", HUB_MAC, 6);
        prefs.end();
        break;
      }
    }
    esp_now_del_peer(broadcast_mac);
  }

  if (hub_paired) {
    esp_now_register_send_cb(OnDataSent);
    memcpy(peerInfo.peer_addr, HUB_MAC, 6);
    peerInfo.channel = WiFi.channel(); 
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
    Serial.println("[ESP-NOW] Paired with Master Hub.");
  } else {
    Serial.println("[ESP-NOW] Warning: Master Hub not found. Retrying pairing on next boot.");
  }

  initSensors();

  xTaskCreatePinnedToCore(
    soltraSensorTask, "SensorTask", 4096, NULL, 1, NULL, 1);                
}

void loop() { 
  ArduinoOTA.handle();
  vTaskDelay(pdMS_TO_TICKS(10)); 
}