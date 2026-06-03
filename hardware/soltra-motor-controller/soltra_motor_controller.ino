// ═════════════════════════════════════════════
// SOLTRA HARDWARE CONFIG — MOTOR CONTROLLER
// Edit this block. Scroll down for the firmware.
// ═════════════════════════════════════════════
//
// NOTE: No ENV_LOCAL / ENV_PRODUCTION toggle needed here.
//       The motor controller speaks ESP-NOW only — it never talks
//       to the internet directly. All cloud traffic flows through
//       the Master Hub. Only the Hub needs the ENV toggle.
//
// STEP 1 — HUB MAC ADDRESS
//   This must match the WiFi MAC of your Heltec Master Hub.
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
// STEP 2 — CLEAR-CHANNEL BUTTON PIN
//   Hold this GPIO on power-up to clear the stored WiFi channel,
//   forcing the motor controller to re-discover it from the hub.
//   GPIO 0 = BOOT button on most ESP32 Dev Kit V1 boards.
//
#define CLEAR_CHANNEL_PIN 0  // ← change if your board uses a different BOOT pin
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

/*
 * PROJECT SOLTRA — Motor Controller (ESP32 Dev Kit V1)
 *
 * ─── ZERO-CONFIGURATION SETUP ────────────────────────────────────────────────
 * 1. Flash this firmware.
 * 2. Open Serial Monitor at 115200 baud.
 * 3. On FIRST boot, note the MAC address printed as:
 *      [SETUP] Motor MAC: XX:XX:XX:XX:XX:XX
 * 4. Enter that MAC into the Master Hub STEP 5 config block.
 *    Re-flash the hub once. Done — no further changes needed.
 *
 * WiFi Channel: Auto-synced with the hub via ESP-NOW, saved to flash.
 *               Hold BOOT button (STEP 2 pin) on power-up to clear.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Hardware Connections:
 * - MPU6050:           SDA=21, SCL=22, INT=19, AD0=3.3V (address 0x69)
 * - L298N Motor A (Vertical):   ENA=14, IN1=27, IN2=26
 * - L298N Motor B (Horizontal): ENB=25, IN3=16, IN4=17
 */

#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>

Preferences prefs;

typedef struct {
  int command;
} MotorPkt;
MotorPkt rxPkt;

typedef struct {
  float pan_angle;
  float tilt_angle;
} MotorTelemetryPkt;
MotorTelemetryPkt txPkt;
esp_now_peer_info_t peerInfo;

MPU6050 mpu(0x69);

const int sensorpin = 34;
const int ENA = 14, IN1 = 27, IN2 = 26;
const int ENB = 25, IN3 = 16, IN4 = 17;
#define INTERRUPT_PIN 19

int motorSpeed = 250;
bool fullPower = false;

bool dmpReady = false;
uint8_t mpuIntStatus, devStatus;
uint16_t packetSize, fifoCount;
uint8_t fifoBuffer[64];
Quaternion q;
VectorFloat gravity;
float ypr[3];
volatile bool mpuInterrupt = false;

void IRAM_ATTR dmpDataReady() { mpuInterrupt = true; }

