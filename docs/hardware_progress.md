# Component Progress: Hardware

## 1. Master Hub (Central Command)
**Hardware:** Heltec WiFi LoRa 32 (V3)
**Status:** ✅ Phase 5 Complete
- [x] Dual-Core FreeRTOS Architecture.
- [x] WiFiManager captive portal for credential entry.
- [x] HiveMQ TLS MQTT Gateway (Port 8883).
- [x] **Wind Detection:** MPU6050 installed on the stationary Hub for system shake/wind alerts.
- [x] **Environmental Tracking:** BME280 Humidity sensor integrated.
- [x] **Decision Engine:** Light Tracking logic active to balance light across nodes.
- [x] **Zero-Collision Polling:** ESP-NOW Radio Master logic established.

## 2. Motor Node (Mechanical Logic)
**Hardware:** Wemos D1 R32 (ESP32) + L298N Motor Driver
**Status:** ✅ Phase 2 Complete
- [x] **Brain Transplant:** Integration of Wemos D1 R32 for 3.3V modern logic.
- [x] **Motor Control:** Driving dual axes (Horizontal/Vertical) via L298N.
- [x] **Active Telemetry:** Second MPU6050 integrated to actively broadcast real-time Pan/Tilt angles back to the Master Hub via ESP-NOW.

## 3. Tactical Nodes (Peripheral Corners)
**Hardware:** Seeed XIAO ESP32-C3
**Status:** 🏗️ In Progress
- [x] Ultra-low power sleep cycles (1.6mA avg).
- [x] ESP-NOW Pager protocol integration.
- [ ] TinyML localized light filtering (AC vs DC light).

## 4. Overwatch Node (Visual Centroid)
**Hardware:** Seeed XIAO ESP32-S3 Sense
**Status:** 🏗️ In Progress (Phase 10)
- [x] Hardware identified and configured for low power.
- [x] OpenCV-based Sun Centroid tracking prototype (`sun_tracker.py`).
- [x] Camera stream endpoint testing (`CameraWebServer`).
- [ ] Visual Cloud Mapping and direct Motor Override.
