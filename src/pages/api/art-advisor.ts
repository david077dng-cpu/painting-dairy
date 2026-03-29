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

// 已知画家风格数据库
const ARTIST_STYLES: Record<string, string> = {
  '莫奈': '印象派，强调光影变化，使用短促的笔触，色彩丰富且明亮，善于捕捉瞬间的光感',
  'monet': 'Impressionism, emphasizes light and shadow changes, uses short brushstrokes, rich and bright colors, good at capturing momentary light',
  '梵高': '后印象派，强烈的主观情感表达，旋转的笔触，高饱和度的色彩，充满动感和张力',
  'van gogh': 'Post-Impressionism, strong subjective emotional expression, swirling brushstrokes, high saturation colors, full of movement and tension',
  '毕加索': '立体主义，将物体分解并重新组合，多角度同时呈现，几何化的形式，突破传统透视',
  'picasso': 'Cubism, decomposes and recombines objects, presents multiple angles simultaneously, geometric forms, breaks through traditional perspective',
  '达芬奇': '文艺复兴，完美的比例和构图，细腻的明暗过渡（晕涂法），科学的解剖知识，理想化的美',
  'davinci': 'Renaissance, perfect proportions and composition, delicate light and shadow transitions (sfumato), scientific anatomical knowledge, idealized beauty',
};

// 提取画家名字的函数
function extractArtistName(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  // 检查中文画家名
  for (const artist of Object.keys(ARTIST_STYLES)) {
    if (lowerMessage.includes(artist.toLowerCase())) {
      return artist;
    }
  }

  // 检查英文画家名
  const englishArtists = ['monet', 'van gogh', 'picasso', 'davinci'];
  for (const artist of englishArtists) {
    if (lowerMessage.includes(artist)) {
      return artist;
    }
  }

  return null;
}

// 搜索画家信息
async function searchArtistStyle(artistName: string): Promise<string> {
  if (ARTIST_STYLES[artistName]) {
    return ARTIST_STYLES[artistName];
  }
  const lowerName = artistName.toLowerCase();
  if (ARTIST_STYLES[lowerName]) {
    return ARTIST_STYLES[lowerName];
  }
  return '';
}

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

    const { messages, sources } = body;

    // CoT: 分析用户消息，检查是否提到画家
    let artistContext = '';
    let cotThinking = '';

    if (messages && messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role === 'user') {
        const userContent = lastUserMessage.content;
        const artistName = extractArtistName(userContent);

        if (artistName) {
          cotThinking += `检测到画家: ${artistName}\n`;
          const artistStyle = await searchArtistStyle(artistName);
          if (artistStyle) {
            cotThinking += `获取到风格信息: ${artistStyle}\n`;
            artistContext = `\n【CoT 思考过程】\n1. 用户提到了画家"${artistName}"\n2. 该画家的风格特点是：${artistStyle}\n3. 建议结合这些风格特点来分析用户的作品\n\n`;
          }
        }
      }
    }

    // Build system prompt with CoT context
    let systemPrompt = `你是一位专业的水彩画和传统绘画指导老师。

你的角色是通过对比学生的参考照片和手绘作品，提供详细、建设性的反馈建议。

${artistContext}

重要规则：
1. **必须使用中文回复** - 所有回答都用中文
2. 语气要鼓励但诚实 - 艺术学习需要建设性批评
3. 具体指出问题 - 明确指出需要改进的具体区域
4. 提供可执行的建议 - 解释如何改进，而不仅仅是指出问题
5. 使用对比语言 - 参考照片和手绘之间的具体差异
6. 涵盖以下方面：
   - 比例和构图
   - 明暗/光影（亮部和暗部）
   - 色彩混合和温度
   - 笔触和质感
   - 边缘控制（硬边和软边）

回复格式：
- 简要总体评估（2-3句话）
- 3-5条具体改进建议（编号列表）
- 下次的实用小技巧

保持回复简洁实用，所有内容用中文。`;

    // Build user message with sources
    let userContent = "";

    if (sources && sources.length > 0) {
      const photoSource = sources.find((s: any) => s.type === 'photo');
      const drawingSource = sources.find((s: any) => s.type === 'drawing');

      if (photoSource) {
        userContent += `Here is the reference photo:\n[Image: ${photoSource.url.substring(0, 100)}...]\n\n`;
      }
      if (drawingSource) {
        userContent += `Here is my drawing:\n[Image: ${drawingSource.url.substring(0, 100)}...]\n\n`;
      }
    }

    // Add conversation history
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        userContent += `Student asks: ${lastMessage.content}`;
      }
    }

    const url = API_BASE_URL;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_AUTH_TOKEN}`
    };

    const payload: any = {
      model: API_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 1200
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API error (art-advisor):', response.status, error);
      return new Response(JSON.stringify({ message: `API error: ${response.status} - ${error}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    // OpenAI format: { choices: [{ message: { content: string } }] }
    const aiResponse = data.choices[0]?.message?.content?.trim() || '';

    // 构建 CoT 思考过程
    let thinking = '';
    if (artistContext) {
      thinking = `🔍 **思考过程**\n\n1. 检测到用户提到了画家\n2. 查询画家风格数据库\n3. 将风格特征融入建议中\n`;
    }

    return new Response(JSON.stringify({
      response: aiResponse,
      thinking: thinking || undefined,
      artist: artistContext ? extractArtistName(messages?.[messages?.length - 1]?.content || '') : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('art-advisor endpoint error:', error);
    return new Response(JSON.stringify({ message: 'Internal server error', error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
