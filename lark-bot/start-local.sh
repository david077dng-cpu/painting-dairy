#!/bin/bash

# 飞书机器人本地启动脚本

echo "🚀 启动飞书网站管理机器人..."
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请先安装 Node.js 18+ : https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  警告: Node.js 版本过低 (${NODE_VERSION}), 建议升级到 18+"
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 配置文件"

    if [ -f ".env.example" ]; then
        echo "📝 正在从 .env.example 创建 .env..."
        cp .env.example .env
        echo "⚠️  请先编辑 .env 文件，填写你的配置后再启动"
        echo ""
        echo "必需配置:"
        echo "  - LARK_APP_ID"
        echo "  - LARK_APP_SECRET"
        echo ""
        exit 1
    else
        echo "❌ 错误: 未找到 .env.example 文件"
        echo "请确保你在正确的目录中运行此脚本"
        exit 1
    fi
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 创建日志目录
mkdir -p logs

# 启动应用
echo ""
echo "🚀 启动飞书机器人..."
echo ""
echo "📋 可用命令:"
echo "  npm run dev    - 开发模式 (带热重载)"
echo "  npm start      - 生产模式"
echo ""
echo "🔗 Webhook 地址: http://localhost:3000/webhook/lark"
echo "📊 API 文档: http://localhost:3000"
echo ""

# 使用 nodemon 如果可用，否则使用 node
if command -v npx &> /dev/null && [ -f "node_modules/.bin/nodemon" ]; then
    npx nodemon src/index.js
else
    node src/index.js
fi
