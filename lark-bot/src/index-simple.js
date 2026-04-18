/**
 * LarkBot - 使用 lark-oapi 官方 SDK 的简化版本
 */

const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

const { Client } = require('@larksuiteoapi/node-sdk');
const { createLarkWebhookHandler } = require('./lark-oapi-webhook');
const { WechatSync } = require('./services/wechatSync');
const { GitSync } = require('./services/gitSync');
const { GitHubDeployer } = require('./services/deploy');
const { WechatPushHandler } = require('./services/wechatPush');

const app = express();

// 配置
const config = {
  port: process.env.PORT || 3000,
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  wechatSyncEnabled: process.env.WECHAT_SYNC_ENABLED === 'true',
  syncScheduleCron: process.env.SYNC_SCHEDULE_CRON || '0 9 * * 1',
  reportChatId: process.env.REPORT_CHAT_ID,
  // 微信公众号推送配置
  wechatPushEnabled: process.env.WECHAT_PUSH_ENABLED === 'true',
  wechatToken: process.env.WECHAT_TOKEN,
};

console.log('🤖 LarkBot Starting...');
console.log(`   App ID: ${config.appId?.slice(0, 10)}...`);
console.log(`   WeChat Sync: ${config.wechatSyncEnabled ? 'enabled' : 'disabled'}`);
console.log(`   WeChat Push: ${config.wechatPushEnabled ? 'enabled' : 'disabled'}`);

// 初始化服务
const larkClient = new Client(config);
const wechatSync = new WechatSync();
const gitSync = new GitSync();
const deployer = new GitHubDeployer();
let wechatPush = null;
if (config.wechatPushEnabled && config.wechatToken) {
  wechatPush = new WechatPushHandler({
    token: config.wechatToken,
    reportChatId: config.reportChatId,
    sendMessage: sendMessage,
  });
  console.log('✅ 微信公众号推送监听已启用');
}

