// Test direct API call
const API_BASE_URL = 'https://ark.cn-beijing.volces.com/v1/messages';
const API_AUTH_TOKEN = '7a329475-3d02-410c-9128-4ca39f861491';
const API_MODEL = 'kimi-k2.5';

async function testPromptGeneration() {
  console.log('Testing prompt generation (correct Anthropic endpoint)...');
  console.log('Config:');
  console.log('  BASE_URL:', API_BASE_URL);
  console.log('  MODEL:', API_MODEL);
  console.log('  AUTH_TOKEN:', API_AUTH_TOKEN.slice(0, 8) + '...');
  console.log();

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
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_AUTH_TOKEN}`
  };

  console.log('Request URL:', url);
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
    }

    console.log('Generated prompt:');
    console.log(prompt);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testPromptGeneration();
