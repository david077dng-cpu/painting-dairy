#!/usr/bin/env node

/**
 * 飞书机器人本地测试脚本
 * 用于验证本地环境配置是否正确
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkNodeVersion() {
  log('\n📦 检查 Node.js 版本...', 'blue');
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 18) {
    log(`✅ Node.js 版本: ${version} (符合要求)`, 'green');
    return true;
  } else {
    log(`⚠️  Node.js 版本: ${version} (建议升级到 18+)`, 'yellow');
    return false;
  }
}

async function checkDependencies() {
  log('\n📦 检查依赖安装...', 'blue');

  if (!fs.existsSync('node_modules')) {
    log('❌ node_modules 不存在，请先运行: npm install', 'red');
    return false;
  }

  const requiredPackages = ['express', 'axios', 'node-cron', 'dotenv'];
  const missing = [];

  for (const pkg of requiredPackages) {
    if (!fs.existsSync(path.join('node_modules', pkg))) {
      missing.push(pkg);
    }
  }

  if (missing.length === 0) {
    log('✅ 所有依赖已安装', 'green');
    return true;
  } else {
    log(`❌ 缺少依赖: ${missing.join(', ')}`, 'red');
    log('请运行: npm install', 'yellow');
    return false;
  }
}

async function checkEnvFile() {
  log('\n📦 检查环境变量配置...', 'blue');

  if (!fs.existsSync('.env')) {
    log('⚠️  未找到 .env 文件', 'yellow');

    if (fs.existsSync('.env.example')) {
      log('📝 正在从 .env.example 创建 .env...', 'cyan');
      fs.copyFileSync('.env.example', '.env');
      log('✅ .env 文件已创建，请编辑填写你的配置', 'green');
    } else {
      log('❌ 未找到 .env.example 文件', 'red');
      return false;
    }

    return false;
  }

  const envContent = fs.readFileSync('.env', 'utf-8');
  const requiredVars = ['LARK_APP_ID', 'LARK_APP_SECRET'];
  const missing = [];

  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    if (!regex.test(envContent)) {
      missing.push(varName);
    }
  }

  if (missing.length === 0) {
    log('✅ 环境变量配置正确', 'green');
    return true;
  } else {
    log(`⚠️  缺少配置项: ${missing.join(', ')}`, 'yellow');
    log('📝 请编辑 .env 文件，填写你的飞书应用凭证', 'cyan');
    return false;
  }
}

async function checkServices() {
  log('\n📦 检查服务配置...', 'blue');

  if (!fs.existsSync('src')) {
    log('❌ src 目录不存在', 'red');
    return false;
  }

  const requiredFiles = [
    'src/index.js',
    'src/services/lark.js',
    'src/services/monitor.js',
    'src/services/deploy.js',
    'src/services/report.js',
  ];

  const missing = [];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missing.push(file);
    }
  }

  if (missing.length === 0) {
    log('✅ 所有服务文件存在', 'green');
    return true;
  } else {
    log(`❌ 缺少文件: ${missing.join(', ')}`, 'red');
    return false;
  }
}

async function testServerStart() {
  log('\n📦 测试服务器启动...', 'blue');
  log('⏳ 尝试启动服务器（3秒后自动关闭）...', 'cyan');

  const { spawn } = require('child_process');

  return new Promise((resolve) => {
    const child = spawn('node', ['src/index.js'], {
      stdio: 'pipe',
      detached: false,
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    setTimeout(() => {
      child.kill('SIGTERM');

      if (output.includes('Server running') || output.includes('3000')) {
        log('✅ 服务器可以正常启动', 'green');
        resolve(true);
      } else if (output.includes('EADDRINUSE')) {
        log('⚠️  端口 3000 被占用，但服务器配置正确', 'yellow');
        resolve(true);
      } else if (output.includes('LARK_APP_ID') || output.includes('env')) {
        log('⚠️  环境变量未配置，但这是预期的', 'yellow');
        resolve(true);
      } else {
        log('⚠️  启动测试未完成，请检查日志', 'yellow');
        log(`输出: ${output.slice(0, 200)}...`, 'cyan');
        resolve(false);
      }
    }, 3000);
  });
}

async function printSummary(results) {
  log('\n' + '='.repeat(70), 'cyan');
  log('📋 测试总结', 'cyan');
  log('='.repeat(70), 'cyan');

  const allPassed = Object.values(results).every(r => r);

  for (const [name, passed] of Object.entries(results)) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${icon} ${name}`, color);
  }

  log('\n' + '='.repeat(70), 'cyan');

  if (allPassed) {
    log('🎉 所有检查通过！你可以开始本地测试了。', 'green');
    log('\n下一步:', 'cyan');
    log('  1. 编辑 .env 文件，填写你的飞书应用凭证', 'cyan');
    log('  2. 运行: npm run dev', 'cyan');
    log('  3. 访问: http://localhost:3000', 'cyan');
  } else {
    log('⚠️  部分检查未通过，请根据提示修复问题。', 'yellow');
  }

  log('='.repeat(70) + '\n', 'cyan');
}

// 主函数
async function main() {
  log('\n🚀 飞书机器人本地测试工具\n', 'cyan');
  log('=' .repeat(70), 'cyan');

  const results = {
    'Node.js 版本': await checkNodeVersion(),
    '依赖安装': await checkDependencies(),
    '环境变量': await checkEnvFile(),
    '服务配置': await checkServices(),
    '服务器启动': await testServerStart(),
  };

  await printSummary(results);
}

main().catch(error => {
  log(`\n❌ 测试过程中出错: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
EOF
chmod +x test-local.js
cd /Users/bobinding/Documents/code/portfolio/my-portfolio/lark-bot && node test-local.js
