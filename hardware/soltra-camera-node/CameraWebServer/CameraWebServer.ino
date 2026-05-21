#include "esp_camera.h"
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
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

// ==========================================
// ⚠️ NETWORK SETTINGS ⚠️
// ==========================================
const char* ssid = "OnePlus";         
const char* password = "pxcf5344";
uint8_t HUB_MAC[] = {0xF0, 0x9E, 0x9E, 0x77, 0x7B, 0xF4}; 

typedef struct { 
  int node_id; 
  int ldr_value;
  float uv_index;
  float ir_ratio;
  float battery_v;
} SensorPkt;

SensorPkt txData;
esp_now_peer_info_t peerInfo;

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
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.println("[ESP-NOW] TX FAIL");
  }
}

// Core 1 Task
void soltraSensorTask(void *pvParameters) {
  Serial.println("[Core 1] SOLTRA Sensor Task Started.");
  for(;;) {
    int ldr; float uv, ir, bat;
    
    readSensors(&ldr, &uv, &ir, &bat);

    txData.ldr_value = ldr;
    txData.uv_index  = uv;
    txData.ir_ratio  = ir;
    txData.battery_v = bat;

    esp_now_send(HUB_MAC, (uint8_t *) &txData, sizeof(txData));
    
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

  // Load settings but DO NOT turn on the camera yet
  initCameraConfig();

  // ⚡ ENABLING MODEM SLEEP
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_MAX_MODEM);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print(".");
  }
  Serial.println();
  
  startCameraServer();
  Serial.print("[SERVER] Ready! Camera is ASLEEP until requested.\n");
  Serial.print("Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/stream");

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_send_cb(OnDataSent);
  memcpy(peerInfo.peer_addr, HUB_MAC, 6);
  peerInfo.channel = WiFi.channel(); 
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  initSensors();
  txData.node_id = 4; // ALWAYS NODE 4

  xTaskCreatePinnedToCore(
    soltraSensorTask, "SensorTask", 4096, NULL, 1, NULL, 1);                
}

void loop() { 
  // ⚡ DELETING LOOP TASK frees up Core 0 completely
  vTaskDelete(NULL); 
}