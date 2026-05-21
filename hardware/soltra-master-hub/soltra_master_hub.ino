#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <Wire.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>

// ─── FILL IN YOUR VALUES ─────────────────────────────────────────────────────
#define MQTT_HOST      "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USER      "User_1"
#define MQTT_PASS      "hv8y5S9vFwLDJAP"
#define MQTT_CLIENT_ID "HeliosHub-ESP32-001"
#define CAPTIVE_AP     "Helios-Setup"
#define CAPTIVE_PASS   "helios2025"
// ─────────────────────────────────────────────────────────────────────────────

#define TOPIC_TELEMETRY   "helios/telemetry"
#define TOPIC_CTRL_MANUAL "helios/control/manual"
#define TOPIC_STATUS      "helios/status"

const unsigned long PUB_INTERVAL  = 5000;
const unsigned long DEC_INTERVAL  = 1000;
const int           WIND_THRESH   = 18000;

// ─── HARDWARE (Heltec V3 ESP32-S3 Safe Pins) ─────────────────────────────────
#define I2C_SDA  41 
#define I2C_SCL  42 
#define MPU_ADDR 0x68

ThreeWire myWire(5, 6, 4); // DAT, CLK, RST
RtcDS1302<ThreeWire> Rtc(myWire);

// Motor Node MAC — replace with real MAC of your Wemos motor node
uint8_t MOTOR_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ─── SHARED STATE (mutex-protected) ──────────────────────────────────────────
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

volatile int16_t g_AcX = 0, g_AcY = 0;
volatile int     g_light   = 0;
volatile bool    g_online  = false;
volatile bool    g_wind    = false;
volatile int     g_hour    = 0;
volatile float   g_ws      = 12.4f;   
volatile float   g_yield   = 847.3f;  
volatile float   g_angle   = 184.2f;  
volatile char    g_status[24] = "booting";

// ─── ESP-NOW PACKETS ─────────────────────────────────────────────────────────
typedef struct { int node_id; int light_value; } SensorPkt;
typedef struct { int command; } MotorPkt;
SensorPkt rxPkt;
MotorPkt  txPkt;

// ─── MQTT / TLS OBJECTS ──────────────────────────────────────────────────────
WiFiClientSecure tlsClient;
PubSubClient     mqtt(tlsClient);

// ─── FUNCTIONS: FORWARD DECL ─────────────────────────────────────────────────
void connectMQTT();
void publishTelemetry();
void routeMotor(int cmd);

// ─── ESP-NOW CALLBACKS ───────────────────────────────────────────────────────
void onRecv(const esp_now_recv_info* info, const uint8_t* data, int len) {
  memcpy(&rxPkt, data, sizeof(rxPkt));
  portENTER_CRITICAL_ISR(&mux);
  g_light  = rxPkt.light_value;
  g_online = true;
  portEXIT_CRITICAL_ISR(&mux);
}

void onSent(const wifi_tx_info_t* info, esp_now_send_status_t s) { }

// ─── MQTT CALLBACK ───────────────────────────────────────────────────────────
void mqttCb(char* topic, byte* payload, unsigned int len) {
  if (len == 0) return;
  char msg[8]; memcpy(msg, payload, min((int)len, 7)); msg[min((int)len,7)] = '\0';
  int cmd = atoi(msg);
  if (strcmp(topic, TOPIC_CTRL_MANUAL) == 0 && cmd >= 1 && cmd <= 6) {
    Serial.printf("[MQTT] Cmd received: %d → routing to motor node\n", cmd);
    routeMotor(cmd);
  }
}

// ─── ROUTE MOTOR CMD VIA ESP-NOW ─────────────────────────────────────────────
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
  char buf[256];
  
  // Local variables to hold the fast-copied data
  float ws, sy, pa;
  bool wa, no_;
  int ll;
  char st[24];

  // Lock quickly, copy primitives, unlock immediately
  portENTER_CRITICAL(&mux);
  ws = g_ws; sy = g_yield; pa = g_angle;
  wa = g_wind; ll = g_light; no_ = g_online;
  strncpy(st, (const char*)g_status, 24);
  portEXIT_CRITICAL(&mux);

  snprintf(buf, sizeof(buf),
    "{\"wind_speed\":%.1f,\"solar_yield\":%.1f,\"panel_angle\":%.1f,"
    "\"wind_alert\":%s,\"light_level\":%d,\"node_online\":%s,\"status\":\"%s\"}",
    ws, sy, pa, wa?"true":"false", ll, no_?"true":"false", st);

  Serial.print("[MQTT] TX → "); Serial.println(buf);
  if (!mqtt.publish(TOPIC_TELEMETRY, buf))
    Serial.println("[MQTT] ERR: Publish failed!");
}

