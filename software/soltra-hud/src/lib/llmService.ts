export const generateAIReport = async (telemetryData: any) => {
  // Reads from VITE_OLLAMA_URL in .env.local — fallback to localhost for dev.
  // Production: set VITE_OLLAMA_URL to a Cloudflare Tunnel URL for port 11434,
  // or any hosted LLM endpoint that accepts the OpenAI-compatible /api/chat format.
  const OLLAMA_URL = (import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434') + '/api/chat';
  const OLLAMA_MODEL = 'qwen2.5:0.5b';

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
