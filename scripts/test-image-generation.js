// Test generate-image endpoint
const API_KEY = 'AIzaSyCSkoQQmdkKbGs3x-hWr0XCj5B2aEjrn74';
const BASE_URL = 'https://api.nanobanana.ai/v1';

const generatedPrompt = `Image-to-image conversion: Transform the original person into an adorable Q-style (chibi) character with an oversized round head, big sparkling expressive eyes, tiny proportional body, and soft rounded facial features. The character sits cross-legged on a lush grassy patch dotted with vibrant wildflowers, holding a small sketchbook and pencil, engrossed in sketching. Background features a breathtaking, harmonious landscape: sunlit rolling green hills, a gentle crystal-clear stream winding through, distant snow-capped peaks under a sky filled with fluffy cotton-like clouds, with warm golden hour light casting a soft, warm glow over the entire scene. Composition: medium shot, eye-level perspective, balanced framing with the character positioned slightly off-center to showcase the scenic backdrop, soft bokeh effect on the distant landscape to emphasize the Q-style character. Style: whimsical cozy digital illustration, vibrant yet muted harmonious color palette, smooth brush strokes, playful yet serene atmosphere. Quality: ultra-detailed, 8K resolution, sharp focus on the Q-style character and their sketchbook, cinematic warm lighting, high dynamic range, crisp details on wildflowers and stream, professional polished digital art, harmonious visual balance between character and landscape.`;

async function testImageGeneration() {
  console.log('Testing image generation with Nano Banana API...');
  console.log('Config:');
  console.log('  BASE_URL:', BASE_URL);
  console.log('  API_KEY:', API_KEY.slice(0, 8) + '...');
  console.log();
  console.log('Prompt:', generatedPrompt);
  console.log();

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
