#!/bin/bash

# 飞书机器人部署脚本
# 使用方法: ./deploy.sh [服务器IP] [用户名]

set -e

# 默认配置
SERVER_IP=${1:-"your-server-ip"}
USERNAME=${2:-"root"}
APP_NAME="lark-bot"
APP_DIR="/opt/${APP_NAME}"
NODE_VERSION="18"

echo "🚀 开始部署飞书机器人..."
echo "服务器: ${SERVER_IP}"
echo "用户: ${USERNAME}"
echo ""

# 检查本地环境
echo "📦 检查本地环境..."
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 安装依赖并打包
echo "📦 安装依赖..."
npm ci --production

# 创建部署包
echo "📦 创建部署包..."
DEPLOY_PACKAGE="${APP_NAME}-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "${DEPLOY_PACKAGE}" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="*.log" \
    --exclude=".env" \
    --exclude="${DEPLOY_PACKAGE}" \
    .

echo "✅ 部署包创建完成: ${DEPLOY_PACKAGE}"

# 上传到服务器并部署
echo "🚀 上传到服务器..."

ssh "${USERNAME}@${SERVER_IP}" << EOF
    set -e

    echo "📁 准备部署目录..."
    sudo mkdir -p "${APP_DIR}"
    sudo chown "${USERNAME}:${USERNAME}" "${APP_DIR}"

    # 备份现有版本
    if [ -d "${APP_DIR}/src" ]; then
        echo "💾 备份现有版本..."
        BACKUP_DIR="${APP_DIR}-backup-$(date +%Y%m%d-%H%M%S)"
        mv "${APP_DIR}" "${BACKUP_DIR}"
        mkdir -p "${APP_DIR}"
    fi
EOF

# 上传部署包
echo "📤 上传部署包..."
scp "${DEPLOY_PACKAGE}" "${USERNAME}@${SERVER_IP}:/tmp/"

# 在服务器上解压并安装
echo "🔧 安装应用..."
ssh "${USERNAME}@${SERVER_IP}" << EOF
    set -e

    cd "${APP_DIR}"

    echo "📦 解压部署包..."
    tar -xzf "/tmp/${DEPLOY_PACKAGE}" -C "${APP_DIR}"
    rm "/tmp/${DEPLOY_PACKAGE}"

    echo "📦 安装生产依赖..."
    npm ci --production

    # 创建 .env 文件（如果不存在）
    if [ ! -f ".env" ]; then
        echo "📝 创建环境配置文件..."
        cp ".env.production" ".env"
        echo "⚠️  请编辑 .env 文件，填写实际的配置值"
    fi

    echo "✅ 安装完成！"
EOF

# 创建 PM2 配置文件
echo "📝 创建 PM2 配置..."
cat > "ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'lark-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    merge_logs: true,
  }],
};
EOF

scp "ecosystem.config.js" "${USERNAME}@${SERVER_IP}:${APP_DIR}/"

# 创建启动脚本
echo "📝 创建启动脚本..."
cat > "start.sh" << 'EOF'
#!/bin/bash

APP_DIR="/opt/lark-bot"
LOG_DIR="$APP_DIR/logs"

# 创建日志目录
mkdir -p "$LOG_DIR"

cd "$APP_DIR"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# 启动应用
echo "Starting lark-bot..."
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup

echo "✅ lark-bot started successfully!"
echo "Logs: $LOG_DIR"
echo ""
echo "常用命令:"
echo "  pm2 status     - 查看状态"
echo "  pm2 logs       - 查看日志"
echo "  pm2 restart 0  - 重启服务"
echo "  pm2 stop 0     - 停止服务"
EOF

chmod +x "start.sh"
scp "start.sh" "${USERNAME}@${SERVER_IP}:${APP_DIR}/"

# 清理本地临时文件
rm -f "${DEPLOY_PACKAGE}" "ecosystem.config.js" "start.sh"

echo ""
echo "🎉 部署完成！"
echo ""
echo "后续步骤："
echo "1. SSH 到服务器："
echo "   ssh ${USERNAME}@${SERVER_IP}"
echo ""
echo "2. 编辑配置文件："
echo "   cd ${APP_DIR}"
echo "   nano .env"
echo ""
echo "3. 启动服务："
echo "   ./start.sh"
echo ""
echo "📖 详细文档："
echo "   https://github.com/your-username/your-repo/tree/main/lark-bot"
