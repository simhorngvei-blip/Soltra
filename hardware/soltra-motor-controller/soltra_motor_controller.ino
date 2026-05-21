/* 
 * PROJECT SOLTRA - ESP32 Dev Kit V1
 * 
 * Hardware Connections:
 * - MPU6050: SDA=21, SCL=22, INT=19, AD0=3.3V (sets address to 0x69)
 * - DS1307 RTC: SDA=21, SCL=22, VCC=5V (VIN)
 * - L298N Horizontal Motor: ENA=14, IN1=27, IN2=26
 * - L298N Vertical Motor: ENB=25, IN3=16, IN4=17
 * - Analog Sensor: Signal=34, VCC=3.3V
 */

#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"
#include <Wire.h> 
#include <RtcDS1307.h>

RtcDS1307<TwoWire> Rtc(Wire);

bool wasError(const char* errorTopic = "") {
    uint8_t error = Rtc.LastError();
    if (error != 0) {
        Serial.print("[");
        Serial.print(errorTopic);
        Serial.print("] WIRE communications error (");
        Serial.print(error);
        Serial.print(") : ");

        switch (error) {
        case Rtc_Wire_Error_None:
            Serial.println("(none?!)");
            break;
        case Rtc_Wire_Error_TxBufferOverflow:
            Serial.println("transmit buffer overflow");
            break;
        case Rtc_Wire_Error_NoAddressableDevice:
            Serial.println("no device responded");
            break;
        case Rtc_Wire_Error_UnsupportedRequest:
            Serial.println("device doesn't support request");
            break;
        case Rtc_Wire_Error_Unspecific:
            Serial.println("unspecified error");
            break;
        case Rtc_Wire_Error_CommunicationTimeout:
            Serial.println("communications timed out");
            break;
        }
        return true;
    }
    return false;
}

// Ensure AD0 pin on MPU6050 is wired to 3.3V for 0x69
MPU6050 mpu(0x69); 

// --- ESP32 Dev Kit V1 Pin Definitions ---
const int sensorpin = 34; // ESP32 ADC pin (Analog input)
int waterlevel = 512;
int sensorValue;

// Horizontal motor connections (L298N)
const int ENA = 14; // PWM capable
const int IN1 = 27;
const int IN2 = 26;

// Vertical motor connection (L298N)
const int ENB = 25; // PWM capable
const int IN3 = 16;
const int IN4 = 17;

// ESP32 external interrupt pin for MPU6050
#define INTERRUPT_PIN 19 

int motorSpeed = 150; // Variable speed (0-255)
bool fullPower = false; // Toggle for digital HIGH vs PWM
const int Deg1 = 78;
const int Deg2 = 0;
const int Deg3 = 75;

#define OUTPUT_READABLE_YAWPITCHROLL

// MPU control variables
bool dmpReady = false;
uint8_t mpuIntStatus;
uint8_t devStatus;
uint16_t packetSize;
uint16_t fifoCount;
uint8_t fifoBuffer[64];

// Orientation/Motion variables
Quaternion q;
VectorFloat gravity;
float euler[3];
float ypr[3];

// Packet structure for InvenSense teapot demo
uint8_t teapotPacket[14] = { '$', 0x02, 0,0, 0,0, 0,0, 0,0, 0x00, 0x00, '\r', '\n' };

volatile bool mpuInterrupt = false;

// ESP32 requires IRAM_ATTR for hardware interrupts
void IRAM_ATTR dmpDataReady() {
  mpuInterrupt = true;
}

void setup() {
  // Start I2C on ESP32 Dev Kit V1 standard pins: SDA=21, SCL=22
  Wire.begin(21, 22);
  Wire.setClock(400000); // 400kHz I2C clock

  Serial.begin(115200);
  Rtc.Begin();

  #if defined(WIRE_HAS_TIMEOUT)
    Wire.setWireTimeout(3000 /* us */, true /* reset_on_timeout */);
  #endif

    RtcDateTime compiled = RtcDateTime(__DATE__, __TIME__);
    printDateTime(compiled);
    Serial.println();

    if (!Rtc.IsDateTimeValid()) {
        if (!wasError("setup IsDateTimeValid")) {
            Serial.println("RTC lost confidence in the DateTime!");
            Rtc.SetDateTime(compiled);
        }
    }

    if (!Rtc.GetIsRunning()) {
        if (!wasError("setup GetIsRunning")) {
            Serial.println("RTC was not actively running, starting now");
            Rtc.SetIsRunning(true);
        }
    }

    RtcDateTime now = Rtc.GetDateTime();
    if (!wasError("setup GetDateTime")) {
        if (now < compiled) {
            Serial.println("RTC is older than compile time, updating DateTime");
            Rtc.SetDateTime(compiled);
        }
        else if (now > compiled) {
            Serial.println("RTC is newer than compile time, this is expected");
        }
        else if (now == compiled) {
            Serial.println("RTC is the same as compile time, while not expected all is still fine");
        }
    }

    Rtc.SetSquareWavePin(DS1307SquareWaveOut_Low); 
    wasError("setup SetSquareWavePin");
  
  while(!Serial); // Wait for serial connection

  Serial.println(F("Initializing I2C devices..."));
  mpu.initialize();
  pinMode(INTERRUPT_PIN, INPUT_PULLUP);

  // Verify MPU connection
  Serial.println(F("Testing device connections..."));
  Serial.println(mpu.testConnection() ? F("MPU6050 connection successful") : F("MPU6050 connection failed"));

  Serial.println(F("Initializing DMP..."));
  devStatus = mpu.dmpInitialize();

  // Gyro offsets (tune these for your specific module if needed)
  mpu.setXGyroOffset(361);
  mpu.setYGyroOffset(-69);
  mpu.setZGyroOffset(-21);
  mpu.setZAccelOffset(1638);

  if(devStatus == 0){
    mpu.CalibrateAccel(6);
    mpu.CalibrateGyro(6);
    mpu.PrintActiveOffsets();

    Serial.println(F("Enabling DMP..."));
    mpu.setDMPEnabled(true);

    Serial.println(F("Enabling interrupt detection (ESP32 external interrupt)..."));
    attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN), dmpDataReady, RISING);
    mpuIntStatus = mpu.getIntStatus();

    Serial.println(F("DMP ready! Waiting for first interrupt..."));
    dmpReady = true;
    packetSize = mpu.dmpGetFIFOPacketSize();

  } else {
    Serial.print(F("DMP Initialization failed (code "));
    Serial.print(devStatus);
    Serial.println(F(")"));
  }
    
  // Motor & Sensor Pin Setup
  pinMode(sensorpin, INPUT);
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  // Turn OFF all motors initially
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

