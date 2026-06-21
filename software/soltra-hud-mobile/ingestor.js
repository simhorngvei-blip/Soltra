import 'dotenv/config';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const host = process.env.VITE_HIVEMQ_HOST;
const user = process.env.VITE_HIVEMQ_USER;
const pass = process.env.VITE_HIVEMQ_PASS;
const port = process.env.VITE_HIVEMQ_PORT || 8884;

const mqttUrl = `wss://${host}:${port}/mqtt`;

console.log('Connecting to MQTT and Supabase...');

const client = mqtt.connect(mqttUrl, {
  username: user,
  password: pass,
  clientId: 'Ingestor-' + Math.random().toString(16).slice(2, 8),
});

client.on('connect', () => {
  console.log('✅ Connected to HiveMQ!');
  client.subscribe('helios/telemetry', { qos: 0 });
});

client.on('message', async (topic, payload) => {
  if (topic === 'helios/telemetry') {
    try {
      const data = JSON.parse(payload.toString());
      
      const macAddress = data.node_mac || 'unknown_node';
      
      // Look up node UUID by MAC address
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select('id')
        .eq('mac_address', macAddress)
        .single();
        
      if (nodeError || !nodeData) {
        console.warn(`Node with MAC ${macAddress} not found in nodes table. Skipping telemetry insert.`);
        return;
      }
      
      const nodeId = nodeData.id;

      const record = {
        node_id: nodeId,
        recorded_at: new Date().toISOString(),
        watts: data.power_watts || null,
        volts: data.panel_volts || null,
        pan_angle: data.pan_angle_deg || null,
        tilt_angle: data.tilt_angle_deg || null,
        wind_speed: data.wind_speed_ms || null,
        irradiance: data.irradiance_wm2 || null,
        wind_alert: data.wind_alert || false,
        node_status: data.status || null,
      };

      const { error } = await supabase.from('telemetry').insert(record);

      if (error) {
        if (error.code === '23503') { // foreign_key_violation
          console.warn(`Node ${nodeId} not found in nodes table. Please create it or fix FK constraints.`);
          console.error("Supabase insert error (FK):", error.message);
        } else {
          console.error("Supabase insert error:", error);
        }
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Saved telemetry -> Irradiance: ${record.irradiance} W/m2, Wind: ${record.wind_speed} m/s`);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  }
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
