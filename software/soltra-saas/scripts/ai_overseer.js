const mqtt = require('mqtt');
require('dotenv').config({ path: '../.env.local' });

// HiveMQ Connection Settings
const MQTT_HOST = process.env.MQTT_HOST || 'mqtts://5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud:8883';
const MQTT_USER = process.env.MQTT_USER || 'User_1';
const MQTT_PASS = process.env.MQTT_PASS || 'hv8y5S9vFwLDJAP';

const client = mqtt.connect(MQTT_HOST, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `soltra-ai-overseer-${Math.random().toString(16).slice(2, 8)}`,
});

console.log('🤖 AI Overseer: Starting up...');

client.on('connect', () => {
  console.log('✅ Connected to HiveMQ as AI Overseer.');
  client.subscribe('helios/telemetry', (err) => {
    if (!err) console.log('📡 Subscribed to telemetry stream.');
  });
});

let consecutiveLowIrradiance = 0;

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';

async function askOllama(telemetryData, heuristicRec) {
  const prompt = `You are the AI Overseer for a commercial solar tracking array.
Current Telemetry: ${JSON.stringify(telemetryData)}
Heuristic Recommendation: ${heuristicRec}

You have the final say on the tracking mode. Consider the telemetry and the heuristic.
- 'auto': use hardware LDR sensors (default for clear skies).
- 'ephemeris': use mathematical fallback (use when cloudy or erratic irradiance).
- 'stow': stow panels flat (use during high winds or severe storms).

Respond with exactly one word from the list [auto, ephemeris, stow] representing your final decision. Do not include any punctuation or reasoning.`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:0.5b',
        prompt: prompt,
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const decision = data.response.trim().toLowerCase();
      if (['auto', 'ephemeris', 'stow'].includes(decision)) {
        return decision;
      }
    }
  } catch (error) {
    console.error('⚠️ Ollama connection failed, falling back to heuristic:', error.message);
  }
  return heuristicRec; // Fallback if Ollama is down or returns invalid response
}

client.on('message', async (topic, message) => {
  if (topic === 'helios/telemetry') {
    try {
      const data = JSON.parse(message.toString());
      
      // 🧠 STEP 1: HEURISTIC LOGIC
      let heuristicRec = 'auto'; // default state

      if (data.wind_speed > 20.0) {
        heuristicRec = 'stow';
      } else if (data.irradiance < 300) {
        consecutiveLowIrradiance++;
        if (consecutiveLowIrradiance > 5) {
          heuristicRec = 'ephemeris';
        } else if (data.status.includes('ephemeris') || data.status.includes('stow')) {
          heuristicRec = 'auto'; // Try reverting to auto if irradiance just dropped but hasn't persisted
        }
      } else {
        consecutiveLowIrradiance = 0;
        heuristicRec = 'auto';
      }

      // Avoid spamming commands if the hardware is already in the target state
      // (Unless it's an emergency stow)
      const currentState = data.status;
      const isAlreadyEphemeris = currentState.includes('ephemeris');
      const isAlreadyStow = currentState.includes('stow');
      const isAlreadyAuto = !currentState.includes('ai_') && !isAlreadyEphemeris && !isAlreadyStow;

      // 🧠 STEP 2: OLLAMA DECISION
      const finalDecision = await askOllama(data, heuristicRec);
      console.log(`🤖 Ollama Final Decision: [${finalDecision.toUpperCase()}] (Heuristic was: ${heuristicRec})`);

      // 🧠 STEP 3: EXECUTE
      if (finalDecision === 'stow' && !isAlreadyStow) {
        console.log('⛈️ AI: Severe storm detected/decided. Triggering preemptive stow.');
        client.publish('helios/control/ai_override', 'stow');
      } else if (finalDecision === 'ephemeris' && !isAlreadyEphemeris) {
        console.log('☁️ AI: Erratic sensor readings/clouds decided. Switching to Ephemeris Fallback.');
        client.publish('helios/control/ai_override', 'ephemeris');
      } else if (finalDecision === 'auto' && !isAlreadyAuto && currentState.includes('ai_')) {
        console.log('☀️ AI: Safe conditions decided. Returning control to hardware LDR sensors.');
        client.publish('helios/control/ai_override', 'auto');
      }

    } catch (e) {
      console.error('Error parsing telemetry JSON:', e);
    }
  }
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
