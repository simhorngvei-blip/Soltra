import { writable } from 'svelte/store';
import mqtt from 'mqtt';

export const mqttStatus = writable('DISCONNECTED');
export const logs = writable<{ topic: string, payload: string, timestamp: string }[]>([]);
export const telemetry = writable({
  wind_speed: 0,
  solar_yield: 0,
  panel_angle: 0,
  status: '--',
  wind_alert: false,
  node_online: false,
  light_level: '--'
});

let client: mqtt.MqttClient | null = null;

export function initMqtt(config?: { host?: string, user?: string, pass?: string }) {
  if (client) {
    client.end(true);
    client = null;
  }

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
