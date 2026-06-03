const int UV_PIN = A2; // GPIO4 on Xiao ESP32-C3

void setup() {
  Serial.begin(115200);
  
  // Wait for Serial monitor to open
  unsigned long start_wait = millis();
  while (!Serial && millis() - start_wait < 3000) { delay(10); }

  Serial.println("\n==========================================");
  Serial.println("         UV SENSOR ISOLATION TEST         ");
  Serial.println("==========================================");

  // ESP32 requires 11dB attenuation to read up to ~3.3V
  analogSetAttenuation(ADC_11db);
}

void loop() {
  // Read the raw 12-bit ADC value (0-4095)
  int uv_raw = analogRead(UV_PIN);
  
  // Convert raw value to Voltage (assuming 3.3V reference)
  float uv_voltage = (uv_raw / 4095.0) * 3.3; 
  
  // GUVA-S12SD standard curve: 0.1V = 1 UV Index
  float uv_index = uv_voltage / 0.1; 

  Serial.printf("Raw ADC: %4d | Voltage: %.2f V | UV Index: %.2f\n", uv_raw, uv_voltage, uv_index);
  
  delay(1000); // Wait 1 second
}