// ─── DECISION ENGINE (Core 1) ────────────────────────────────────────────────
void readMPU() {
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  int16_t x = Wire.read()<<8|Wire.read();
  int16_t y = Wire.read()<<8|Wire.read();
  Wire.read(); Wire.read();
  portENTER_CRITICAL(&mux); g_AcX=x; g_AcY=y; portEXIT_CRITICAL(&mux);
}

void decisionEngine() {
  RtcDateTime now = Rtc.GetDateTime();
  readMPU();
  portENTER_CRITICAL(&mux);
  bool wind = (abs(g_AcX)>WIND_THRESH || abs(g_AcY)>WIND_THRESH);
  int  hr   = now.Hour();
  g_wind = wind; g_hour = hr;
  if      (wind)          strncpy((char*)g_status, "wind_stow",     24);
  else if (hr>=19||hr<7)  strncpy((char*)g_status, "night_reset",   24);
  else if (!g_online)     strncpy((char*)g_status, "sensor_offline",24);
  else                    strncpy((char*)g_status, "tracking",      24);
  portEXIT_CRITICAL(&mux);
  Serial.printf("[Core1][%02d:%02d] Wind:%s Status:%s\n",
    now.Hour(),now.Minute(), wind?"ALERT":"OK",(const char*)g_status);
}

// ─── FREERTOS TASK: CORE 0 — CLOUD STACK ─────────────────────────────────────
void cloudTask(void*) {
  Serial.println("[Core0] Cloud task START");

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect(CAPTIVE_AP, CAPTIVE_PASS)) {
    Serial.println("[Core0] WiFiManager: failed. Restart.");
    ESP.restart();
  }
  
  // GET THE ASSIGNED WIFI CHANNEL
  uint8_t currentChannel = WiFi.channel();
  Serial.printf("[Core0] WiFi OK. IP=%s CH=%d\n", WiFi.localIP().toString().c_str(), currentChannel);
  Serial.println("[Core0] *** CRITICAL: UPDATE XIAO NODE ESP-NOW TO MATCH THIS CHANNEL ***");

  // Re-init ESP-NOW on the correct channel
  esp_now_deinit();
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onRecv);
    esp_now_register_send_cb(onSent);
    esp_now_peer_info_t p={};
    memcpy(p.peer_addr,MOTOR_MAC,6); 
    p.channel = currentChannel; // SYNCED TO WIFI
    p.encrypt = false;
    esp_now_add_peer(&p);
  }

  tlsClient.setInsecure(); 
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCb);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(1024); // INCREASED BUFFER FOR TLS
  connectMQTT();

  unsigned long lastPub=0, lastBeat=0;
  for(;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Core0] WiFi lost. Reconnecting...");
      WiFi.reconnect();
      vTaskDelay(5000/portTICK_PERIOD_MS);
    }
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();

    unsigned long now = millis();
    if (now-lastPub  >= PUB_INTERVAL)  { lastPub=now;  if(mqtt.connected()) publishTelemetry(); }
    if (now-lastBeat >= 30000)         { lastBeat=now; if(mqtt.connected()) mqtt.publish(TOPIC_STATUS,"{\"status\":\"alive\"}"); }

    vTaskDelay(10/portTICK_PERIOD_MS);
  }
}

// ─── FREERTOS TASK: CORE 1 — RADIO + MOTORS + SENSORS ───────────────────────
void radioTask(void*) {
  Serial.println("[Core1] Radio task START");
  vTaskDelay(2000/portTICK_PERIOD_MS); // let Core 0 init first

  unsigned long lastDec=0;
  for(;;) {
    unsigned long now=millis();
    if (now-lastDec >= DEC_INTERVAL) { lastDec=now; decisionEngine(); }
    vTaskDelay(10/portTICK_PERIOD_MS);
  }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200); delay(1000);
  Serial.println("\n==============================================");
  Serial.println(" PROJECT HELIOS — Master OS Phase 5");
  Serial.println("==============================================");

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true);
  Serial.println("[HW] MPU6050 OK");

  Rtc.Begin(); if(!Rtc.GetIsRunning()) Rtc.SetIsRunning(true);
  Serial.println("[HW] DS1302 RTC OK");

  WiFi.mode(WIFI_STA);

  if (esp_now_init()==ESP_OK) {
    esp_now_register_recv_cb(onRecv);
    esp_now_register_send_cb(onSent);
    Serial.println("[ESP-NOW] Pre-init OK");
  }

  xTaskCreatePinnedToCore(cloudTask, "Cloud", 8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(radioTask, "Radio", 4096, NULL, 2, NULL, 1);

  Serial.println("[System] Tasks launched. Entering FreeRTOS scheduler.\n");
}

void loop() {
  vTaskDelay(portMAX_DELAY); 
}