import cv2
import numpy as np
import time
import json
import ssl
import threading
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import paho.mqtt.client as mqtt

app = Flask(__name__)
CORS(app)

# ─── HiveMQ Configuration ────────────────────────────────────────────────────
MQTT_HOST    = "5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud"
MQTT_PORT    = 8883
MQTT_USER    = "User_1"
MQTT_PASS    = "hv8y5S9vFwLDJAP"
MQTT_TOPIC   = "helios/control/ai_override"

# ─── Tracking Config ─────────────────────────────────────────────────────────
DEADBAND_PX   = 20
DEG_PER_PIXEL = 0.05
PUBLISH_RATE_S = 0.5
CAMERA_URL = "http://192.168.100.32:81/stream"  # Node 4 IP

# Global state
is_tracking = False
mqtt_client = None
last_pub_time = 0

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] Connected to HiveMQ Cloud OK")
    else:
        print(f"[MQTT] Failed to connect, return code {rc}")

def setup_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(client_id="SoltraCVBackend", protocol=mqtt.MQTTv311)
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    context = ssl.create_default_context()
    mqtt_client.tls_set_context(context)
    mqtt_client.on_connect = on_connect
    try:
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"[MQTT] Connection error: {e}")

setup_mqtt()

def generate_frames():
    global is_tracking, last_pub_time, mqtt_client

    print(f"[CV] Attempting to connect to camera at {CAMERA_URL}...")
    cap = cv2.VideoCapture(CAMERA_URL)
    
    if not cap.isOpened():
        print("[CV] ERROR: Cannot open video stream.")
        return

    print("[CV] Stream opened successfully.")

    while True:
        ret, frame = cap.read()
        if not ret:
            # Reconnect logic
            time.sleep(1)
            cap = cv2.VideoCapture(CAMERA_URL)
            continue

        h, w = frame.shape[:2]
        center_x, center_y = w // 2, h // 2

        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Threshold: >240 is very bright (sun/light source)
        _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
        
        # Find contours of bright blobs
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

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

                    if is_tracking:
                        # ── Calculate error ───────────────────────────────────────
                        pan_offset  =  sun_x - center_x   # pixels
                        tilt_offset =  center_y - sun_y   # pixels (Y axis flipped)

                        # ── Deadband + degree conversion ──────────────────────────
                        pan_deg  = pan_offset  * DEG_PER_PIXEL if abs(pan_offset)  > DEADBAND_PX else 0.0
                        tilt_deg = tilt_offset * DEG_PER_PIXEL if abs(tilt_offset) > DEADBAND_PX else 0.0

                        current_time = time.time()
                        if (current_time - last_pub_time) > PUBLISH_RATE_S:
                            if pan_deg != 0.0 or tilt_deg != 0.0:
                                payload = {
                                    "target_pan": round(pan_deg, 2),
                                    "target_tilt": round(tilt_deg, 2),
                                    "device_id": "Node4"
                                }
                                if mqtt_client:
                                    mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
                                print(f"[TRACKING] Sent override: {payload}")
                                last_pub_time = current_time

        if not sun_found:
            cv2.putText(frame, "SUN NOT DETECTED", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        else:
            status_color = (0, 255, 0) if is_tracking else (0, 165, 255)
            status_text = "TRACKING ACTIVE" if is_tracking else "TRACKING PAUSED"
            cv2.putText(frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 2)

        # Encode the frame in JPEG format
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        
        frame_bytes = buffer.tobytes()

        # Yield the output frame in the byte format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/track/start', methods=['POST'])
def start_tracking():
    global is_tracking
    is_tracking = True
    return jsonify({"status": "success", "message": "Tracking started."})

@app.route('/api/track/stop', methods=['POST'])
def stop_tracking():
    global is_tracking
    is_tracking = False
    return jsonify({"status": "success", "message": "Tracking stopped."})

@app.route('/api/track/status', methods=['GET'])
def get_status():
    return jsonify({"is_tracking": is_tracking})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
