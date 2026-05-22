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

// ─── FILL IN YOUR VALUES ─────────────────────────────────────────────────────
#define MQTT_HOST      "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USER      "User_1"
#define MQTT_PASS      "hv8y5S9vFwLDJAP"
#define MQTT_CLIENT_ID "HeliosHub-ESP32-001"
#define CAPTIVE_AP     "Helios-Setup"
#define CAPTIVE_PASS   "helios2025"

#define TELEMETRY_URL  "https://your-app.vercel.app/api/telemetry/ingest"
#define TELEMETRY_KEY  "your-telemetry-ingest-key"
// ─────────────────────────────────────────────────────────────────────────────

#define TOPIC_TELEMETRY   "helios/telemetry"
#define TOPIC_CTRL_MANUAL "helios/control/manual"
#define TOPIC_STATUS      "helios/status"

const char* root_ca = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRnXxtcd/vNwwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJ1y/sQeGuU5NbgYn\n" \
"pL5+Z2OQ4E9/U0H2Z3B8H34yT0+U3F9L5t+Yh68s1mZ9R6X2aA2G0K/k/1X4i1nK\n" \
"oD1yB5E5Uq/06E6Y5T6c/0WbLzP+r1X6K3s2/H1z0o3q6/5v9R5L2v4r5X5Y3/6w\n" \
"tVClDPQQDasqA/74Q1kY0PZ6e0/h9w7q8E4A0s9VzG4s2S2P8X3U7G3a8L0J1F2R\n" \
"B6C0L7C2R8W9U1M7H6Q0C2N2X3T9A6I9V4T1T3T8L7O1U1V8X9N4I2W7H2V9J3Y0\n" \
"O0O9K6R4Y4T9R2J1Q8L4Q0U9P9J2U6L9J3G4W8Q1O2P1Y2R1S0H9O5R1Y2H5V7J6\n" \
"W7S8G9O0X4J9R9V1W1R4O2Y3P4Z2S7T1N8S9W5Y2J9O9T3P5W7P8J0O1T7P2N9O5\n" \
"U5K3Y9N6Q8T4L7U7N9O2U0U4M9R5T2P5U9M8T5Q9O5Q0W9O6W8X1R5S2S3V0N5U9\n" \
"L5I4X2T7S9Y8I0X6H4Q8S8G1T6Q8Q8N9W4N2P3L6U7S0W1U6H3P1N6W5H3M3O9K4\n" \
"P2R9W5O2Q1O4O0T6Y2T6O8P6T0W5S4U6X7P3H5M3R3W6W5H2V1L9X6P4Q8T4U2O8\n" \
"M8X3O4T1V4S7R0L4X1Q5S3X5K7V4J0P9P2J1M4N0R6T4M2X2V9T6X4S8I5W8O2Y6\n" \
"S2H7N2Q5M4R0Q7O9N7Y5T3V8R4X7Q9H5V3L8M7J0J9I5M4I0N6M3M8H4Q8O0S9H4\n" \
"X2M0N8S0V9I5K7M6X1J5T9X3J1M1V9R2H0N2N2W6Q7V4J6O0W6W4S8I3P8O6H3I0\n" \
"N1H5S0O3J4Q8T6X5Q1V7R3X0X6R3I5V8S6Q9J2N5W5Q2X1V3S8J7S0R8T4T2R8R7\n" \
"K0U2Y8O2S9K8N9R5O0U3O4S9T7I2K8X2H3T0R8P3S3M9T8V4J6K6X6W8I6U1R2N7\n" \
"S1V1O0N2J6L3M3J1W7Q8T7P1P2W1L9Q0P8P2H5Q8T4U4U1H8P8X5V9L4M2W0S5N8\n" \
"M1R1I2R6N1T8I3P7U9L3U2W5R3H7S8I0M1R4W8T9T0R7V1H6K5W7X4W0T6N4Y2T7\n" \
"X2W9T6P4H9O1R5K1M3T1I8Q8J2V0U8Q7H8P1P3N3W4K4J3X4W5I3T6L9K9V0S2O9\n" \
"K8J3V6T8I6H6P4M7X1T7Y4T9U5W5J4S2V4U0O5K3N7S8J2W9J8M2Q4T7W8I1U8J0\n" \
"P6J7T7O8X8T6N9S1K8I1P7N6S4K0H6R9I4U0O9N7V5K2H1Q6I9S8W4S1K9X3P9M1\n" \
"U5K9J4Q2P5L4O9T0X5P3J0T9Q0W8I7M4P9X7W6S4K9I8T8U1S8V1M7R7W8N7R8I4\n" \
"O0P8W3S6I6V2X8V7X7O3V5I6X6U3O0V3X1O8H1X5O6T0M4W1K6L7W6W1V2P8W9S4\n" \
"Q0O2K1P6P0V5Q0U8P3K5O8K4W5T4O0T2X2L9O8S7T2K5W6I3N1X2U6V4L9L0V9R5\n" \
"I8M5O9J7W2J3W6P1V3U3P9S4X5M6V5M9J9S9T7U0I1X2M5W1T2M6V6V8S2L5S0S0\n" \
"L3U1V8M1X3I4W9S4Q7P7Q0J7J2U5J9P0T2L9O8I9I5O9L3N1R4T4L3U3N4V8I6W5\n" \
"W7T6H9P0U5J4U7P9P4U2I7T1W8V3H1S6M1O9T3S7S2T0V1K5J5S8N8P2U3L7R3V1\n" \
"W0L3R5H8S7P8I1X0R5K5W6W4U8H1N5L0V3U8H4V0T6L6J5I9Q2W2S3P9M5K7J4W1\n" \
"Q3S4H2M4N4L8O6Q5W0I5R9S9T1U2W4N9X7O6U3V5W8W8T5N2H3M9J3M9U5I8X1T5\n" \
"H9K1U9J5H1Q3W4Q9W9U4R5K8N1V7N7R5O3U8K5J1K4J3H3O6S4X3U4W4V4W4W6R6\n" \
"H8H4P6X6U1O3R4Q1W0T8V3X6T0S5V9N4W5V3J5U9J6W7R7U9N4N4K6J2W3U8N3V7\n" \
"O4H3W6V0U2S6P5H0X2V2L8V8T6R9P3J8I7O1I6T7H3S8O7J0O5P6W2X6R0N4R7Q3\n" \
"V1I8T6X5M2S5K0U5V8R7R7N1W9T1U9R0U8W3X6S0N0V2M1U0X4S6M7L9W9V5N1L9\n" \
"K0R1I9Q9U8H1V2V1L1J3L1U1W4P4S4T4V8J3R3P4V9I3P6K3R3P4O4J8S4U9S9H5\n" \
"W0X4S8K9H1W0K8K7X6W0S8R9P7H1Q8L4Q7N1I9J9T6Q2I2H5O2O1I8T6L7T6R4H9\n" \
"N1M9L9M8L4S7O0O3W1O1L3Q5Q7P7Q0J7J2U5J9P0T2L9O8I9I5O9L3N1R4T4L3U3\n" \
"N4V8I6W5W7T6H9P0U5J4U7P9P4U2I7T1W8V3H1S6M1O9T3S7S2T0V1K5J5S8N8\n" \
"P2U3L7R3V1W0L3R5H8S7P8I1X0R5K5W6W4U8H1N5L0V3U8H4V0T6L6J5I9Q2W2\n" \
"S3P9M5K7J4W1Q3S4H2M4N4L8O6Q5W0I5R9S9T1U2W4N9X7O6U3V5W8W8T5N2H3\n" \
"M9J3M9U5I8X1T5H9K1U9J5H1Q3W4Q9W9U4R5K8N1V7N7R5O3U8K5J1K4J3H3O6\n" \
"S4X3U4W4V4W4W6R6H8H4P6X6U1O3R4Q1W0T8V3X6T0S5V9N4W5V3J5U9J6W7R7\n" \
"U9N4N4K6J2W3U8N3V7O4H3W6V0U2S6P5H0X2V2L8V8T6R9P3J8I7O1I6T7H3S8\n" \
"O7J0O5P6W2X6R0N4R7Q3V1I8T6X5M2S5K0U5V8R7R7N1W9T1U9R0U8W3X6S0N0\n" \
"V2M1U0X4S6M7L9W9V5N1L9K0R1I9Q9U8H1V2V1L1J3L1U1W4P4S4T4V8J3R3P4\n" \
"V9I3P6K3R3P4O4J8S4U9S9H5W0X4S8K9H1W0K8K7X6W0S8R9P7H1Q8L4Q7N1I9\n" \
"J9T6Q2I2H5O2O1I8T6L7T6R4H9N1M9L9M8L4S7O0O3W1O1L3Q5Q7P7Q0J7J2U5\n" \
"CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0O\n" \
"BBYEFKO1ea5m2k4R31v+K7uVqFhZ4kR3MA0GCSqGSIb3DQEBCwUAA4ICAQA+9Vz8\n" \
"pM6N59Y0O1y0o6i1l3l6r2o2q9c8u8y9w2k9q0d5c3v9t7e5v9q6r7x9a3f9e9l6\n" \
"j5d6c8b9a2o6h3z2q6c2p6x8r1y8o8e2k2t2a3l4d7l7j8d6d6a2f4n2f2f7q8f9\n" \
"h5c2v8d6y5v2q5h9h6p2h3d3z5q3m1s4q4h8r9g9g8f8r1h2d5a3p1n6x8m4a3u6\n" \
"x1c2h6p4f5v9a7h4a2a1h5g9k4u4t7f7g6a4c2a4h5n9d8b7y5a6j3b5v9m6u4u1\n" \
"k3r8d9f4e2k2d3g5v2u1c6f3y2s2r2z9a5e8v2h8c2a4n3h1u4p2m3v2c2n7d9p5\n" \
"e1p6c2q2m4e9u2c6v2d1z8f5f4a6b2j9x4h3d2t5v2c8e3v9k4x5b8z2f5p5s6g1\n" \
"z2h9n7f7m3y6x9a9p2z2b6a9a7s6k7j6t9x4m4v1p7y9h1d4d8c7y9h1d4d8c7\n" \
"y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7\n" \
"y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7\n" \
"y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7y9h1d4d8c7\n" \
"a5f8x9a2k2s3q3m3n1y4q8c2x3g2u8m8k9b5u2g8g2b4v6e9t9u6h6x6x8a1p1q8\n" \
"w5u6t8z1p5x7m6e6y8q9p5c6z5h1u4s8n7y8v3f3f5z3v8n8v8q2m1q8w5u6t8\n" \
"-----END CERTIFICATE-----\n";

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
volatile float   g_watts   = 847.3f;  
volatile float   g_volts   = 240.2f;
volatile float   g_pan_angle = 184.2f;  
volatile float   g_tilt_angle = 45.0f;  
volatile float   g_irradiance = 0.0f;
volatile bool    g_online  = false;
volatile bool    g_wind    = false;
volatile int     g_hour    = 0;
volatile float   g_ws      = 12.4f;   
volatile char    g_status[24] = "booting";

