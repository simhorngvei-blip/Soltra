import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type WeatherCondition = 'CLEAR' | 'PARTLY_CLOUDY' | 'OVERCAST' | 'RAIN' | 'NIGHT' | 'UNKNOWN';

export interface WeatherDetection {
  weather: WeatherCondition;
  confidence: number;
  reasoning: string;
}

export async function callRoboflowInference(base64Image: string): Promise<WeatherDetection | null> {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const modelId = process.env.ROBOFLOW_MODEL_ID || 'weather-j3gtj';
  const version = process.env.ROBOFLOW_MODEL_VERSION || '1';

  if (!apiKey) return null;

  try {
    const response = await fetch(`https://classify.roboflow.com/${modelId}/${version}?api_key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64Image
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Roboflow] API returned status ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();

    let topClass = "";
    let conf = 0;

    // Check response format (classification vs object detection)
    if (data.top && data.confidence !== undefined) {
      topClass = data.top;
      conf = data.confidence;
    } else if (data.predictions && data.predictions.length > 0) {
      data.predictions.sort((a: any, b: any) => b.confidence - a.confidence);
      topClass = data.predictions[0].class;
      conf = data.predictions[0].confidence;
    } else {
       return null;
    }

    // Map Roboflow class to our strictly typed WeatherCondition schema
    let mappedWeather: WeatherCondition = 'UNKNOWN';
    const c = topClass.toLowerCase();
    if (c.includes('clear') || c.includes('sunny') || c.includes('shine')) mappedWeather = 'CLEAR';
    else if (c.includes('partly') && c.includes('cloud')) mappedWeather = 'PARTLY_CLOUDY';
    else if (c.includes('cloud') || c.includes('overcast')) mappedWeather = 'OVERCAST';
    else if (c.includes('rain') || c.includes('storm')) mappedWeather = 'RAIN';
    else if (c.includes('night') || c.includes('dark')) mappedWeather = 'NIGHT';

    return {
      weather: mappedWeather,
      confidence: conf,
      reasoning: `Roboflow top prediction: ${topClass} (${(conf*100).toFixed(1)}%)`
    };
  } catch (error) {
    console.error('[Roboflow] Error calling Inference API:', error);
    return null;
  }
}

export async function callGeminiInference(base64Image: string, mimeType: string = 'image/jpeg'): Promise<WeatherDetection> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Weather Classifier] GEMINI_API_KEY is not set. Returning UNKNOWN.');
    return { weather: 'UNKNOWN', confidence: 0, reasoning: 'API key missing' };
  }

  const prompt = `
You are a meteorological AI. Analyze this sky image from a solar panel monitoring camera.
Determine the current weather condition from the sky visible in the image.
Respond ONLY with a JSON object adhering exactly to this schema:
{
  "weather": "CLEAR" | "PARTLY_CLOUDY" | "OVERCAST" | "RAIN" | "NIGHT" | "UNKNOWN",
  "confidence": number (0.0 to 1.0),
  "reasoning": "string explaining your choice briefly"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error('Empty response from Gemini');

    const result = JSON.parse(jsonText) as WeatherDetection;
    return result;
  } catch (error) {
    console.error('[Weather Classifier] Error calling Gemini:', error);
    return { weather: 'UNKNOWN', confidence: 0, reasoning: 'AI classification failed' };
  }
}

export async function classifyWeatherWithCascade(base64Image: string, mimeType: string = 'image/jpeg'): Promise<WeatherDetection> {
  // 1. The Fast Path (Student CNN via Roboflow)
  const roboflowResult = await callRoboflowInference(base64Image);
  
  // 2. The Confidence Gate
  // If Roboflow succeeds and has high confidence (>85%), use it immediately.
  if (roboflowResult && roboflowResult.confidence >= 0.85 && roboflowResult.weather !== 'UNKNOWN') {
    return roboflowResult;
  }

  // 3. The Deep Path (Teacher LLM via Gemini)
  // Fall back to Gemini if Roboflow is unconfigured, errored, or not confident enough.
  const geminiResult = await callGeminiInference(base64Image, mimeType);
  
  // Note the reason for the fallback in the reasoning if we came from a low-confidence Roboflow run
  if (roboflowResult) {
    geminiResult.reasoning = `Roboflow confidence was too low (${(roboflowResult.confidence*100).toFixed(1)}%). Gemini Fallback: ` + geminiResult.reasoning;
  }
  
  return geminiResult;
}
