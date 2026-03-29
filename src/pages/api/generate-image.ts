import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

// Explicitly load .env file values without being overridden by shell env
function loadEnvFromFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    }
    return env;
  } catch (e) {
    console.error('Failed to load .env file:', e);
    return {};
  }
}

const envFile = loadEnvFromFile();

// Provider configurations
const providers = {
  volcseed: {
    baseUrl: envFile.IMAGE_GENERATION_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    authToken: envFile.IMAGE_GENERATION_AUTH_TOKEN || envFile.ANTHROPIC_AUTH_TOKEN,
    model: envFile.IMAGE_GENERATION_MODEL,
    size: '2048x2048'
  },
  nanobanana: {
    baseUrl: 'https://api.nanobanana.ai/v1',
    authToken: envFile.PUBLIC_NANO_BANANA_API_KEY,
    model: 'dall-e-3',
    size: '1024x1024'
  },
  siliconflow: {
    baseUrl: envFile.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
    authToken: envFile.SILICONFLOW_API_KEY,
    model: envFile.SILICONFLOW_MODEL || 'black-forest-labs/flux-schnell',
    size: '1024x1024'
  }
};

export const POST: APIRoute = async ({ request }) => {
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

    const { prompt, image, provider = 'volcseed' } = body;
    const config = providers[provider as keyof typeof providers];

    if (!config) {
      return new Response(JSON.stringify({ message: `Invalid provider: ${provider}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!config.authToken) {
      return new Response(JSON.stringify({ message: `${provider} API key not configured` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!config.model) {
      return new Response(JSON.stringify({ message: `${provider} model not configured` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // OpenAI compatible image generation request format
    const requestBody: any = {
      model: config.model,
      prompt: prompt,
      n: 1,
      size: config.size,
      response_format: 'url'
    };

    // Support image-to-image if reference image provided
    if (image) {
      requestBody.image = image;
      requestBody.strength = 0.7;
    }

    const endpoint = (provider === 'nanobanana' || provider === 'siliconflow')
      ? `${config.baseUrl}/images/generations`
      : config.baseUrl;

    const url = endpoint;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.authToken}`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${provider} API error:`, response.status, error);
      return new Response(JSON.stringify({ message: `API error: ${response.status} - ${error}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    // OpenAI format: { data: [{ url: string }] }
    const result = data.data?.[0];

    if (!result) {
      return new Response(JSON.stringify({ message: 'No image generated' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const responseData = result.url
      ? { imageUrl: result.url }
      : { b64Json: result.b64_json };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('generate-image endpoint error:', error);
    return new Response(JSON.stringify({ message: 'Internal server error: ' + (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
