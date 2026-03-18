/**
 * 飞书机器人主入口
 * 功能：网站监控、内容管理、部署管理、信息汇总
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
app.use(express.json());

// 初始化服务
const larkBot = new LarkBot();
const monitor = new WebsiteMonitor();
const deployer = new GitHubDeployer();
const reporter = new ReportGenerator();

// ==================== API 路由 ====================

/**
 * 飞书事件回调入口
 * 处理：消息事件、卡片回调等
 */
app.post('/webhook/lark', async (req, res) => {
  try {
    const { header, event } = req.body;

    // URL 验证
    if (header?.token) {
      return res.json({ challenge: req.body.challenge });
    }

    // 处理消息事件
    if (event?.message) {
      await handleMessage(event.message);
    }

    res.json({ code: 0 });
  } catch (error) {
    console.error('Lark webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 手动触发健康检查
 */
app.post('/api/health-check', async (req, res) => {
  const result = await monitor.checkHealth();
  res.json(result);
});

/**
 * 手动触发部署
 */
app.post('/api/deploy', async (req, res) => {
  try {
    const result = await deployer.deploy();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取网站统计报告
 */
app.get('/api/report', async (req, res) => {
  const { type = 'daily' } = req.query;
  const report = await reporter.generate(type);
  res.json(report);
});

// ==================== 消息处理 ====================

async function handleMessage(message) {
  const content = JSON.parse(message.content || '{}');
  const text = content.text?.trim() || '';

  console.log('Received message:', text);

  // 命令解析
  if (text.startsWith('/')) {
    const [command, ...args] = text.slice(1).split(' ');
    await handleCommand(message.chat_id, command, args);
  }
}

async function handleCommand(chatId, command, args) {
  switch (command.toLowerCase()) {
    case 'help':
    case '帮助':
      await larkBot.sendMessage(chatId, getHelpText());
      break;

    case 'status':
    case '状态':
      const health = await monitor.checkHealth();
      await larkBot.sendMessage(chatId, formatHealthStatus(health));
      break;

    case 'deploy':
    case '部署':
      await larkBot.sendMessage(chatId, '🚀 开始部署网站...');
      try {
        const result = await deployer.deploy();
        await larkBot.sendMessage(chatId, `✅ 部署成功！\n📎 ${result.url || ''}`);
      } catch (error) {
        await larkBot.sendMessage(chatId, `❌ 部署失败：${error.message}`);
      }
      break;

    case 'report':
    case '报告':
      const type = args[0] || 'daily';
      const report = await reporter.generate(type);
      await larkBot.sendMessage(chatId, formatReport(report));
      break;

    default:
      await larkBot.sendMessage(chatId, `❓ 未知命令：${command}\n输入 /help 查看可用命令`);
  }
}

// ==================== 定时任务 ====================

// 每5分钟健康检查
const healthCheckJob = cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled health check...');
  const result = await monitor.checkHealth();
  if (!result.healthy) {
    // 发送告警
    await larkBot.sendAlert(`⚠️ 网站健康检查异常\n\n${JSON.stringify(result, null, 2)}`);
  }
});

// 每日报告（早上9点）
const dailyReportJob = cron.schedule('0 9 * * *', async () => {
  console.log('Generating daily report...');
  const report = await reporter.generate('daily');
  await larkBot.sendDailyReport(formatReport(report));
});

// 每周报告（周一早上9点）
const weeklyReportJob = cron.schedule('0 9 * * 1', async () => {
  console.log('Generating weekly report...');
  const report = await reporter.generate('weekly');
  await larkBot.sendWeeklyReport(formatReport(report));
});

// SSL 证书检查（每天检查一次）
const sslCheckJob = cron.schedule('0 0 * * *', async () => {
  console.log('Checking SSL certificates...');
  const sslInfo = await monitor.checkSSL();
  if (sslInfo.daysUntilExpiry < 30) {
    await larkBot.sendAlert(`⚠️ SSL 证书即将过期\n\n域名：${sslInfo.domain}\n过期时间：${sslInfo.expiryDate}\n剩余天数：${sslInfo.daysUntilExpiry} 天`);
  }
});

// ==================== 辅助函数 ====================

function getHelpText() {
  return `🤖 **网站管理机器人**

可用命令：

📊 **监控**
/status - 查看网站健康状态

🚀 **部署**
/deploy - 手动触发网站部署

📈 **报告**
/report daily - 查看日报
/report weekly - 查看周报

❓ **帮助**
/help - 显示此帮助信息

---
⏰ 定时任务：
• 每5分钟：健康检查
• 每天9:00：日报推送
• 每周一9:00：周报推送
• 每天0:00：SSL证书检查`;
}

function formatHealthStatus(health) {
  const emoji = health.healthy ? '✅' : '❌';
  return `${emoji} **网站健康状态**

⏱️ 响应时间：${health.responseTime}ms
📊 状态码：${health.statusCode}
🔗 检查URL：${health.url}
⏰ 检查时间：${new Date(health.timestamp).toLocaleString()}

${health.healthy ? '一切正常！' : `⚠️ 异常：${health.error || '未知错误'}`}`;
}

function formatReport(report) {
  return `📊 **${report.type === 'daily' ? '日报' : '周报'}** (${report.period})

📈 **访问数据**
• 总访问：${report.visits || 'N/A'}
• 独立访客：${report.uniqueVisitors || 'N/A'}
• 平均停留：${report.avgDuration || 'N/A'}

📝 **内容统计**
• 文章总数：${report.totalPosts || 'N/A'}
• 本周新增：${report.newPosts || 'N/A'}

🔥 **热门文章**
${report.topPosts?.map((post, i) => `${i + 1}. ${post.title} (${post.views} 阅读)`).join('\n') || '暂无数据'}

---
⏰ 生成时间：${new Date(report.generatedAt).toLocaleString()}`;
}

// ==================== 启动服务 ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/lark`);
  console.log(`📊 API docs:`);
  console.log(`   POST /api/health-check - 手动健康检查`);
  console.log(`   POST /api/deploy - 手动部署`);
  console.log(`   GET  /api/report?type=daily|weekly - 获取报告`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  healthCheckJob.stop();
  dailyReportJob.stop();
  weeklyReportJob.stop();
  sslCheckJob.stop();
  process.exit(0);
});
