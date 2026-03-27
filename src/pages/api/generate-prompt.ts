import type { APIRoute } from 'astro';

export const prerender = false;

const API_BASE_URL = import.meta.env.ANTHROPIC_BASE_URL;
const API_AUTH_TOKEN = import.meta.env.ANTHROPIC_AUTH_TOKEN;
const API_MODEL = import.meta.env.ANTHROPIC_MODEL;

export const POST: APIRoute = async ({ request }) => {
  if (!API_AUTH_TOKEN) {
    return new Response(JSON.stringify({ message: 'ANTHROPIC_AUTH_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ message: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { userInput, image } = body;
    const hasImage = !!image;

    const systemPrompt = `Convert the following user description into a detailed English prompt for AI image generation.
${hasImage ? 'This is an image-to-image generation task based on the reference image provided. Analyze the reference image content and incorporate it into the prompt. ' : ''}
Make it more descriptive, include style keywords, composition details, and quality keywords.
Output only the prompt text, no explanations.`;

    // Volcengine ARK uses OpenAI compatible format
    // Support multimodal content (text + image)
    let userContent;
    if (hasImage && image) {
      // OpenAI multimodal format: array of content parts
      userContent = [
        { type: 'text', text: userInput },
        {
          type: 'image_url',
          image_url: {
            url: image
          }
        }
      ];
    } else {
      // Text only
      userContent = userInput;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const url = API_BASE_URL;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_AUTH_TOKEN}`
    };

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

    if (!response.ok) {
      const error = await response.text();
      console.error('API error (generate-prompt):', response.status, error);
      return new Response(JSON.stringify({ message: `API error: ${response.status} - ${error}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    // OpenAI format: { choices: [{ message: { content: string } }] }
    const prompt = data.choices[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('generate-prompt endpoint error:', error);
    return new Response(JSON.stringify({ message: 'Internal server error: ' + (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
