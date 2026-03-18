#!/bin/bash
# 配置 HTTPS 使用 Let's Encrypt (certbot)

echo "🔒 Setting up HTTPS with Let's Encrypt..."
echo ""

# 检查 certbot 是否安装
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

echo ""
echo "🚀 Running certbot for nginx..."
sudo certbot --nginx

echo ""
echo "✅ HTTPS setup completed!"
echo "📝 Notes:"
echo "  - Certbot will auto-renew the certificate"
echo "  - Check nginx configuration after this"