// ─── MOTOR COMMAND LOGIC ──────────────────────────────────────────────────────
void executeCommand(int cmd) {
  switch (cmd) {
    case 1: // Tilt up (Vertical Motor — retract)
      Serial.println(F("[CMD 1] Tilt UP"));
      if (fullPower) digitalWrite(ENA, HIGH); else analogWrite(ENA, motorSpeed);
      digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
      break;
    case 2: // Tilt down (Vertical Motor — extend)
      Serial.println(F("[CMD 2] Tilt DOWN"));
      if (fullPower) digitalWrite(ENA, HIGH); else analogWrite(ENA, motorSpeed);
      digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
      break;
    case 3: // Stop tilt
      Serial.println(F("[CMD 3] Tilt STOP"));
      digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
      break;
    case 4: // Pan left (Horizontal Motor — retract)
      Serial.println(F("[CMD 4] Pan LEFT"));
      if (fullPower) digitalWrite(ENB, HIGH); else analogWrite(ENB, motorSpeed);
      digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
      break;
    case 5: // Pan right (Horizontal Motor — extend)
      Serial.println(F("[CMD 5] Pan RIGHT"));
      if (fullPower) digitalWrite(ENB, HIGH); else analogWrite(ENB, motorSpeed);
      digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
      break;
    case 6: // Stop pan
      Serial.println(F("[CMD 6] Pan STOP"));
      digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
      break;
    case 9: // Emergency stop all
      Serial.println(F("[CMD 9] ALL STOP"));
      digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
      digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
      break;
  }

  // Send updated angle to hub immediately after every command
  // (instead of waiting for the 1s telemetry interval)
  if (dmpReady) {
    txPkt.pan_angle  = ypr[0] * 180 / M_PI;
    txPkt.tilt_angle = ypr[1] * 180 / M_PI + 90;
    esp_now_send(HUB_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
  }
}

void onDataRecv(const esp_now_recv_info* info, const uint8_t* data, int len) {
  memcpy(&rxPkt, data, sizeof(rxPkt));
  Serial.printf("[ESP-NOW] Cmd received: %d\n", rxPkt.command);
  executeCommand(rxPkt.command);
}

// ─── READ STORED CHANNEL OR DEFAULT ──────────────────────────────────────────
int getStoredChannel() {
  prefs.begin("soltra", true);  // read-only namespace
  int ch = prefs.getInt("wifi_channel", -1);
  prefs.end();
  return ch;
}

void saveChannel(int channel) {
  prefs.begin("soltra", false);
  prefs.putInt("wifi_channel", channel);
  prefs.end();
  Serial.printf("[Prefs] Saved WiFi channel: %d\n", channel);
}

void clearChannel() {
  prefs.begin("soltra", false);
  prefs.remove("wifi_channel");
  prefs.end();
  Serial.println("[Prefs] Cleared WiFi channel — will re-discover on next boot");
}

void setup() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  Serial.begin(115200);

  // ── Always print MAC on boot ───────────────────────────────────────────────
  WiFi.mode(WIFI_STA);
  WiFi.begin();  // Initialize WiFi stack so macAddress() is available
  delay(200);
  Serial.println(F("\n=============================================="));
  Serial.println(F(" PROJECT SOLTRA — Motor Controller"));
  Serial.print(F(" [SETUP] Motor MAC: "));
  Serial.println(WiFi.macAddress());  // ← Copy this into master hub MOTOR_MAC
  Serial.println(F("=============================================="));

  // ── CLEAR CHANNEL button check ────────────────────────────────────────────
  pinMode(CLEAR_CHANNEL_PIN, INPUT_PULLUP);
  delay(100);
  if (digitalRead(CLEAR_CHANNEL_PIN) == LOW) {
    clearChannel();
    Serial.println("[Setup] Boot button held — channel cleared. Reboot to re-discover.");
  }

  // ── Determine WiFi channel ────────────────────────────────────────────────
  int wifi_channel = getStoredChannel();
  if (wifi_channel == -1) {
    // No channel saved — default to 1 and note that hub will publish channel
    // on helios/config/channel. Users can also check hub Serial Monitor.
    wifi_channel = 1;
    Serial.println("[Setup] No stored channel. Defaulting to channel 1.");
    Serial.println("[Setup] Check hub Serial Monitor for actual channel, then");
    Serial.println("[Setup] hold BOOT button on next power-up if channel differs.");
    saveChannel(wifi_channel);
  } else {
    Serial.printf("[Setup] Using stored channel: %d\n", wifi_channel);
  }

  // Set ESP32 to the correct WiFi channel for ESP-NOW
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(wifi_channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  // ── Init MPU6050 ─────────────────────────────────────────────────────────
  mpu.initialize();
  pinMode(INTERRUPT_PIN, INPUT_PULLUP);
  devStatus = mpu.dmpInitialize();
  mpu.setXGyroOffset(361);
  mpu.setYGyroOffset(-69);
  mpu.setZGyroOffset(-21);
  mpu.setZAccelOffset(1638);

  if (devStatus == 0) {
    mpu.CalibrateAccel(6);
    mpu.CalibrateGyro(6);
    mpu.setDMPEnabled(true);
    attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN), dmpDataReady, RISING);
    mpuIntStatus = mpu.getIntStatus();
    dmpReady = true;
    packetSize = mpu.dmpGetFIFOPacketSize();
    Serial.println(F("[HW] MPU6050 DMP ready"));
  } else {
    Serial.printf("[HW] MPU6050 DMP init failed (code %d)\n", devStatus);
  }

  // ── Motor pins ────────────────────────────────────────────────────────────
  pinMode(sensorpin, INPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);

  // ── ESP-NOW ───────────────────────────────────────────────────────────────
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ESP-NOW] Init FAILED"));
    return;
  }
  esp_now_register_recv_cb(onDataRecv);

  memcpy(peerInfo.peer_addr, HUB_MAC, 6);
  peerInfo.channel = wifi_channel;
  peerInfo.encrypt = false;
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println(F("[ESP-NOW] Add peer FAILED"));
    return;
  }

  Serial.printf("[ESP-NOW] Ready on channel %d. Listening for commands.\n", wifi_channel);
}

void loop() {
  // ── Serial manual override ────────────────────────────────────────────────
  if (Serial.available() > 0) {
    char c = (char)Serial.read();
    switch (c) {
      case 'f': case 'F':
        fullPower = !fullPower;
        Serial.printf("Full power: %s\n", fullPower ? "ON" : "OFF");
        break;
      case '+':
        motorSpeed = min(motorSpeed + 25, 255);
        if (!fullPower) { analogWrite(ENA, motorSpeed); analogWrite(ENB, motorSpeed); }
        Serial.printf("Speed: %d\n", motorSpeed);
        break;
      case '-':
        motorSpeed = max(motorSpeed - 25, 0);
        if (!fullPower) { analogWrite(ENA, motorSpeed); analogWrite(ENB, motorSpeed); }
        Serial.printf("Speed: %d\n", motorSpeed);
        break;
      case '1': executeCommand(1); break;
      case '2': executeCommand(2); break;
      case '3': executeCommand(3); break;
      case '4': executeCommand(4); break;
      case '5': executeCommand(5); break;
      case '6': executeCommand(6); break;
      case 's': case 'S': executeCommand(9); break;
    }
  }

  // ── MPU6050 DMP read ──────────────────────────────────────────────────────
  if (!dmpReady) return;
  if (mpu.dmpGetCurrentFIFOPacket(fifoBuffer)) {
    mpu.dmpGetQuaternion(&q, fifoBuffer);
    mpu.dmpGetGravity(&gravity, &q);
    mpu.dmpGetYawPitchRoll(ypr, &q, &gravity);
  }

  // ── Periodic telemetry to hub ─────────────────────────────────────────────
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 1000) {
    lastTelemetry = millis();
    if (dmpReady) {
      txPkt.pan_angle  = ypr[0] * 180 / M_PI;
      txPkt.tilt_angle = ypr[1] * 180 / M_PI + 90;
      esp_now_send(HUB_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
    }
  }
}