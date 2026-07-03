import cv2
import numpy as np
import time
import json
import ssl
import threading
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import paho.mqtt.client as mqtt

import os
from dotenv import load_dotenv
load_dotenv()

from inference_sdk import InferenceHTTPClient

app = Flask(__name__)
CORS(app)

ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY")
if ROBOFLOW_API_KEY:
    CLIENT = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=ROBOFLOW_API_KEY
    )
else:
    CLIENT = None

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
CAMERA_URL = "http://10.45.27.233/stream"  # Node 4 IP

# Global state
is_tracking = False
mqtt_client = None
last_pub_time = 0

latest_raw_frame = None
latest_cv_frame = None
frame_condition = threading.Condition()

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

def camera_thread():
    global is_tracking, last_pub_time, mqtt_client
    global latest_raw_frame, latest_cv_frame

    import requests
    while True:
        print(f"[CV] Attempting to connect to camera at {CAMERA_URL}...")
        try:
            res = requests.get(CAMERA_URL, stream=True, timeout=10)
            if res.status_code != 200:
                print(f"[CV] ERROR: Unexpected status code {res.status_code}. Retrying in 2s...")
                time.sleep(2)
                continue
                
            print("[CV] Stream opened successfully.")
            bytes_buffer = bytes()
            
            for chunk in res.iter_content(chunk_size=4096):
                if not chunk:
                    break
                bytes_buffer += chunk
                a = bytes_buffer.find(b'\xff\xd8')
                b = bytes_buffer.find(b'\xff\xd9')
                if a != -1 and b != -1:
                    jpg = bytes_buffer[a:b+2]
                    bytes_buffer = bytes_buffer[b+2:]
                    frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                    
                    if frame is None:
                        continue
                        
                    raw_bytes = jpg

                    # ─── CV Processing ──────────────────────────────────────────────────
                    cv_frame = frame.copy()
                    h, w = cv_frame.shape[:2]
                    center_x, center_y = w // 2, h // 2

                    gray = cv2.cvtColor(cv_frame, cv2.COLOR_BGR2GRAY)
                    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
                    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                    cv2.line(cv_frame, (center_x, center_y - 20), (center_x, center_y + 20), (0, 0, 255), 2)
                    cv2.line(cv_frame, (center_x - 20, center_y), (center_x + 20, center_y), (0, 0, 255), 2)

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

                                bx, by, bw, bh = cv2.boundingRect(largest)
                                cv2.rectangle(cv_frame, (bx, by), (bx + bw, by + bh), (255, 255, 0), 2)
                                cv2.circle(cv_frame, (sun_x, sun_y), 5, (255, 255, 0), -1)
                                cv2.line(cv_frame, (center_x, center_y), (sun_x, sun_y), (0, 255, 0), 1)

                                if is_tracking:
                                    pan_offset  =  sun_x - center_x
                                    tilt_offset =  center_y - sun_y

                                    pan_deg  = pan_offset  * DEG_PER_PIXEL if abs(pan_offset)  > DEADBAND_PX else 0.0
                                    tilt_deg = tilt_offset * DEG_PER_PIXEL if abs(tilt_offset) > DEADBAND_PX else 0.0

                                    current_time = time.time()
                                    if (current_time - last_pub_time) > PUBLISH_RATE_S:
                                        payload = {
                                            "mode": "CV_SUN_TRACK",
                                            "pan_delta": round(pan_deg, 2),
                                            "tilt_delta": round(tilt_deg, 2),
                                            "device_id": "Node4"
                                        }
                                        if mqtt_client:
                                            mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
                                        print(f"[TRACKING] Sent override: {payload}")
                                        last_pub_time = current_time

                    if not sun_found:
                        cv2.putText(cv_frame, "SUN NOT DETECTED", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    else:
                        status_color = (0, 255, 0) if is_tracking else (0, 165, 255)
                        status_text = "TRACKING ACTIVE" if is_tracking else "TRACKING PAUSED"
                        cv2.putText(cv_frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 2)

                    ret_cv, cv_buffer = cv2.imencode('.jpg', cv_frame)
                    if ret_cv:
                        cv_bytes = cv_buffer.tobytes()
                    else:
                        cv_bytes = None

                    with frame_condition:
                        latest_raw_frame = raw_bytes
                        latest_cv_frame = cv_bytes
                        frame_condition.notify_all()
                        
        except Exception as e:
            print(f"[CV] Connection error: {e}. Reconnecting in 2s...")
        
        time.sleep(2)

threading.Thread(target=camera_thread, daemon=True).start()

def generate_stream(stream_type="cv"):
    while True:
        with frame_condition:
            frame_condition.wait()
            if stream_type == "cv":
                frame_bytes = latest_cv_frame
            else:
                frame_bytes = latest_raw_frame
        
        if frame_bytes is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_stream("cv"), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/stream')
def raw_stream():
    return Response(generate_stream("raw"), mimetype='multipart/x-mixed-replace; boundary=frame')

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

@app.route('/api/weather', methods=['GET'])
def get_weather():
    if not CLIENT:
        return jsonify({"error": "Roboflow API key not configured"}), 500
    
    with frame_condition:
        frame_bytes = latest_raw_frame
        
    if frame_bytes is None:
        return jsonify({"error": "No camera frame available"}), 503
        
    try:
        with open("temp_weather.jpg", "wb") as f:
            f.write(frame_bytes)
            
        result = CLIENT.infer("temp_weather.jpg", model_id="weather-wcilw/1")
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
