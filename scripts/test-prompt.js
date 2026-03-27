import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

async function testPromptGeneration() {
  console.log('Testing prompt generation...');
  console.log('Config:');
  console.log('  BASE_URL:', ANTHROPIC_BASE_URL);
  console.log('  MODEL:', ANTHROPIC_MODEL);
  console.log('  AUTH_TOKEN:', ANTHROPIC_AUTH_TOKEN ? `${ANTHROPIC_AUTH_TOKEN.slice(0, 8)}...` : 'NOT SET');
  console.log();

  if (!ANTHROPIC_AUTH_TOKEN) {
    console.error('Error: ANTHROPIC_AUTH_TOKEN is not set in .env');
    process.exit(1);
  }

  const userInput = '将照片中的人物切换成Q风格，改成人物在美丽风景旁边写生的场景，景色优秀，画面和谐';
  const hasImage = true;

  const systemPrompt = `Convert the following user description into a detailed English prompt for AI image generation.
${hasImage ? 'This is an image-to-image generation task based on the reference image provided. ' : ''}
Make it more descriptive, include style keywords, composition details, and quality keywords.
Output only the prompt text, no explanations.`;

  const messages = [
    { role: 'user', content: `${systemPrompt}\n\nUser description: ${userInput}` }
  ];

  const url = ANTHROPIC_BASE_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANTHROPIC_AUTH_TOKEN}`
  };

  if (ANTHROPIC_BASE_URL.includes('anthropic')) {
    headers['anthropic-version'] = '2023-06-01';
  }

  console.log('Request URL:', url);
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    console.log('Response status:', response.status, response.statusText);
    console.log();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:');
      console.error(errorText);
      return;
    }

    const data = await response.json();
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    const prompt = data.content[0]?.text?.trim();
    console.log('Generated prompt:');
    console.log(prompt);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testPromptGeneration();
