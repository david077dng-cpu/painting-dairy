# 飞书网站管理机器人 - 快速开始

## 5分钟快速上手

### 1. 安装和配置 (2分钟)

```bash
cd lark-bot
npm install
npm run setup
```

按照提示输入：
- 飞书 App ID 和 App Secret
- GitHub Token（可选，用于部署功能）

### 2. 创建飞书应用 (2分钟)

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 点击「创建企业自建应用」
3. 输入应用名称：「网站管理助手」
4. 进入应用详情页，复制 **App ID** 和 **App Secret**
5. 左侧菜单「机器人」→ 开启机器人能力
6. 「事件订阅」→ 配置订阅地址：`http://你的服务器IP:3000/webhook/lark`
7. 点击「保存」完成验证
8. 「权限管理」→ 添加以下权限：
   - `im:chat:readonly` (获取群信息)
   - `im:message:send` (发送消息)
   - `im:message.group_msg` (接收群消息)
9. 点击「发布版本」→ 创建版本 → 申请线上发布
10. 将机器人添加到网站管理群

### 3. 启动服务 (1分钟)

```bash
# 开发模式
npm run dev

# 或使用 PM2 生产部署
npm install -g pm2
pm2 start src/index.js --name lark-bot
```

### 4. 测试机器人

在飞书群聊中发送：

```
@网站管理助手 /help
```

如果看到帮助信息，说明配置成功！🎉

## 常用命令

| 命令 | 说明 |
|------|------|
| `/help` | 查看帮助 |
| `/status` | 查看网站状态 |
| `/deploy` | 手动部署网站 |
| `/report daily` | 查看日报 |
| `/report weekly` | 查看周报 |

## 下一步

1. 配置 GitHub Token 以启用部署功能
2. 接入 Google Analytics 以获取真实访问数据
3. 配置 SSL 证书监控告警
4. 自定义日报/周报推送时间

## 常见问题

**Q: 机器人不响应消息？**
A: 检查事件订阅 URL 是否正确，确保服务器可以被公网访问。

**Q: 部署失败？**
A: 确认 GitHub Token 有 `repo` 权限，且仓库名称正确。

**Q: 如何修改推送时间？**
A: 编辑 `src/index.js` 中的 cron 表达式。

## 技术支持

如有问题，请在 GitHub 提交 Issue。
