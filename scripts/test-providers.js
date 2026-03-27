// Test different image generation providers
const generatedPrompt = `Image-to-image conversion: Transform the original person into an adorable Q-style (chibi) character with an oversized round head, big sparkling expressive eyes, tiny proportional body, and soft rounded facial features. The character sits cross-legged on a lush grassy patch dotted with vibrant wildflowers, holding a small sketchbook and pencil, engrossed in sketching. Background features a breathtaking, harmonious landscape: sunlit rolling green hills, a gentle crystal-clear stream winding through, distant snow-capped peaks under a sky filled with fluffy cotton-like clouds, with warm golden hour light casting a soft, warm glow over the entire scene. Composition: medium shot, eye-level perspective, balanced framing with the character positioned slightly off-center to showcase the scenic backdrop, soft bokeh effect on the distant landscape to emphasize the Q-style character. Style: whimsical cozy digital illustration, vibrant yet muted harmonious color palette, smooth brush strokes, playful yet serene atmosphere. Quality: ultra-detailed, 8K resolution, sharp focus on the Q-style character and their sketchbook, cinematic warm lighting, high dynamic range, crisp details on wildflowers and stream, professional polished digital art, harmonious visual balance between character and landscape.`;

// Test Nano Banana
async function testNanoBanana() {
  console.log('='.repeat(60));
  console.log('Testing Nano Banana');
  console.log('='.repeat(60));

  const API_KEY = process.env.PUBLIC_NANO_BANANA_API_KEY;
  if (!API_KEY) {
    console.log('PUBLIC_NANO_BANANA_API_KEY not set');
    return;
  }

  const BASE_URL = 'https://api.nanobanana.ai/v1';

  const requestBody = {
    model: 'dall-e-3',
    prompt: generatedPrompt,
    n: 1,
    size: '1024x1024',
    response_format: 'url'
  };

  const url = `${BASE_URL}/images/generations`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  console.log('URL:', url);
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
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

    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log('✅ Success! Generated image URL:');
      console.log(imageUrl);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// Test SiliconFlow (OpenAI compatible endpoint)
async function testSiliconFlow() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Testing SiliconFlow (OpenAI compatible format)');
  console.log('='.repeat(60));

  const API_KEY = process.env.SILICONFLOW_API_KEY;
  const BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
  const MODEL = process.env.SILICONFLOW_MODEL || 'black-forest-labs/flux-schnell';

  if (!API_KEY) {
    console.log('SILICONFLOW_API_KEY not set');
    return;
  }

  const requestBody = {
    model: MODEL,
    prompt: generatedPrompt,
    n: 1,
    size: '1024x1024',
    response_format: 'url'
  };

  const url = `${BASE_URL}/images/generations`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  console.log('URL:', url);
  console.log('Model:', MODEL);
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
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

    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log('✅ Success! Generated image URL:');
      console.log(imageUrl);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// Test Volcengine Doubao Seed
async function testVolcseed() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Testing Volcengine Doubao Seed');
  console.log('='.repeat(60));

  const API_KEY = process.env.IMAGE_GENERATION_AUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN;
  const BASE_URL = process.env.IMAGE_GENERATION_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
  const MODEL = process.env.IMAGE_GENERATION_MODEL;

  if (!API_KEY) {
    console.log('IMAGE_GENERATION_AUTH_TOKEN not set');
    return;
  }
  if (!MODEL) {
    console.log('IMAGE_GENERATION_MODEL not set');
    return;
  }

  const requestBody = {
    model: MODEL,
    prompt: generatedPrompt,
    n: 1,
    size: '2048x2048',
    response_format: 'url'
  };

  const url = BASE_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  console.log('URL:', url);
  console.log('Model:', MODEL);
  console.log();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
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

    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log('✅ Success! Generated image URL:');
      console.log(imageUrl);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// Run all tests
async function runAllTests() {
  await testNanoBanana();
  await testVolcseed();
  await testSiliconFlow();
  console.log('\n' + '='.repeat(60));
  console.log('All tests completed');
  console.log('='.repeat(60));
}

runAllTests();