// 发送消息辅助函数
async function sendMessage(chatId, text) {
  try {
    await larkClient.im.messages.send({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }, {
      receive_id_type: 'chat_id',
    });
    console.log(`[Send to ${chatId}]`, text);
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

// 创建 Lark Webhook 处理
const larkWebhookHandler = createLarkWebhookHandler({
  verificationToken: process.env.LARK_VERIFICATION_TOKEN,
  encryptKey: process.env.LARK_ENCRYPT_KEY,

  // 收到消息时的回调
  onMessage: async ({ chatId, content, message, event }) => {
    console.log('[Message]', content.text);

    // 简单的命令处理
    const text = content.text?.trim() || '';
    const lowerText = text.toLowerCase();

    if (lowerText === '/help' || lowerText === '帮助') {
      let helpText = '📚 可用命令：\n' +
        '/help - 显示帮助\n' +
        '/status - 查看网站状态\n' +
        '/deploy - 触发部署\n' +
        '/wechat-sync - 同步微信文章\n' +
        '/wechat-list - 列出待导入文章\n' +
        '/wechat-status - 查看同步状态\n' +
        '/wechat-add <url> - 添加文章待同步';
      await sendMessage(chatId, helpText);
    }
    else if (lowerText === '/status' || lowerText === '状态') {
      await sendMessage(chatId, '✅ 机器人运行正常\n⏰ ' + new Date().toLocaleString());
    }
    else if (lowerText === '/deploy' || lowerText === '部署') {
      await sendMessage(chatId, '🚀 开始触发部署...');
      try {
        const result = await deployer.deploy('master');
        await sendMessage(chatId, `✅ ${result.message}`);
      } catch (err) {
        await sendMessage(chatId, `❌ 部署失败: ${err.message}`);
      }
    }
    else if (lowerText === '/wechat-sync' || lowerText === '同步微信') {
      await handleWechatSync(chatId);
    }
    else if (lowerText === '/wechat-list' || lowerText === '微信列表') {
      await handleWechatList(chatId);
    }
    else if (lowerText === '/wechat-status' || lowerText === '微信状态') {
      await handleWechatStatus(chatId);
    }
    else if (text.startsWith('/wechat-add ')) {
      const url = text.slice('/wechat-add '.length).trim();
      await handleWechatAdd(chatId, url);
    }
    else {
      // 未知命令，给出提示
      if (lowerText.startsWith('/')) {
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

// ==================== 微信同步命令处理 ====================

async function handleWechatSync(chatId) {
  await sendMessage(chatId, '🔄 开始同步微信文章...');

  try {
    const result = await wechatSync.sync();

    if (result.importedCount === 0) {
      await sendMessage(chatId, `ℹ️ ${result.message}`);
      return;
    }

    // 如果有文章导入，执行 Git 同步
    await sendMessage(chatId, `✅ 导入完成: ${result.importedCount} 篇文章，开始 Git 推送...`);

    const gitResult = await gitSync.sync(result.importedCount);

    if (gitResult.success) {
      await sendMessage(chatId,
        `🎉 微信文章同步完成!\n` +
        `• 导入: ${result.importedCount} 篇\n` +
        `• Git: 推送成功\n` +
        `• 部署: ${gitResult.message}\n` +
        `⏰ ${new Date().toLocaleString()}`
      );
    } else {
      await sendMessage(chatId,
        `⚠️ 部分完成: 导入 ${result.importedCount} 篇，但 Git 推送失败\n` +
        `错误: ${gitResult.message}`
      );
    }

    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors.map(e => `• ${e.url}: ${e.error}`).join('\n');
      await sendMessage(chatId, `❌ 导入失败 ${result.errors.length} 篇:\n${errorMsg}`);
    }
  } catch (err) {
    console.error('Wechat sync error:', err);
    await sendMessage(chatId, `❌ 同步失败: ${err.message}`);
  }
}

async function handleWechatList(chatId) {
  const pending = wechatSync.listPending();
  if (pending.length === 0) {
    await sendMessage(chatId, '✅ 没有待导入的文章');
    return;
  }

  const list = pending.map((article, index) => {
    return `${index + 1}. ${article.url}`;
  }).join('\n');

  await sendMessage(chatId, `📋 待导入文章 (${pending.length} 篇):\n${list}`);
}

async function handleWechatStatus(chatId) {
  const stats = wechatSync.getStats();
  const lastSync = stats.lastSync ? new Date(stats.lastSync).toLocaleString() : '从未同步';

  await sendMessage(chatId,
    `📊 微信同步状态:\n` +
    `• 总文章: ${stats.total}\n` +
    `• 已导入: ${stats.imported}\n` +
    `• 待导入: ${stats.pending}\n` +
    `• 累计导入: ${stats.importCount}\n` +
    `• 上次同步: ${lastSync}`
  );
}

async function handleWechatAdd(chatId, url) {
  if (!url || !url.startsWith('https://mp.weixin.qq.com/')) {
    await sendMessage(chatId, '❌ 请提供有效的微信文章 URL (以 https://mp.weixin.qq.com/ 开头)');
    return;
  }

  const result = wechatSync.addArticle(url);
  if (result.success) {
    await sendMessage(chatId, `✅ ${result.message}\n可以使用 /wechat-sync 立即同步`);
  } else {
    await sendMessage(chatId, `❌ ${result.message}`);
  }
}

// ==================== 定时任务 ====================

if (config.wechatSyncEnabled && config.syncScheduleCron) {
  console.log(`📅 定时同步已启动: ${config.syncScheduleCron}`);
  cron.schedule(config.syncScheduleCron, async () => {
    console.log('⏰ 定时触发微信同步');

    if (config.reportChatId) {
      await sendMessage(config.reportChatId, '⏰ 定时触发微信文章同步...');
    }

    try {
      const result = await wechatSync.sync();

      if (result.importedCount > 0) {
        const gitResult = await gitSync.sync(result.importedCount);

        if (config.reportChatId) {
          if (gitResult.success) {
            await sendMessage(config.reportChatId,
              `🎉 定时同步完成!\n` +
              `• 导入 ${result.importedCount} 篇文章\n` +
              `• Git 推送成功，部署已触发`
            );
          } else {
            await sendMessage(config.reportChatId,
              `⚠️ 定时同步部分完成\n` +
              `• 导入 ${result.importedCount} 篇\n` +
              `• Git 推送失败: ${gitResult.message}`
            );
          }
        }
      } else {
        console.log('定时同步: 没有新文章');
      }
    } catch (err) {
      console.error('定时同步失败:', err);
      if (config.reportChatId) {
        await sendMessage(config.reportChatId, `❌ 定时同步失败: ${err.message}`);
      }
    }
  });
}

// 注册 Webhook 路由
app.post('/webhook/lark', larkWebhookHandler);

// 微信公众号推送回调路由
if (config.wechatPushEnabled && wechatPush) {
  // 微信验证（GET）和推送接收（POST）
  app.get('/webhook/wechat', (req, res) => {
    const result = wechatPush.verifySignature(req.query);
    if (result.valid) {
      res.send(result.echostr);
    } else {
      res.status(403).send('invalid signature');
    }
  });

  // 解析任何 Content-Type 为文本，因为微信推送可能不设置正确的 Content-Type
  app.post('/webhook/wechat', express.text({ type: () => true }), async (req, res) => {
    try {
      const result = await wechatPush.handlePush(req.body);
      console.log('[WechatPush] 处理完成:', result);
      // 微信要求返回 success
      res.send('success');
    } catch (err) {
      console.error('[WechatPush] 处理失败:', err);
      // 即使出错也返回 success，避免微信重试风暴
      res.send('success');
    }
  });

  console.log(`✅ 微信推送回调已注册: http://localhost:${config.port}/webhook/wechat`);
}

// 健康检查
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LarkBot',
    version: '1.1.0',
    wechatSync: config.wechatSyncEnabled,
    timestamp: new Date().toISOString()
  });
});

// 启动服务
app.listen(config.port, () => {
  console.log(`\n🚀 Server started!`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Lark Webhook: http://localhost:${config.port}/webhook/lark`);
  if (config.wechatPushEnabled) {
    console.log(`   WeChat Push: http://localhost:${config.port}/webhook/wechat`);
  }
  console.log(`   Health: http://localhost:${config.port}/`);
  console.log('\n💡 Tips:');
  console.log('   1. 在飞书开放平台配置 Webhook URL');
  if (config.wechatPushEnabled) {
    console.log('   2. 在微信公众平台配置服务器地址: [你的域名]/webhook/wechat');
    console.log('   3. 配置 Token，与公众平台设置一致');
  }
  console.log('   确保本服务可以通过公网访问');
  console.log('   使用 /help 查看帮助\n');
});
