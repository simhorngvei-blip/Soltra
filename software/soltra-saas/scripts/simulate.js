/**
 * PROJECT SOLTRA — Hardware Simulator v2
 * Mimics a Heltec V3 Hub:
 *   1. Publishes telemetry to helios/telemetry every 5s
 *   2. Subscribes to helios/control/manual and logs received commands
 *
 * Run with: node scripts/simulate.js
 */

const mqtt = require('mqtt');
require('dotenv').config({ path: '.env.local' });

const host     = process.env.NEXT_PUBLIC_HIVEMQ_HOST;
const port     = 8883;
const username = process.env.NEXT_PUBLIC_HIVEMQ_USER;
const password = process.env.NEXT_PUBLIC_HIVEMQ_PASS;

if (!host || !password) {
  console.error("❌ ERROR: Missing HiveMQ credentials in .env.local");
  process.exit(1);
}

const client = mqtt.connect(`mqtts://${host}`, {
  port,
  username,
  password,
  clientId: 'soltra_sim_hub_' + Math.random().toString(16).slice(2, 8),
});

console.log(`[SIM] Connecting to HiveMQ at ${host}...`);

// ─── State ───────────────────────────────────────────────────────────────────
let panelAngle = 180.0;
let solarBase  = 850.0;
let currentStatus = 'tracking_active';

// Command labels for logging
const CMD_LABELS = {
  '1': 'RETRACT_H', '2': 'EXTEND_H',  '3': 'STOP_H',
  '4': 'RETRACT_V', '5': 'EXTEND_V',  '6': 'STOP_V',
};

client.on('connect', () => {
  console.log("✅ Connected! Starting telemetry stream...\n");

  // Subscribe to control commands (same as real firmware)
  client.subscribe('helios/control/manual', { qos: 0 }, () => {
    console.log("[SIM] 📡 Listening for commands on helios/control/manual\n");
  });

  // ─── Telemetry Loop ────────────────────────────────────────────────────
  setInterval(() => {
    panelAngle += (Math.random() - 0.45) * 2;
    if (panelAngle > 270) panelAngle = 90;

    const solarYield = solarBase + (Math.random() - 0.5) * 50;
    const windSpeed  = 8.0 + (Math.random() * 5);
    const windAlert  = windSpeed > 12.5;

    // Reflect motor commands in status
    if (windAlert) currentStatus = 'emergency_stow';

    const payload = {
      wind_speed:  parseFloat(windSpeed.toFixed(1)),
      solar_yield: parseFloat(solarYield.toFixed(1)),
      panel_angle: parseFloat(panelAngle.toFixed(1)),
      wind_alert:  windAlert,
      light_level: Math.floor(Math.random() * 100),
      node_online: true,
      status:      currentStatus,
    };

    client.publish('helios/telemetry', JSON.stringify(payload), { qos: 0 });
    console.log(`[TX] ↑ ${JSON.stringify(payload)}`);
  }, 5000);
});

// ─── Command Receiver ────────────────────────────────────────────────────────
client.on('message', (topic, payload) => {
  if (topic === 'helios/control/manual') {
    const cmd = payload.toString().trim();
    const label = CMD_LABELS[cmd] || `UNKNOWN(${cmd})`;

    console.log(`\n⚡ [RX] ↓ COMMAND RECEIVED: ${cmd} → ${label}`);
    console.log(`   └── Routing to motor node via ESP-NOW (simulated)\n`);

    // Update status to reflect the command
    if (cmd === '3' || cmd === '6') {
      currentStatus = 'motors_stopped';
    } else {
      currentStatus = `executing_${label.toLowerCase()}`;
    }
  }
});

client.on('error', (err) => {
  console.error("❌ MQTT Error:", err);
});