void loop() {
  // Check for serial input for manual control
  if (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    
    switch (inChar) {
      case 'f':
      case 'F':
        fullPower = !fullPower;
        Serial.print(F("Full Power Mode: ")); Serial.println(fullPower ? F("ON") : F("OFF"));
        break;
      case '+': // Increase speed
        motorSpeed = min(motorSpeed + 25, 255);
        Serial.print(F("Speed set to: ")); Serial.println(motorSpeed);
        if (!fullPower) { analogWrite(ENA, motorSpeed); analogWrite(ENB, motorSpeed); }
        break;
      case '-': // Decrease speed
        motorSpeed = max(motorSpeed - 25, 0);
        Serial.print(F("Speed set to: ")); Serial.println(motorSpeed);
        if (!fullPower) { analogWrite(ENA, motorSpeed); analogWrite(ENB, motorSpeed); }
        break;
      case '1': // Motor A (Horizontal) Retract
        Serial.println(F("M-A (Horizontal): RETRACTING"));
        if (fullPower) digitalWrite(ENA, HIGH); else analogWrite(ENA, motorSpeed);
        digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
        break;
      case '2': // Motor A (Horizontal) Extend
        Serial.println(F("M-A (Horizontal): EXTENDING"));
        if (fullPower) digitalWrite(ENA, HIGH); else analogWrite(ENA, motorSpeed);
        digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
        break;
      case '3': // Motor A Stop
        Serial.println(F("M-A (Horizontal): STOPPED"));
        digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
        break;
      case '4': // Motor B (Vertical) Retract
        Serial.println(F("M-B (Vertical): RETRACTING"));
        if (fullPower) digitalWrite(ENB, HIGH); else analogWrite(ENB, motorSpeed);
        digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
        break;
      case '5': // Motor B (Vertical) Extend
        Serial.println(F("M-B (Vertical): EXTENDING"));
        if (fullPower) digitalWrite(ENB, HIGH); else analogWrite(ENB, motorSpeed);
        digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
        break;
      case '6': // Motor B Stop
        Serial.println(F("M-B (Vertical): STOPPED"));
        digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
        break;
      case 's':
      case 'S':
        Serial.println(F("### ALL MOTORS STOPPED ###"));
        digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
        break;
    }
  }

  // MPU6050 Routine
  if(!dmpReady) return;
  
  if (mpu.dmpGetCurrentFIFOPacket(fifoBuffer)) {
    #ifdef OUTPUT_READABLE_YAWPITCHROLL
    mpu.dmpGetQuaternion(&q, fifoBuffer);
    mpu.dmpGetGravity(&gravity, &q);
    mpu.dmpGetYawPitchRoll(ypr, &q, &gravity);
    Serial.print("ypr\t");
    Serial.print(ypr[0] * 180/M_PI);
    Serial.print("\t");
    Serial.print(ypr[1] * 180/M_PI + 90);
    Serial.print("\t");
    Serial.println(ypr[2] * 180/M_PI + 70);
    #endif
  }
  
  // Sensor Routine
  sensorValue = analogRead(sensorpin);
  
  // RTC Routine
  if (!Rtc.IsDateTimeValid()) {
        if (!wasError("loop IsDateTimeValid")) {
            Serial.println("RTC lost confidence in the DateTime!");
        }
  }

  RtcDateTime now = Rtc.GetDateTime();
  if (!wasError("loop GetDateTime")) {
      printDateTime(now);
      Serial.println();
  }

  delay(100); 
}

// Function to run pre-programmed motor sequence
void directionControl() {
  analogWrite(ENA, 150); 
  analogWrite(ENB, 150); 

  // --- RETRACT PHASE ---
  Serial.println(F("Testing: Retracting BOTH actuators (60s)..."));
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  delay(60000); 
  
  // --- EXTEND PHASE ---
  Serial.println(F("Testing: Extending BOTH actuators (60s)..."));
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  delay(60000); 
  
  // --- STOP ---
  Serial.println(F("Test Complete: Stopping motors."));
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

#define countof(a) (sizeof(a) / sizeof(a[0]))

void printDateTime(const RtcDateTime& dt) {
    char datestring[26];

    snprintf_P(datestring, 
            countof(datestring),
            PSTR("%02u/%02u/%04u %02u:%02u:%02u"),
            dt.Month(),
            dt.Day(),
            dt.Year(),
            dt.Hour(),
            dt.Minute(),
            dt.Second() );
    Serial.print(datestring);
}