/**
 * LarkBot - 使用 lark-oapi 官方 SDK 的简化版本
 */

const express = require('express');
require('dotenv').config();

const { createLarkWebhookHandler } = require('./lark-oapi-webhook');

const app = express();

// 配置
const config = {
  port: process.env.PORT || 3000,
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
};

console.log('🤖 LarkBot Starting...');
console.log(`   App ID: ${config.appId?.slice(0, 10)}...`);

// 创建 Lark Webhook Handler
const larkWebhookHandler = createLarkWebhookHandler({
  verificationToken: process.env.LARK_VERIFICATION_TOKEN,
  encryptKey: process.env.LARK_ENCRYPT_KEY,

  // 收到消息时的回调
  onMessage: async ({ chatId, content, message, event }) => {
    console.log('[Message]', content.text);

    // 简单的命令处理
    const text = content.text?.toLowerCase().trim();

    if (text === '/help' || text === '帮助') {
      await sendMessage(chatId,
        '📚 可用命令：\n' +
        '/help - 显示帮助\n' +
        '/status - 查看网站状态\n' +
        '/deploy - 触发部署'
      );
    }
    else if (text === '/status' || text === '状态') {
      await sendMessage(chatId, '✅ 网站运行正常\n⏰ ' + new Date().toLocaleString());
    }
    else if (text === '/deploy' || text === '部署') {
      await sendMessage(chatId, '🚀 开始部署...');
      // TODO: 调用部署API
    }
    else {
      // 未知命令，给出提示
      if (text.startsWith('/')) {
        await sendMessage(chatId, `❓ 未知命令：${text}\n输入 /help 查看帮助`);
      }
    }
  },

  // 其他事件回调
  onEvent: async ({ eventType, event }) => {
    console.log('[Event]', eventType);
  },

  // 错误处理
  onError: async (error, req, res) => {
    console.error('[Error]', error);
  }
});

// 发送消息辅助函数
async function sendMessage(chatId, text) {
  // TODO: 使用 lark-oapi 发送消息
  console.log(`[Send to ${chatId}]`, text);
}

// 注册 Webhook 路由
app.post('/webhook/lark', larkWebhookHandler);

// 健康检查
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LarkBot',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 启动服务
app.listen(config.port, () => {
  console.log(`\n🚀 Server started!`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Webhook: http://localhost:${config.port}/webhook/lark`);
  console.log(`   Health: http://localhost:${config.port}/`);
  console.log('\n💡 Tips:');
  console.log('   1. 在飞书开放平台配置 Webhook URL');
  console.log('   2. 确保本服务可以通过公网访问');
  console.log('   3. 使用 /help 命令查看帮助\n');
});
