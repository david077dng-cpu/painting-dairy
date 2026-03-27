import dotenv from 'dotenv';
dotenv.config();

const API_BASE_URL = process.env.ANTHROPIC_BASE_URL;
const API_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
const API_MODEL = process.env.ANTHROPIC_MODEL;
const ANTHROPIC_VERSION = '2023-06-01';

async function testPromptGeneration() {
  console.log('Testing prompt generation (Anthropic format)...');
  console.log('Config:');
  console.log('  BASE_URL:', API_BASE_URL);
  console.log('  MODEL:', API_MODEL);
  console.log('  AUTH_TOKEN:', API_AUTH_TOKEN ? `${API_AUTH_TOKEN.slice(0, 8)}...` : 'NOT SET');
  console.log();

  if (!API_AUTH_TOKEN) {
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

  const url = API_BASE_URL;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (url.includes('anthropic') || url.includes('mini')) {
    headers['x-api-key'] = API_AUTH_TOKEN;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  } else {
    headers['Authorization'] = `Bearer ${API_AUTH_TOKEN}`;
  }

  console.log('Request URL:', url);
  console.log('Headers:', JSON.stringify(Object.keys(headers), null, 2));
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: API_MODEL,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
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
    console.log('Full response:');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    let prompt = '';
    if (Array.isArray(data.content)) {
      prompt = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    } else if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      prompt = data.choices[0].message.content.trim();
    }

    console.log('Generated prompt:');
    console.log(prompt);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testPromptGeneration();
