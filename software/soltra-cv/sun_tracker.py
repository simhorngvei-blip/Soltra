import cv2
import numpy as np
import time
import json
import ssl
import paho.mqtt.client as mqtt

# ─── HiveMQ Configuration ────────────────────────────────────────────────────
# Matches soltra_config.h / soltra-saas .env values
MQTT_HOST    = "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
MQTT_PORT    = 8883
MQTT_USER    = "User_1"
MQTT_PASS    = "hv8y5S9vFwLDJAP"
MQTT_TOPIC   = "helios/control/ai_override"

# ─── Tracking Config ─────────────────────────────────────────────────────────
# Deadband: ignore sun offsets smaller than this (pixels).
# Increase if the panel hunts / oscillates too much.
DEADBAND_PX   = 20

# How many degrees to move per pixel of offset error.
# Tune this to your motor gearing / lens FOV.
DEG_PER_PIXEL = 0.05   # e.g. 20px error → 1.0° correction

# Minimum seconds between MQTT publishes (rate-limit to protect motors)
PUBLISH_RATE_S = 0.5

def main():
    print("=======================================================")
    print("  SOLTRA COMPUTER VISION — SUN TRACKER + MQTT CONTROL  ")
    print("=======================================================")

    # ── MQTT Setup ────────────────────────────────────────────────────────────
    mqtt_connected = False

    def on_connect(client, userdata, flags, rc):
        nonlocal mqtt_connected
        if rc == 0:
            mqtt_connected = True
            print(f"[MQTT] Connected to HiveMQ Cloud ✓")
        else:
            print(f"[MQTT] Connection failed, rc={rc}")

    def on_disconnect(client, userdata, rc):
        nonlocal mqtt_connected
        mqtt_connected = False
        print(f"[MQTT] Disconnected (rc={rc}). Will reconnect...")

    mq = mqtt.Client(client_id="Soltra-CV-Tracker", protocol=mqtt.MQTTv311)
    mq.username_pw_set(MQTT_USER, MQTT_PASS)
    mq.tls_set(cert_reqs=ssl.CERT_NONE)
    mq.tls_insecure_set(True)
    mq.on_connect    = on_connect
    mq.on_disconnect = on_disconnect

    print(f"[MQTT] Connecting to {MQTT_HOST}:{MQTT_PORT}...")
    mq.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    mq.loop_start()

    # Wait briefly for connection
    time.sleep(2.0)
    if not mqtt_connected:
        print("[MQTT] Warning: Not yet connected. CV tracker will run but cannot send motor commands.")

    # ── Camera Stream ─────────────────────────────────────────────────────────
    ip_addr = input("Enter Camera Node IP (e.g. 192.168.1.50) or press Enter for mDNS: ").strip()
    if not ip_addr:
        ip_addr = "soltra-camera.local"

    stream_url = f"http://{ip_addr}/stream"
    print(f"[CV] Connecting to {stream_url} ...")

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print("[CV] Error: Could not open stream. Check IP and WiFi.")
        mq.loop_stop()
        return

    print("[CV] Connected! Press 'q' to quit.")
    print(f"[CV] Deadband: ±{DEADBAND_PX}px | Scale: {DEG_PER_PIXEL}°/px | Rate: {PUBLISH_RATE_S}s")

    last_print_time  = time.time()
    last_publish_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[CV] Failed to grab frame. Stream dropped.")
            break

        height, width = frame.shape[:2]
        center_x, center_y = width // 2, height // 2

        # 1. Grayscale + Blur
        gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (21, 21), 0)

        # 2. Threshold — only pixels brighter than 240/255 survive
        _, thresh = cv2.threshold(blurred, 240, 255, cv2.THRESH_BINARY)

        # 3. Find contours of bright blobs
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        current_time = time.time()

        # Draw centre crosshair (red)
        cv2.line(frame, (center_x, center_y - 20), (center_x, center_y + 20), (0, 0, 255), 2)
        cv2.line(frame, (center_x - 20, center_y), (center_x + 20, center_y), (0, 0, 255), 2)

        sun_found = False
        if contours:
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            largest  = contours[0]
            area     = cv2.contourArea(largest)

            if area > 100:
                M = cv2.moments(largest)
                if M["m00"] != 0:
                    sun_x = int(M["m10"] / M["m00"])
                    sun_y = int(M["m01"] / M["m00"])
                    sun_found = True

                    # Draw tracking box + centroid (cyan)
                    bx, by, bw, bh = cv2.boundingRect(largest)
                    cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (255, 255, 0), 2)
                    cv2.circle(frame, (sun_x, sun_y), 5, (255, 255, 0), -1)

                    # Draw error line from centre to sun
                    cv2.line(frame, (center_x, center_y), (sun_x, sun_y), (0, 255, 0), 1)

                    # ── Calculate error ───────────────────────────────────────
                    # pan_offset > 0  → sun is RIGHT of centre → rotate CW (positive pan)
                    # tilt_offset > 0 → sun is ABOVE centre   → tilt up (positive tilt)
                    pan_offset  =  sun_x - center_x   # pixels
                    tilt_offset =  center_y - sun_y   # pixels (Y axis flipped)

                    # ── Deadband + degree conversion ──────────────────────────
                    pan_deg  = pan_offset  * DEG_PER_PIXEL if abs(pan_offset)  > DEADBAND_PX else 0.0
                    tilt_deg = tilt_offset * DEG_PER_PIXEL if abs(tilt_offset) > DEADBAND_PX else 0.0

                    # ── MQTT publish (rate-limited) ───────────────────────────
                    if (current_time - last_publish_time) >= PUBLISH_RATE_S:
                        last_publish_time = current_time

                        payload = json.dumps({
                            "mode":      "CV_SUN_TRACK",
                            "pan_delta":  round(pan_deg,  2),
                            "tilt_delta": round(tilt_deg, 2),
                            "sun_px_x":  sun_x,
                            "sun_px_y":  sun_y,
                            "area":      int(area),
                        })

                        if mqtt_connected:
                            mq.publish(MQTT_TOPIC, payload, qos=0)
                            status_str = "SENT ✓"
                        else:
                            status_str = "MQTT DOWN"

                        if current_time - last_print_time > 0.5:
                            print(
                                f"[MOTOR] Area:{area:>6}px | "
                                f"PAN:{pan_offset:>+5}px → {pan_deg:>+5.1f}° | "
                                f"TILT:{tilt_offset:>+5}px → {tilt_deg:>+5.1f}° | "
                                f"{status_str}"
                            )
                            last_print_time = current_time
                    else:
                        if current_time - last_print_time > 0.5:
                            print(
                                f"[TRACK] Area:{area:>6}px | "
                                f"PAN:{pan_offset:>+5}px | "
                                f"TILT:{tilt_offset:>+5}px | "
                                f"(within deadband: pan={'IN' if abs(pan_offset)<=DEADBAND_PX else 'OUT'}, "
                                f"tilt={'IN' if abs(tilt_offset)<=DEADBAND_PX else 'OUT'})"
                            )
                            last_print_time = current_time

        if not sun_found:
            if current_time - last_print_time > 1.0:
                print("[SEARCH] No sun detected. Panel holding position.")
                last_print_time = current_time

        # Show windows
        cv2.imshow("Soltra CV — Sun Tracker", frame)
        cv2.imshow("Soltra CV — Threshold Mask", thresh)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    mq.loop_stop()
    mq.disconnect()
    print("[CV] Tracker stopped.")

if __name__ == "__main__":
    main()
