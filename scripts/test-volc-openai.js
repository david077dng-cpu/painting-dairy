// Test Volcengine ARK with OpenAI compatible format
const API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const API_AUTH_TOKEN = 'dba10660-abf4-496b-8005-5edbaaac900f';
const API_MODEL = 'doubao-seed-1-8-251228';

async function testPromptGeneration() {
  console.log('Testing prompt generation (Volcengine ARK OpenAI format)...');
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
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput }
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
    console.log('Full response:');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    const prompt = data.choices[0]?.message?.content?.trim() || '';
    console.log('Generated prompt:');
    console.log(prompt);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testPromptGeneration();
