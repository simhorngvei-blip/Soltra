#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include "Adafruit_TSL2591.h"
#include "SensorModule.h"

// XIAO S3 specific pins
const int BAT_PIN = 1; 
const int LDR_PIN = 2;
const int UV_PIN  = 3; 
const int LED_PIN = 4; // D3 on the XIAO S3 maps to GPIO 4

Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
bool tsl_found = false;

void initSensors() {
  analogSetAttenuation(ADC_11db); 
  
  // Initialize the external LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Start with it ON to show power
  
  Wire.begin();
  if (tsl.begin()) {
    tsl.setGain(TSL2591_GAIN_LOW); 
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
    tsl_found = true;
  }
}

void readSensors(int* ldr, float* uv, float* ir, float* battery) {
  // BLINK ON: Show we are starting a read/transmit cycle
  digitalWrite(LED_PIN, LOW); 

  int raw_bat = analogRead(BAT_PIN);
  *battery = (raw_bat / 4095.0) * 3.3 * 2.0; 
  *ldr = 4095 - analogRead(LDR_PIN);
  
  int uv_raw = analogRead(UV_PIN);
  float uv_voltage = (uv_raw / 4095.0) * 3.3; 
  *uv = uv_voltage / 0.1; 
  
  *ir = 0.0;
  if (tsl_found) {
    uint32_t lum = tsl.getFullLuminosity();
    uint16_t ir_val = lum >> 16;
    uint16_t full_val = lum & 0xFFFF;
    *ir = (full_val > 0) ? ((float)ir_val / (float)full_val) : 0.0;
  }

  delay(50); // Keep LED on long enough to see the flash
  digitalWrite(LED_PIN, HIGH); // BLINK OFF
}