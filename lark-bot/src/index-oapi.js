/**
 * LarkBot - 使用 lark-oapi 官方 SDK
 */

const express = require('express');
require('dotenv').config();

const { createLarkWebhookHandler, client } = require('./lark-oapi-webhook');

const app = express();
app.use(express.json());

// 配置
const config = {
  port: process.env.PORT || 3000,
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
};

console.log('🤖 LarkBot (lark-oapi version)');
console.log(`   App ID: ${config.appId?.slice(0, 10)}...`);

// 创建 Lark Webhook Handler
const larkWebhookHandler = createLarkWebhookHandler({
  verificationToken: process.env.LARK_VERIFICATION_TOKEN,
  encryptKey: process.env.LARK_ENCRYPT_KEY,

  // 收到消息时的回调
  onMessage: async ({ chatId, content, message, event }) => {
    console.log('[Message received]', content.text);

    // 简单的命令处理
    const text = content.text?.toLowerCase().trim();

    // 使用 lark-oapi 发送回复
    try {
      if (text === '/help' || text === '帮助') {
        await replyToChat(chatId,
          '📚 可用命令：\n' +
          '/help - 显示帮助\n' +
          '/status - 查看网站状态\n' +
          '/deploy - 触发部署'
        );
      }
      else if (text === '/status' || text === '状态') {
        await replyToChat(chatId, '✅ 网站运行正常\n⏰ ' + new Date().toLocaleString());
      }
      else if (text === '/deploy' || text === '部署') {
        await replyToChat(chatId, '🚀 开始部署...');
      }
      else if (text.startsWith('/')) {
        await replyToChat(chatId, `❓ 未知命令：${text}\n输入 /help 查看帮助`);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  },

  // 其他事件回调
  onEvent: async ({ eventType, event }) => {
    console.log('[Event received]', eventType);
  },

  // 错误处理
  onError: async (error, req, res) => {
    console.error('[Webhook Error]', error);
  }
});

// 使用 lark-oapi 发送消息的辅助函数
async function replyToChat(chatId, text) {
  try {
    // 使用 lark-oapi client 发送消息
    const response = await client.im.message.create({
      data: {
        receive_id: chatId,
        content: JSON.stringify({
          text: text
        }),
        msg_type: 'text'
      }
    });

    console.log('[Message sent]', response);
    return response;
  } catch (error) {
    console.error('[Failed to send message]', error);
    throw error;
  }
}

// 注册 Webhook 路由
app.post('/webhook/lark', larkWebhookHandler);

// 健康检查
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LarkBot (lark-oapi)',
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
  console.log('\n💡 使用 lark-oapi 官方 SDK');
  console.log('   文档: https://open.feishu.cn/document/home/index\n');
});
