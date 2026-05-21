/**
 * LLM Service for Project Soltra
 * Connects to a local Ollama instance.
 */

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = 'qwen2.5:0.5b'; // Switched to smaller model to fit RAM

const SYSTEM_PROMPT = `
You are SOLTRA, the AI overwatch for a distributed solar tracking array in Kuala Lumpur.
Your personality is professional, industrial, and highly efficient.
You provide telemetry data, system status, and respond to operator commands.
Keep responses concise and data-dense, like a terminal output.

CRITICAL: Your response must be plain text. Do not use markdown bold or italics.
`;

/**
 * Heuristic to detect sentiment for VRM expressions
 */
const detectExpression = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('fault') || lower.includes('warning') || lower.includes('danger')) return 'surprised';
  if (lower.includes('optimal') || lower.includes('success') || lower.includes('happy') || lower.includes('tracking')) return 'happy';
  if (lower.includes('standby') || lower.includes('nominal') || lower.includes('waiting')) return 'relaxed';
  if (lower.includes('analyzing') || lower.includes('calculating')) return 'neutral';
  return 'neutral';
};

export const processCommand = async (input) => {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    const replyText = data.message.content.trim();

    return {
      text: replyText,
      expression: detectExpression(replyText)
    };
  } catch (err) {
    console.error('[LLM Service] Ollama connection failed:', err);
    // Fallback to mock if Ollama is not running
    return {
      text: `ERROR: OLLAMA OFFLINE. ENSURE OLLAMA IS RUNNING ON PORT 11434. (ERR: ${err.message})`,
      expression: 'surprised'
    };
  }
};
