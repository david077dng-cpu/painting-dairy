/**
 * 飞书机器人主入口 - 修复版
 */

const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const { LarkBot } = require('./services/lark');
const { WebsiteMonitor } = require('./services/monitor');
const { GitHubDeployer } = require('./services/deploy');
const { ReportGenerator } = require('./services/report');

const app = express();
// 核心：确保解析 JSON 请求体
app.use(express.json());

// 初始化服务
const larkBot = new LarkBot();
const monitor = new WebsiteMonitor();
const deployer = new GitHubDeployer();
const reporter = new ReportGenerator();

// ==================== API 路由 ====================

app.post('/webhook/lark', async (req, res) => {
  try {
    // 1. 优先处理飞书 URL 验证 (Challenge)
    // 注意：验证请求的 type 在根路径下
    if (req.body.type === 'url_verification') {
      console.log("验证 Challenge 模式...");
      return res.status(200).send(req.body.challenge); // 必须是 .send() 纯字符串
    }

    // 2. 校验验证 Token (安全防线)
    // if (req.body.header?.token !== process.env.LARK_VERIFICATION_TOKEN) {
    //   return res.status(403).json({ error: 'Invalid token' });
    // }

    // 3. 处理业务事件 (Event)
    const { header, event } = req.body;

    if (event?.message) {
      // 异步处理，不阻塞飞书的响应
      handleMessage(event).catch(err => console.error("Message handling error:", err));
    }

    // 4. 无论业务处理如何，必须立即给飞书返回合法 JSON
    return res.status(200).json({ code: 0 });

  } catch (error) {
    console.error('Lark webhook error:', error);
    // 报错也要返回 JSON，防止飞书后台报“非合法JSON格式”
    return res.status(500).json({ error: error.message });
  }
});

// ==================== 消息处理 ====================

async function handleMessage(event) {
  const message = event.message;
  let text = '';

  try {
    // 飞书消息内容是转义后的 JSON 字符串
    const content = JSON.parse(message.content || '{}');
    // 提取文本内容，并过滤掉机器人自身的 @ 符号
    text = (content.text || '').replace(/@_user_\d+/g, '').trim();
  } catch (e) {
    // 兜底：如果解析失败，直接使用原始 content
    text = (message.content || '').trim();
  }

  if (!text) return;
  console.log('Valid command received:', text);

  // 命令解析：支持直接输入命令或带 /
  const cleanText = text.startsWith('/') ? text.slice(1) : text;
  const [command, ...args] = cleanText.split(/\s+/);
  
  // 传入 event 里的 chat_id (对于私聊和群聊通用)
  await handleCommand(message.chat_id, command, args);
}

// ... handleCommand, formatHealthStatus 等函数保持原样 ...

// ==================== 启动服务 ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server started!
  🏠 Domain: https://api.xlilian.art
  📡 Webhook: /webhook/lark
  ---------------------------------
  `);
});