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
// STEP 1 — CLEAR-CHANNEL BUTTON PIN
//   Hold this GPIO on power-up to clear the stored WiFi channel,
//   forcing the motor controller to re-discover it from the hub.
//   GPIO 0 = BOOT button on most ESP32 Dev Kit V1 boards.
//
#define CLEAR_CHANNEL_PIN 0  // ← change if your board uses a different BOOT pin
//
// STEP 2 — SAFETY LIMITS (in Degrees)
//   Change these bounds to match your physical tracker.
//   If your tracker has no physical limits, you can set these to +/- 360.
#define DEFAULT_MAX_PAN_ANGLE   360.0
#define DEFAULT_MIN_PAN_ANGLE  -360.0
#define DEFAULT_MAX_TILT_ANGLE  360.0
#define DEFAULT_MIN_TILT_ANGLE -360.0
//
// ═════════════════════════════════════════════
// END CONFIG — do not edit below unless you know what you're doing
// ═════════════════════════════════════════════

/*
 * PROJECT SOLTRA — Motor Controller (ESP32 Dev Kit V1)
 *
 * ─── ZERO-CONFIGURATION SETUP ────────────────────────────────────────────────
 * 1. Flash this firmware.
 * 2. On EVERY boot, the controller scans channels 1-13 for the Master Hub.
 * 3. Once paired, the controller begins operation.
 *
 * (Config saving to flash has been removed per user request)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Hardware Connections:
 * - MPU6050:           VCC=3.3V, GND=GND, SDA=21, SCL=22, INT=19 (address 0x68)
 * - ZK-BM1 Motor A (Vertical):   IN1=27, IN2=26 (PWM directly on IN pins)
 * - ZK-BM1 Motor B (Horizontal): IN3=16, IN4=17
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

typedef struct {
  uint8_t magic; // 0x99
  uint8_t device_type; 
} PairingReqPkt;

typedef struct {
  uint8_t magic; // 0xAA
  uint8_t channel;
} PairingAckPkt;

uint8_t HUB_MAC[6] = {0};
bool hub_paired = false;
volatile bool got_ack = false;

MPU6050 mpu(0x68);

const int sensorpin = 34;
const int IN1 = 27, IN2 = 26;
const int IN3 = 16, IN4 = 17;
#define INTERRUPT_PIN 19

int motorSpeed = 250;
bool fullPower = false;
int current_pan_dir = 0;   // 1 = RIGHT, -1 = LEFT, 0 = STOP
int current_tilt_dir = 0;  // 1 = UP, -1 = DOWN, 0 = STOP

float pan_offset = 0.0;
float tilt_offset = 0.0;
float max_pan_limit = DEFAULT_MAX_PAN_ANGLE;
float min_pan_limit = DEFAULT_MIN_PAN_ANGLE;
float max_tilt_limit = DEFAULT_MAX_TILT_ANGLE;
float min_tilt_limit = DEFAULT_MIN_TILT_ANGLE;

bool stream_angles = false;
unsigned long last_stream_time = 0;

bool dmpReady = false;
uint8_t mpuIntStatus, devStatus;
uint16_t packetSize, fifoCount;
uint8_t fifoBuffer[64];
Quaternion q;
VectorFloat gravity;
float ypr[3];
volatile bool mpuInterrupt = false;

// ─── MOTOR WATCHDOG ───────────────────────────────────────────────────────────
// If no command arrives from hub within this window, stop all motors.
// Prevents runaway when a stop packet is lost over ESP-NOW.
#define MOTOR_WATCHDOG_MS 2000
unsigned long lastCmdTime = 0;

void IRAM_ATTR dmpDataReady() { mpuInterrupt = true; }

// ─── MOTOR COMMAND LOGIC ──────────────────────────────────────────────────────
void executeCommand(int cmd) {
  float current_pan = ypr[0] * 180 / M_PI + pan_offset;
  float current_tilt = ypr[1] * 180 / M_PI + 90 + tilt_offset;

  switch (cmd) {
    case 1: // Tilt up (Vertical Motor — retract)
      if (dmpReady && current_tilt >= max_tilt_limit) {
        Serial.println(F("[CMD 1 BLOCKED] Max Tilt reached"));
        analogWrite(IN1, 0); analogWrite(IN2, 0);
        current_tilt_dir = 0;
        break;
      }
      Serial.println(F("[CMD 1] Tilt UP"));
      analogWrite(IN1, fullPower ? 255 : motorSpeed);
      analogWrite(IN2, 0);
      current_tilt_dir = 1;
      break;
    case 2: // Tilt down (Vertical Motor — extend)
      if (dmpReady && current_tilt <= min_tilt_limit) {
        Serial.println(F("[CMD 2 BLOCKED] Min Tilt reached"));
        analogWrite(IN1, 0); analogWrite(IN2, 0);
        current_tilt_dir = 0;
        break;
      }
      Serial.println(F("[CMD 2] Tilt DOWN"));
      analogWrite(IN1, 0); 
      analogWrite(IN2, fullPower ? 255 : motorSpeed);
      current_tilt_dir = -1;
      break;
    case 3: // Stop tilt
      Serial.println(F("[CMD 3] Tilt STOP"));
      analogWrite(IN1, 0); analogWrite(IN2, 0);
      current_tilt_dir = 0;
      break;
    case 4: // Pan left (Horizontal Motor — retract)
      if (dmpReady && current_pan <= min_pan_limit) {
        Serial.println(F("[CMD 4 BLOCKED] Min Pan reached"));
        analogWrite(IN3, 0); analogWrite(IN4, 0);
        current_pan_dir = 0;
        break;
      }
      Serial.println(F("[CMD 4] Pan LEFT"));
      analogWrite(IN3, fullPower ? 255 : motorSpeed);
      analogWrite(IN4, 0);
      current_pan_dir = -1;
      break;
    case 5: // Pan right (Horizontal Motor — extend)
      if (dmpReady && current_pan >= max_pan_limit) {
        Serial.println(F("[CMD 5 BLOCKED] Max Pan reached"));
        analogWrite(IN3, 0); analogWrite(IN4, 0);
        current_pan_dir = 0;
        break;
      }
      Serial.println(F("[CMD 5] Pan RIGHT"));
      analogWrite(IN3, 0); 
      analogWrite(IN4, fullPower ? 255 : motorSpeed);
      current_pan_dir = 1;
      break;
    case 6: // Stop pan
      Serial.println(F("[CMD 6] Pan STOP"));
      analogWrite(IN3, 0); analogWrite(IN4, 0);
      current_pan_dir = 0;
      break;
    case 9: // Emergency stop all
      Serial.println(F("[CMD 9] ALL STOP"));
      analogWrite(IN1, 0); analogWrite(IN2, 0);
      analogWrite(IN3, 0); analogWrite(IN4, 0);
      current_pan_dir = 0;
      current_tilt_dir = 0;
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
  if (len == sizeof(PairingAckPkt) && data[0] == 0xAA) {
    PairingAckPkt ack; memcpy(&ack, data, sizeof(ack));
    memcpy(HUB_MAC, info->src_addr, 6);
    got_ack = true;
    Serial.printf("[PAIRING] Got ACK from Hub on channel %d!\n", ack.channel);
    return;
  }
  if (len == sizeof(MotorPkt)) {
    memcpy(&rxPkt, data, sizeof(rxPkt));
    lastCmdTime = millis(); // Reset watchdog on every valid command
    Serial.printf("[ESP-NOW] Cmd received: %d\n", rxPkt.command);
    executeCommand(rxPkt.command);
  }
}

void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS && hub_paired) {
      Serial.println("[ESP-NOW] Send failed.");
  }
}

void clearChannel() {
  prefs.begin("soltra-motor", false);
  prefs.clear();
  prefs.end();
  Serial.println("[Prefs] Cleared WiFi channel — will re-discover on next boot");
}

int wifi_channel = -1;

void scanForHub() {
  Serial.println("[Pairing] Scanning channels for Hub...");
  esp_wifi_set_promiscuous(true);
  if (esp_now_init() != ESP_OK) {
      Serial.println("ESP-NOW init failed");
      return;
  }
  esp_now_register_recv_cb(onDataRecv);

  uint8_t broadcast_mac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  esp_now_peer_info_t bc_peer = {};
  memcpy(bc_peer.peer_addr, broadcast_mac, 6);
  bc_peer.encrypt = false;
  
  for (int ch = 1; ch <= 13; ch++) {
    esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
    bc_peer.channel = ch;
    if (esp_now_is_peer_exist(broadcast_mac)) esp_now_del_peer(broadcast_mac);
    esp_now_add_peer(&bc_peer);

    PairingReqPkt req = {0x99, 0}; // 0 = Motor Controller
    got_ack = false;
    esp_now_send(broadcast_mac, (uint8_t*)&req, sizeof(req));
    
    delay(150);
    if (got_ack) {
      wifi_channel = ch;
      hub_paired = true;
      Serial.printf("[Pairing] Hub found on channel %d!\n", ch);
      break;
    }
  }

  esp_now_deinit();

  if (hub_paired) {
    esp_wifi_set_channel(wifi_channel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
    
    if (esp_now_init() == ESP_OK) {
      esp_now_register_recv_cb(onDataRecv);
      esp_now_register_send_cb(OnDataSent);

      memcpy(peerInfo.peer_addr, HUB_MAC, 6);
      peerInfo.channel = wifi_channel;
      peerInfo.encrypt = false;
      if (esp_now_add_peer(&peerInfo) == ESP_OK) {
        Serial.printf("[ESP-NOW] Ready on channel %d.\n", wifi_channel);
      }
    }
  } else {
    Serial.println("[Pairing] Hub not found. Will retry later.");
  }
}

void setup() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  Serial.begin(115200);

  WiFi.mode(WIFI_STA);
  delay(200);
  Serial.println(F("\n=============================================="));
  Serial.println(F(" PROJECT SOLTRA — Motor Controller"));
  Serial.print(F(" [SETUP] Motor MAC: "));
  Serial.println(WiFi.macAddress());
  Serial.println(F("=============================================="));

  // ── CLEAR CHANNEL button check ────────────────────────────────────────────
  pinMode(CLEAR_CHANNEL_PIN, INPUT_PULLUP);
  delay(100);
  if (digitalRead(CLEAR_CHANNEL_PIN) == LOW) {
    clearChannel();
    Serial.println("[Setup] Boot button held — channel cleared. Reboot to re-discover.");
  }

  esp_wifi_set_promiscuous(true);

  hub_paired = false;
  scanForHub();

  // ── Init MPU6050 ─────────────────────────────────────────────────────────
  mpu.initialize();
  delay(100); // Let MPU settle before DMP init

  // IMPORTANT: Offsets MUST be set before dmpInitialize()
  mpu.setXGyroOffset(361);
  mpu.setYGyroOffset(-69);
  mpu.setZGyroOffset(-21);
  mpu.setZAccelOffset(1638);

  pinMode(INTERRUPT_PIN, INPUT_PULLUP);

  // Retry DMP init up to 3 times
  devStatus = 99;
  for (int attempt = 1; attempt <= 3; attempt++) {
    devStatus = mpu.dmpInitialize();
    if (devStatus == 0) break;
    Serial.printf("[HW] MPU DMP init attempt %d failed (code %d): %s\n",
      attempt, devStatus,
      devStatus == 1 ? "memory load failed" :
      devStatus == 2 ? "DMP config update failed" : "unknown");
    delay(500);
    mpu.reset();
    delay(100);
    mpu.initialize();
    delay(50);
  }

  if (devStatus == 0) {
    mpu.CalibrateAccel(6);
    mpu.CalibrateGyro(6);
    mpu.setDMPEnabled(true);
    attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN), dmpDataReady, RISING);
    mpuIntStatus = mpu.getIntStatus();
    dmpReady = true;
    packetSize = mpu.dmpGetFIFOPacketSize();
    Serial.println(F("[HW] MPU6050 DMP ready — angle-based safety limits ACTIVE"));
  } else {
    Serial.printf("[HW] MPU6050 DMP FAILED after 3 attempts (last code %d)\n", devStatus);
    Serial.println(F("[HW] WARNING: Motor will run WITHOUT angle safety limits!"));
  }

  lastCmdTime = millis(); // Init watchdog timer

  // ── Motor pins ────────────────────────────────────────────────────────────
  pinMode(sensorpin, INPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  analogWrite(IN1, 0); analogWrite(IN2, 0);
  analogWrite(IN3, 0); analogWrite(IN4, 0);
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
        motorSpeed = min(motorSpeed + 25, 250);
        // Note: speed change will take effect on the next movement command
        Serial.printf("Speed: %d\n", motorSpeed);
        break;
      case '-':
        motorSpeed = max(motorSpeed - 25, 0);
        // Note: speed change will take effect on the next movement command
        Serial.printf("Speed: %d\n", motorSpeed);
        break;
      case 'c': case 'C':
        clearChannel();
        Serial.println("Channel cleared via Serial. Please reset the board.");
        break;
      case '1': executeCommand(1); break;
      case '2': executeCommand(2); break;
      case '3': executeCommand(3); break;
      case '4': executeCommand(4); break;
      case '5': executeCommand(5); break;
      case '6': executeCommand(6); break;
      case 's': case 'S': executeCommand(9); break;
      case 'p': case 'P': {
        float p = dmpReady ? ypr[0] * 180 / M_PI + pan_offset : 0;
        float t = dmpReady ? ypr[1] * 180 / M_PI + 90 + tilt_offset : 0;
        Serial.printf("\n--- MOTOR SENSOR STATUS ---\n");
        Serial.printf("Current Pan:  %.2f deg\n", p);
        Serial.printf("Current Tilt: %.2f deg\n", t);
        Serial.printf("Pan Limits:   [%.2f, %.2f]\n", min_pan_limit, max_pan_limit);
        Serial.printf("Tilt Limits:  [%.2f, %.2f]\n", min_tilt_limit, max_tilt_limit);
        Serial.printf("---------------------------\n");
        break;
      }
      case 'z': case 'Z': {
        if (dmpReady) {
          pan_offset = -(ypr[0] * 180 / M_PI);
          Serial.printf("Pan angle zeroed! (Offset: %.2f)\n", pan_offset);
        } else {
          Serial.println("MPU not ready.");
        }
        break;
      }
      case 't': case 'T': {
        if (dmpReady) {
          tilt_offset = -(ypr[1] * 180 / M_PI + 90);
          Serial.printf("Tilt angle zeroed! (Offset: %.2f)\n", tilt_offset);
        } else {
          Serial.println("MPU not ready.");
        }
        break;
      }
      case 'x': {
        max_pan_limit = Serial.parseFloat();
        Serial.printf("Max Pan Limit set to: %.2f\n", max_pan_limit);
        break;
      }
      case 'X': {
        min_pan_limit = Serial.parseFloat();
        Serial.printf("Min Pan Limit set to: %.2f\n", min_pan_limit);
        break;
      }
      case 'y': {
        max_tilt_limit = Serial.parseFloat();
        Serial.printf("Max Tilt Limit set to: %.2f\n", max_tilt_limit);
        break;
      }
      case 'Y': {
        min_tilt_limit = Serial.parseFloat();
        Serial.printf("Min Tilt Limit set to: %.2f\n", min_tilt_limit);
        break;
      }
      case 'v': case 'V': {
        stream_angles = !stream_angles;
        Serial.printf("Live angle streaming: %s\n", stream_angles ? "ON" : "OFF");
        break;
      }
    }
  }

  // ── BUG 2 FIX: Motor Watchdog ─────────────────────────────────────────────
  // If hub stops sending commands (WiFi drop, pairing lost, packet loss),
  // auto-stop all motors after MOTOR_WATCHDOG_MS to prevent runaway.
  // lastCmdTime is updated in onDataRecv on every valid MotorPkt received.
  
  static unsigned long lastPairRetry = 0;
  if (!hub_paired && millis() - lastPairRetry > 10000) {
    lastPairRetry = millis();
    scanForHub();
  }

  if (hub_paired && (millis() - lastCmdTime > MOTOR_WATCHDOG_MS)) {
    static bool watchdog_fired = false;
    if (!watchdog_fired) {
      Serial.println(F("[WATCHDOG] No cmd from hub for 2s — stopping all motors!"));
      analogWrite(IN1, 0); analogWrite(IN2, 0);
      analogWrite(IN3, 0); analogWrite(IN4, 0);
      current_pan_dir = 0;
      current_tilt_dir = 0;
      watchdog_fired = true;
    }
  } else {
    // Reset flag so it fires again if hub drops again
    static bool watchdog_fired = false;
    watchdog_fired = false;
  }

  // ── MPU6050 DMP read (only when DMP is running) ───────────────────────────
  // BUG 2 FIX: Removed early `return` — loop() now always runs fully.
  // Watchdog and telemetry sections below execute even when MPU is down.
  if (dmpReady && mpu.dmpGetCurrentFIFOPacket(fifoBuffer)) {
    mpu.dmpGetQuaternion(&q, fifoBuffer);
    mpu.dmpGetGravity(&gravity, &q);
    mpu.dmpGetYawPitchRoll(ypr, &q, &gravity);

    float current_pan = ypr[0] * 180 / M_PI + pan_offset;
    float current_tilt = ypr[1] * 180 / M_PI + 90 + tilt_offset;

    // Continuous safety bounds check (only when angle data is valid)
    if (current_pan_dir == 1 && current_pan >= max_pan_limit) {
      Serial.println(F("[SAFETY] Max Pan reached. Stopping."));
      analogWrite(IN3, 0); analogWrite(IN4, 0);
      current_pan_dir = 0;
    } else if (current_pan_dir == -1 && current_pan <= min_pan_limit) {
      Serial.println(F("[SAFETY] Min Pan reached. Stopping."));
      analogWrite(IN3, 0); analogWrite(IN4, 0);
      current_pan_dir = 0;
    }
    if (current_tilt_dir == 1 && current_tilt >= max_tilt_limit) {
      Serial.println(F("[SAFETY] Max Tilt reached. Stopping."));
      analogWrite(IN1, 0); analogWrite(IN2, 0);
      current_tilt_dir = 0;
    } else if (current_tilt_dir == -1 && current_tilt <= min_tilt_limit) {
      Serial.println(F("[SAFETY] Min Tilt reached. Stopping."));
      analogWrite(IN1, 0); analogWrite(IN2, 0);
      current_tilt_dir = 0;
    }

    if (stream_angles && millis() - last_stream_time > 250) {
      last_stream_time = millis();
      Serial.printf("[LIVE] Pan: %.2f | Tilt: %.2f\n", current_pan, current_tilt);
    }
  }

  // ── Periodic telemetry to hub ─────────────────────────────────────────────
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 1000) {
    lastTelemetry = millis();
    if (dmpReady && hub_paired) {
      txPkt.pan_angle  = ypr[0] * 180 / M_PI + pan_offset;
      txPkt.tilt_angle = ypr[1] * 180 / M_PI + 90 + tilt_offset;
      esp_now_send(HUB_MAC, (uint8_t*)&txPkt, sizeof(txPkt));
      Serial.printf("[Telemetry] Pan: %.1f° | Tilt: %.1f°\n", txPkt.pan_angle, txPkt.tilt_angle);
    }
  }
}