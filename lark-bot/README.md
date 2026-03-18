# 网站管理飞书机器人

用于管理 xlilian.art 网站的飞书机器人，提供网站监控、内容管理、部署管理和信息汇总功能。

## 功能特性

### 1. 网站监控
- ✅ 自动健康检查（每5分钟）
- ✅ SSL 证书监控
- ✅ 页面加载速度测试
- ✅ 异常告警通知

### 2. 内容管理
- 📄 文章发布管理
- 📝 草稿箱管理
- 📊 阅读量统计
- 🏷️ 文章分类管理

### 3. 部署管理
- 🚀 一键触发部署
- 📋 查看部署历史
- ⏪ 紧急回滚功能
- 📈 部署状态监控

### 4. 信息汇总
- 📊 每日/每周报告
- 📈 访问量统计
- 🔥 热门文章排行
- 💡 网站优化建议

## 快速开始

### 1. 安装依赖

```bash
cd lark-bot
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填写你的配置
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 配置说明

### 飞书应用配置

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 启用机器人能力
5. 配置事件订阅地址：`https://your-domain.com/webhook/lark`

### GitHub 配置（可选）

用于部署功能，需要创建 Personal Access Token：

1. 访问 GitHub Settings → Developer settings → Personal access tokens
2. 生成新的 Token，勾选 `repo` 权限
3. 复制 Token 到环境变量

## 使用指南

### 机器人命令

在飞书群聊中 @机器人，使用以下命令：

```
@机器人 /help          # 查看帮助
@机器人 /status        # 查看网站状态
@机器人 /deploy        # 手动部署网站
@机器人 /report daily  # 查看日报
@机器人 /report weekly # 查看周报
```

### 自动任务

机器人会自动执行以下任务：

| 任务 | 频率 | 说明 |
|------|------|------|
| 健康检查 | 每5分钟 | 检查网站可用性 |
| SSL 证书检查 | 每天 | 检查证书过期时间 |
| 日报推送 | 每天 9:00 | 发送每日报告 |
| 周报推送 | 每周一 9:00 | 发送每周报告 |

## API 接口

除了飞书机器人，还提供 HTTP API：

### 健康检查
```bash
POST /api/health-check
```

### 手动部署
```bash
POST /api/deploy
```

### 获取报告
```bash
GET /api/report?type=daily|weekly
```

## 部署建议

### 使用 PM2 管理进程

```bash
npm install -g pm2
pm2 start src/index.js --name lark-bot
pm2 save
pm2 startup
```

### 使用 Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```bash
docker build -t lark-bot .
docker run -d -p 3000:3000 --env-file .env lark-bot
```

## 故障排查

### 常见问题

1. **飞书事件订阅验证失败**
   - 检查 URL 是否正确配置
   - 确保服务器可以访问公网
   - 查看日志确认收到请求

2. **无法获取访问令牌**
   - 检查 App ID 和 App Secret 是否正确
   - 确认应用已发布并可见

3. **部署失败**
   - 检查 GitHub Token 是否有 repo 权限
   - 确认仓库名称和所有者正确
   - 查看 GitHub Actions 日志

## 更新日志

### v1.0.0 (2026-03-17)
- ✅ 基础监控功能
- ✅ 飞书消息推送
- ✅ 部署管理
- ✅ 报告生成

## 贡献指南

欢迎提交 Issue 和 PR！

## 许可证

MIT License
