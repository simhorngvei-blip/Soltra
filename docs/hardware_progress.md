# Component Progress: Hardware

## 1. Master Hub (Central Command)
**Hardware:** Heltec WiFi LoRa 32 (V3)
**Status:** ✅ Phase 5 Complete
- [x] Dual-Core FreeRTOS Architecture.
- [x] WiFiManager captive portal for credential entry.
- [x] HiveMQ TLS MQTT Gateway (Port 8883).
- [x] **Sensor Relocation:** MPU6050 (Gyrometer) and DS1302 RTC moved to stationary Hub for stability.
- [x] **Zero-Collision Polling:** ESP-NOW Radio Master logic established.

## 2. Motor Node (Mechanical Logic)
**Hardware:** Wemos D1 R32 (ESP32) + Cytron MDD3A Driver
**Status:** ✅ Phase 1 Complete
- [x] **Legacy Teardown:** Isolation of DC motors from legacy Arduino/L298N.
- [x] **Brain Transplant:** Integration of Wemos D1 R32 for 3.3V modern logic.
- [x] **Driver Upgrade:** MDD3A solid-state driver installed for high-efficiency tilt/pan.

## 3. Tactical Nodes (Peripheral Corners)
**Hardware:** Seeed XIAO ESP32-C3
**Status:** ✅ Complete
- [x] Ultra-low power sleep cycles (1.6mA avg).
- [x] TinyML localized light filtering (AC vs DC light).
- [x] ESP-NOW Pager protocol integration.

## 4. Overwatch Node (Visual Centroid)
**Hardware:** Seeed XIAO ESP32-S3 Sense
**Status:** 🏗️ In Progress (Phase 10)
- [x] Hardware identified and configured for low power.
- [ ] CNN-based Sun Centroid tracking.
- [ ] Visual Cloud Mapping.
