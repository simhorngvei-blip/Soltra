import { classifyWeatherWithCascade, callRoboflowInference } from './src/lib/ai/weather-classifier';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

async function run() {
  console.log('1. Reading local test image (Windows Wallpaper)...');
  const buffer = fs.readFileSync('C:\\Windows\\Web\\Wallpaper\\Spotlight\\img14.jpg');
  const base64 = buffer.toString('base64');
  
  console.log('2. Testing Roboflow ALONE...');
  const roboResult = await callRoboflowInference(base64);
  console.log(JSON.stringify(roboResult, null, 2));

  console.log('\n3. Testing FULL CASCADE (Roboflow -> fallback to Gemini if low confidence)...');
  const cascadeResult = await classifyWeatherWithCascade(base64, 'image/jpeg');
  
  console.log('\n================================');
  console.log('FINAL AI DECISION:');
  console.log(JSON.stringify(cascadeResult, null, 2));
  console.log('================================\n');
}

run();
