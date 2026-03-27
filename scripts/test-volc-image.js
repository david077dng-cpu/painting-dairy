// Test Volcengine ARK Image Generation with OpenAI compatible format
const API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const API_AUTH_TOKEN = 'dba10660-abf4-496b-8005-5edbaaac900f';
// Replace with your actual image generation endpoint ID from Volcengine ARK console
const API_MODEL = 'doubao-seedream-5-0-260128';

const generatedPrompt = `Image-to-image conversion: Transform the original person into an adorable Q-style (chibi) character with an oversized round head, big sparkling expressive eyes, tiny proportional body, and soft rounded facial features. The character sits cross-legged on a lush grassy patch dotted with vibrant wildflowers, holding a small sketchbook and pencil, engrossed in sketching. Background features a breathtaking, harmonious landscape: sunlit rolling green hills, a gentle crystal-clear stream winding through, distant snow-capped peaks under a sky filled with fluffy cotton-like clouds, with warm golden hour light casting a soft, warm glow over the entire scene. Composition: medium shot, eye-level perspective, balanced framing with the character positioned slightly off-center to showcase the scenic backdrop, soft bokeh effect on the distant landscape to emphasize the Q-style character. Style: whimsical cozy digital illustration, vibrant yet muted harmonious color palette, smooth brush strokes, playful yet serene atmosphere. Quality: ultra-detailed, 8K resolution, sharp focus on the Q-style character and their sketchbook, cinematic warm lighting, high dynamic range, crisp details on wildflowers and stream, professional polished digital art, harmonious visual balance between character and landscape.`;

async function testImageGeneration() {
  console.log('Testing image generation (Volcengine ARK OpenAI format)...');
  console.log('Config:');
  console.log('  BASE_URL:', API_BASE_URL);
  console.log('  MODEL:', API_MODEL);
  console.log('  AUTH_TOKEN:', API_AUTH_TOKEN.slice(0, 8) + '...');
  console.log();

  const requestBody = {
    model: API_MODEL,
    prompt: generatedPrompt,
    n: 1,
    size: '2048x2048',
    response_format: 'url'
  };

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
      console.log('Generated image URL:');
      console.log(imageUrl);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testImageGeneration();
