export const generateAIReport = async (telemetryData: any) => {
  const OLLAMA_URL = 'http://10.0.2.2:11434/api/chat'; // Android emulator host alias
  const OLLAMA_MODEL = 'qwen2.5:0.5b'; // Using the same model as soltra-dashboard

  const lux = telemetryData.solar_yield ? telemetryData.solar_yield.toFixed(1) : 'unknown';
  const wind = telemetryData.wind_speed ? telemetryData.wind_speed.toFixed(1) : 'unknown';
  const panel = telemetryData.panel_angle ? telemetryData.panel_angle.toFixed(1) : 'optimized';

  const systemPrompt = `You are SOLTRA, the AI overwatch for a distributed solar tracking array. 
Write a short, professional, and industrial daily report to be read aloud via TTS. 
Use this telemetry data: Solar Yield is ${lux} W/m², Wind Speed is ${wind} m/s, Panel Angle is ${panel}°.
Keep it concise (2-3 sentences max). Do not use markdown or special characters.`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: "Generate today's report." }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content.trim();
  } catch (err: any) {
    console.error('[LLM Service] Ollama connection failed:', err);
    throw err;
  }
};
