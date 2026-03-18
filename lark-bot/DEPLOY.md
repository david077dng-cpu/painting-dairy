# 快速部署指南

## 方案一：使用云服务器（推荐）

### 1. 准备服务器

购买一台云服务器（推荐配置）：
- **阿里云/腾讯云/华为云** 入门配置即可
- **配置**：1核2G，1M带宽
- **系统**：Ubuntu 22.04 LTS 或 CentOS 8
- **价格**：约 50-100 元/年（新用户更便宜）

### 2. 配置安全组

在云服务控制台配置安全组规则：

| 类型 | 端口 | 源 | 说明 |
|------|------|-----|------|
| SSH | 22 | 0.0.0.0/0 | SSH远程连接 |
| HTTP | 80 | 0.0.0.0/0 | Web服务 |
| HTTPS | 443 | 0.0.0.0/0 | Web服务(SSL) |
| 自定义 | 3000 | 0.0.0.0/0 | 机器人服务端口 |

### 3. 一键部署脚本

在本地运行：

```bash
cd lark-bot
./scripts/deploy.sh 47.77.237.222 root
```

部署脚本会自动完成：
- ✅ 上传代码到服务器
- ✅ 安装 Node.js 和 PM2
- ✅ 安装项目依赖
- ✅ 创建环境配置文件
- ✅ 配置 PM2 进程管理

### 4. 配置环境变量

SSH 登录服务器编辑配置文件：

```bash
ssh root@47.77.237.222
cd /opt/lark-bot
nano .env
```

填写以下必需配置：

```env
# 飞书配置（必需）
LARK_APP_ID=xxxx
LARK_APP_SECRET=xxx

# GitHub 配置（可选，用于部署）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo

# 网站配置
SITE_URL=https://xlilian.art
SITE_NAME=李春晓的个人网站
```

### 5. 启动服务

```bash
# 启动机器人服务
./start.sh

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

### 6. 配置 Nginx（可选但推荐）

使用 Nginx 反向代理可以提供更好的性能和安全性：

```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/lark-bot
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name bot.xlilian.art;  # 替换为你的域名

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/lark-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. 配置 HTTPS（强烈建议）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d bot.xlilian.art

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 方案二：使用 Docker 部署

如果你有 Docker 环境，可以使用更简单的部署方式：

### 1. 创建 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/index.js"]
```

### 2. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  lark-bot:
    build: .
    container_name: lark-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health-check"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. 部署命令

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 更新代码后重新构建
docker-compose up -d --build
```

---

## 方案三：使用云函数/Serverless（低成本）

如果你希望更低的成本，可以考虑使用 Serverless 方案：

### 阿里云函数计算

```bash
# 安装 Serverless CLI
npm install -g @serverless-devs/s

# 配置阿里云凭证
s config add --AccessKeyID xxx --AccessKeySecret xxx --AccountID xxx

# 部署
s deploy
```

### 腾讯云云函数

类似地，可以使用腾讯云 SCF 进行部署。

**注意**：Serverless 方案需要适配代码，因为 Serverless 环境有一些限制（如不能常驻内存、定时任务需要单独配置等）。

---

## 监控和维护

### 日常检查清单

- [ ] 每天查看一次飞书告警消息
- [ ] 每周查看一次周报数据
- [ ] 每月检查一次 SSL 证书有效期
- [ ] 每季度评估一次网站性能

### 常见问题处理

**问题1：机器人停止响应**
```bash
# 检查进程状态
pm2 status

# 查看错误日志
pm2 logs

# 重启服务
pm2 restart lark-bot
```

**问题2：飞书验证失败**
- 检查服务器是否可以被公网访问
- 检查防火墙是否放行了对应端口
- 检查 Nginx 配置是否正确（如果使用）

**问题3：部署失败**
- 检查 GitHub Token 是否有效
- 检查仓库名称是否正确
- 查看 GitHub Actions 日志

---

## 总结

现在你有多种部署方案可以选择，根据你的实际情况选择最适合的：

| 方案 | 成本 | 复杂度 | 适用场景 |
|------|------|--------|----------|
| 云服务器 | ¥50-100/年 | 中等 | 长期使用，需要完整控制 |
| Docker | 同云服务器 | 较低 | 熟悉容器化部署 |
| Serverless | ¥0-10/月 | 较高 | 低成本，低频次使用 |

推荐使用 **云服务器 + Nginx + PM2** 的方案，稳定可靠，也便于后续扩展功能。

有任何问题随时问我！祝部署顺利！🚀
