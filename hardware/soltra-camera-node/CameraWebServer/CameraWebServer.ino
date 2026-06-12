// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — CAMERA NODE (Node 4)
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
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
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

String api_url, mqtt_server, mqtt_port, mqtt_user, mqtt_pass, ingest_key;
WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);

unsigned long last_snapshot_time = 0;
const unsigned long SNAPSHOT_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
bool stream_active = false;

const char* root_ca = \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"reGCc=\n" \
"-----END CERTIFICATE-----\n"; 

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
// API & MQTT LOGIC
// ==========================================
void takeSnapshotAndUpload() {
  if (api_url == "" || ingest_key == "") {
    Serial.println("[UPLOAD] API URL or Key not configured");
    return;
  }
  
  bool was_off = !stream_active;
  if (was_off) {
    turnCameraOn();
    vTaskDelay(pdMS_TO_TICKS(500)); // Let the sensor stabilize
  }
  
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) { esp_camera_fb_return(fb); fb = esp_camera_fb_get(); } // clear stale frame
  
  if (!fb) {
    Serial.println("[UPLOAD] Camera capture failed");
    if (was_off) turnCameraOff();
    return;
  }
  
  Serial.printf("[UPLOAD] Captured %d bytes, uploading...\n", fb->len);
  
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // Accept Next.js API cert
  http.begin(client, api_url);
  http.addHeader("Authorization", "Bearer " + ingest_key);
  String mac = WiFi.macAddress();
  mac.toUpperCase();
  http.addHeader("x-node-mac", mac);
  http.addHeader("Content-Type", "image/jpeg");
  
  int code = http.POST(fb->buf, fb->len);
  Serial.printf("[UPLOAD] Response: %d\n", code);
  http.end();
  
  esp_camera_fb_return(fb);
  if (was_off) turnCameraOff();
}

void mqttCb(char* topic, byte* payload, unsigned int len) {
  char cmd[32];
  memcpy(cmd, payload, min((unsigned int)31, len));
  cmd[min((unsigned int)31, len)] = '\0';
  
  Serial.printf("[MQTT] Got CMD: %s\n", cmd);
  
  if (strcmp(cmd, "SNAPSHOT") == 0) {
    takeSnapshotAndUpload();
  } else if (strcmp(cmd, "STREAM_ON") == 0) {
    if (!stream_active) {
      turnCameraOn();
      stream_active = true;
    }
  } else if (strcmp(cmd, "STREAM_OFF") == 0) {
    if (stream_active) {
      turnCameraOff();
      stream_active = false;
    }
  }
}

void connectMQTT() {
  if (mqtt_server == "") return;
  
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String clientId = "Soltra-Cam-" + mac;
  
  if (mqtt.connect(clientId.c_str(), mqtt_user.c_str(), mqtt_pass.c_str())) {
    Serial.println("[MQTT] Connected");
    String topic = "soltra/camera/" + WiFi.macAddress() + "/cmd";
    topic.toUpperCase();
    mqtt.subscribe(topic.c_str());
  }
}

// ==========================================
// ESP-NOW & SENSORS
// ==========================================
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
void OnDataSent(const wifi_tx_info_t *mac_addr, esp_now_send_status_t status) {
#else
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
#endif
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
  Serial.println("\n[SYSTEM] Booting SOLTRA S3 Camera Node 4...");

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

  // ⚡ ENABLING MODEM SLEEP
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_MAX_MODEM);
  
  WiFiManager wm;

  WiFiManagerParameter custom_api_url("api_url", "Next.js API Upload URL", "", 128);
  WiFiManagerParameter custom_mqtt_server("mqtt_server", "MQTT Server", "", 64);
  WiFiManagerParameter custom_mqtt_port("mqtt_port", "MQTT Port", "8883", 6);
  WiFiManagerParameter custom_mqtt_user("mqtt_user", "MQTT Username", "", 64);
  WiFiManagerParameter custom_mqtt_pass("mqtt_pass", "MQTT Password", "", 64);
  WiFiManagerParameter custom_ingest_key("ingest_key", "Telemetry Ingest Key", "", 64);

  wm.addParameter(&custom_api_url);
  wm.addParameter(&custom_mqtt_server);
  wm.addParameter(&custom_mqtt_port);
  wm.addParameter(&custom_mqtt_user);
  wm.addParameter(&custom_mqtt_pass);
  wm.addParameter(&custom_ingest_key);
  
  if (!wm.autoConnect("Soltra-Camera-Setup")) {
    Serial.println("[CAMERA] WiFiManager: failed. Restart.");
    ESP.restart();
  }
  
  // Save credentials
  prefs.begin("soltra-config", false);
  if (strlen(custom_api_url.getValue()) > 0) prefs.putString("api_url", custom_api_url.getValue());
  if (strlen(custom_mqtt_server.getValue()) > 0) prefs.putString("mqtt_server", custom_mqtt_server.getValue());
  if (strlen(custom_mqtt_port.getValue()) > 0) prefs.putString("mqtt_port", custom_mqtt_port.getValue());
  if (strlen(custom_mqtt_user.getValue()) > 0) prefs.putString("mqtt_user", custom_mqtt_user.getValue());
  if (strlen(custom_mqtt_pass.getValue()) > 0) prefs.putString("mqtt_pass", custom_mqtt_pass.getValue());
  if (strlen(custom_ingest_key.getValue()) > 0) prefs.putString("ingest_key", custom_ingest_key.getValue());
  prefs.end();

  prefs.begin("soltra-config", true);
  api_url = prefs.getString("api_url", "");
  mqtt_server = prefs.getString("mqtt_server", "");
  mqtt_port = prefs.getString("mqtt_port", "");
  mqtt_user = prefs.getString("mqtt_user", "");
  mqtt_pass = prefs.getString("mqtt_pass", "");
  ingest_key = prefs.getString("ingest_key", "");
  prefs.end();
  
  tlsClient.setCACert(root_ca);
  if (mqtt_server != "") {
    mqtt.setServer(mqtt_server.c_str(), mqtt_port.toInt());
    mqtt.setCallback(mqttCb);
    connectMQTT();
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

  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Reconnecting...");
    WiFi.reconnect();
    vTaskDelay(pdMS_TO_TICKS(5000));
    return;
  }

  if (mqtt_server != "") {
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();
  }
  
  unsigned long now = millis();
  if (now - last_snapshot_time >= SNAPSHOT_INTERVAL) {
    last_snapshot_time = now;
    takeSnapshotAndUpload();
  }
  
  vTaskDelay(pdMS_TO_TICKS(10)); 
}