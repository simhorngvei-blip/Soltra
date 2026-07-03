import { writable } from 'svelte/store';
import mqtt from 'mqtt';

export const mqttStatus = writable('DISCONNECTED');
export const logs = writable<{ topic: string, payload: string, timestamp: string }[]>([]);
export const telemetry = writable({
  wind_speed_ms:   0,
  irradiance_wm2:  0,
  pan_angle_deg:   0,
  tilt_angle_deg:  0,
  battery_pct:     0,
  lux:             0,
  uv_index:        0,
  humidity_pct:    0,
  power_watts:     0,
  panel_volts:     0,
  wind_alert:      false,
  status:          '--',
  node_mac:        '',
});

let client: mqtt.MqttClient | null = null;

export function initMqtt(config?: { host?: string, user?: string, pass?: string }) {
  if (client) {
    client.end(true);
    client = null;
  }

  // --- FAKE DATA INJECTION FOR SCREENSHOTS ---
  mqttStatus.set('CONNECTED (SIMULATED)');
  setInterval(() => {
    const raw = JSON.stringify({
      wind_speed_ms: (Math.random() * 3 + 1).toFixed(2),
      irradiance_wm2: Math.floor(Math.random() * 200 + 800),
      pan_angle_deg: Math.floor(Math.random() * 180),
      tilt_angle_deg: Math.floor(Math.random() * 45 + 10),
      battery_pct: Math.floor(Math.random() * 10 + 90),
      lux: Math.floor(Math.random() * 5000 + 50000),
      uv_index: (Math.random() * 2 + 6).toFixed(1),
      humidity_pct: Math.floor(Math.random() * 10 + 50),
      power_watts: (Math.random() * 20 + 150).toFixed(1),
      panel_volts: (Math.random() * 2 + 16).toFixed(1),
      wind_alert: false,
      status: 'TRACKING_ACTIVE',
      node_mac: 'A4:CF:12:F1:C9:8B'
    });
    
    const timestamp = new Date().toLocaleTimeString('en-GB');
    
    logs.update(prev => {
      const newLogs = [...prev, { topic: 'helios/telemetry', payload: raw, timestamp }];
      if (newLogs.length > 50) newLogs.shift();
      return newLogs;
    });

    const data = JSON.parse(raw);
    telemetry.update(prev => ({ ...prev, ...data }));
  }, 1500);
  return;
  // ------------------------------------------

  const host = config?.host || import.meta.env.VITE_HIVEMQ_HOST || 'XXXXXXXX.s1.eu.hivemq.cloud';
  const user = config?.user || import.meta.env.VITE_HIVEMQ_USER || 'helios_hub';
  const pass = config?.pass || import.meta.env.VITE_HIVEMQ_PASS || 'your_password_here';
  const url = `wss://${host}:8884/mqtt`;

  mqttStatus.set('CONNECTING...');
  
  client = mqtt.connect(url, {
    username: user,
    password: pass,
    clientId: 'HeliosHUD-' + Math.random().toString(16).slice(2, 8),
    keepalive: 60,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    mqttStatus.set('CONNECTED');
    client!.subscribe('helios/telemetry', { qos: 0 });
    client!.subscribe('helios/status', { qos: 0 });
  });

  client.on('message', (topic, payload) => {
    const raw = payload.toString();
    const timestamp = new Date().toLocaleTimeString('en-GB');

    logs.update(prev => {
      const newLogs = [...prev, { topic, payload: raw, timestamp }];
      if (newLogs.length > 50) newLogs.shift();
      return newLogs;
    });

    if (topic === 'helios/telemetry') {
      try {
        const data = JSON.parse(raw);
        telemetry.update(prev => ({ ...prev, ...data }));
      } catch (e) {
        console.error('MQTT JSON parse error:', e);
      }
    }
  });

  client.on('error', (err) => {
    console.error('MQTT ERROR:', err);
    mqttStatus.set('ERROR');
  });

  client.on('close', () => {
    mqttStatus.set('DISCONNECTED');
  });
}

export function closeMqtt() {
  if (client) {
    client.end(true);
    client = null;
    mqttStatus.set('DISCONNECTED');
  }
}

export function publishCmd(cmd: number | string) {
  if (client && client.connected) {
    client.publish('helios/control/manual', String(cmd), { qos: 0 });
  } else {
    console.warn('MQTT Publish failed: Not connected');
  }
}
