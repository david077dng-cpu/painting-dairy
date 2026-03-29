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
const API_BASE_URL = envFile.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages';
const API_AUTH_TOKEN = envFile.ANTHROPIC_AUTH_TOKEN;
const API_MODEL = envFile.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

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

    const { userInput } = body;

    const systemPrompt = `Convert the following user description into a detailed English prompt for AI image generation.
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

    const payload = {
      model: API_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
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