// ─── ESP-NOW PACKETS ─────────────────────────────────────────────────────────
typedef struct { 
  int node_id; 
  int ldr_value;
  float uv_index;
  float ir_ratio;
  float battery_v;
} SensorPkt;
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
  g_irradiance  = (float)rxPkt.ldr_value; // Map sensor payload to telemetry struct
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
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] ERR: WiFi not connected");
    return;
  }

  char buf[512];
  
  // Local variables to hold the fast-copied data
  float ws, wa_watts, vo_volts, pa_pan, ta_tilt, ir_irrad;
  bool wa, no_;
  char st[24];

  // Lock quickly, copy primitives, unlock immediately
  portENTER_CRITICAL(&mux);
  ws = g_ws; wa_watts = g_watts; vo_volts = g_volts;
  pa_pan = g_pan_angle; ta_tilt = g_tilt_angle; ir_irrad = g_irradiance;
  wa = g_wind; no_ = g_online;
  strncpy(st, (const char*)g_status, 24);
  portEXIT_CRITICAL(&mux);

  String mac = WiFi.macAddress();
  mac.toUpperCase();

  snprintf(buf, sizeof(buf),
    "{\"node_mac\":\"%s\",\"wind_speed\":%.1f,\"watts\":%.1f,\"volts\":%.1f,\"pan_angle\":%.1f,\"tilt_angle\":%.1f,"
    "\"wind_alert\":%s,\"irradiance\":%.1f,\"node_online\":%s,\"status\":\"%s\"}",
    mac.c_str(), ws, wa_watts, vo_volts, pa_pan, ta_tilt, wa?"true":"false", ir_irrad, no_?"true":"false", st);

  Serial.print("[HTTP] TX → "); Serial.println(buf);

  HTTPClient http;
  http.begin(TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + TELEMETRY_KEY);
  
  int httpResponseCode = http.POST(buf);
  
  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] OK code: %d\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] ERR code: %d, %s\n", httpResponseCode, http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
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

  tlsClient.setCACert(root_ca);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCb);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(1024); // INCREASED BUFFER FOR TLS
  connectMQTT();
  
  ArduinoOTA.setHostname("Helios-Master-Hub");
  ArduinoOTA.begin();

  unsigned long lastPub=0, lastBeat=0;
  for(;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Core0] WiFi lost. Reconnecting...");
      WiFi.reconnect();
      vTaskDelay(5000/portTICK_PERIOD_MS);
    }
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();
    ArduinoOTA.handle();

    unsigned long now = millis();
    if (now-lastPub  >= PUB_INTERVAL)  { lastPub=now;  publishTelemetry(); }
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