#!/usr/bin/env node

/**
 * 飞书机器人初始化设置脚本
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function setup() {
  console.log('🚀 欢迎使用飞书网站管理机器人设置向导\n');

  // 检查 .env 文件是否存在
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  if (!fs.existsSync(envPath)) {
    console.log('📄 创建 .env 配置文件...\n');

    // 读取示例文件
    let envContent = fs.readFileSync(envExamplePath, 'utf-8');

    // 交互式配置
    console.log('请输入以下配置信息（直接回车使用默认值）：\n');

    const larkAppId = await question('飞书 App ID: ');
    if (larkAppId) {
      envContent = envContent.replace(
        'LARK_APP_ID=cli_xxxxxxxxxxxxxxxx',
        `LARK_APP_ID=${larkAppId}`
      );
    }

    const larkAppSecret = await question('飞书 App Secret: ');
    if (larkAppSecret) {
      envContent = envContent.replace(
        'LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        `LARK_APP_SECRET=${larkAppSecret}`
      );
    }

    const larkWebhookUrl = await question('飞书 Webhook URL (可选): ');
    if (larkWebhookUrl) {
      envContent = envContent.replace(
        'LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        `LARK_WEBHOOK_URL=${larkWebhookUrl}`
      );
    }

    const githubToken = await question('GitHub Token (用于部署功能): ');
    if (githubToken) {
      envContent = envContent.replace(
        'GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        `GITHUB_TOKEN=${githubToken}`
      );
    }

    const githubOwner = await question('GitHub 用户名/组织名: ');
    if (githubOwner) {
      envContent = envContent.replace(
        'GITHUB_OWNER=your-username',
        `GITHUB_OWNER=${githubOwner}`
      );
    }

    const githubRepo = await question('GitHub 仓库名: ');
    if (githubRepo) {
      envContent = envContent.replace(
        'GITHUB_REPO=your-repo',
        `GITHUB_REPO=${githubRepo}`
      );
    }

    // 写入 .env 文件
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ 配置文件已创建！\n');
  } else {
    console.log('📄 发现已存在的 .env 配置文件\n');
  }

  // 验证配置
  console.log('🔍 验证配置...\n');
  require('dotenv').config();

  const requiredVars = [
    'LARK_APP_ID',
    'LARK_APP_SECRET',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.log('⚠️  缺少以下必需配置：');
    missing.forEach((varName) => console.log(`   - ${varName}`));
    console.log('\n请编辑 .env 文件补充这些配置后重新运行。\n');
  } else {
    console.log('✅ 配置验证通过！\n');
  }

  // 后续步骤指南
  console.log('📖 下一步操作指南：\n');
  console.log('1. 安装依赖：');
  console.log('   npm install\n');
  console.log('2. 启动开发服务器：');
  console.log('   npm run dev\n');
  console.log('3. 配置飞书事件订阅：');
  console.log('   URL: http://your-server:3000/webhook/lark\n');
  console.log('4. 测试机器人：');
  console.log('   在飞书群聊中 @机器人 /help\n');

  console.log('🎉 设置完成！祝你使用愉快！\n');

  rl.close();
}

// 运行设置
setup().catch((error) => {
  console.error('设置过程中出错:', error);
  process.exit(1);
});
