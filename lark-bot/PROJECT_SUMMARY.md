# 飞书网站管理机器人 - 项目汇总

## 📋 项目概览

这是一个为 xlilian.art 网站打造的飞书机器人管理系统，提供网站监控、内容管理、部署管理和数据报告等功能。

**项目名称**：网站管理助手
**项目版本**：v1.0.0
**创建日期**：2026-03-17
**技术栈**：Node.js + Express + 飞书 OpenAPI

---

## 📁 项目结构

```
lark-bot/
├── 📄 文档文件
│   ├── README.md              # 完整项目文档
│   ├── QUICKSTART.md          # 5分钟快速上手
│   ├── SETUP_GUIDE.md         # 详细部署流程图
│   ├── FEISHU_SETUP.md        # 飞书应用配置指南
│   ├── DEPLOY.md              # 服务器部署方案
│   ├── CHECKLIST.md           # 部署检查清单
│   └── PROJECT_SUMMARY.md     # 本文件
│
├── ⚙️ 配置文件
│   ├── package.json           # 项目依赖和脚本
│   ├── .env.example           # 环境变量模板
│   ├── .env.production        # 生产环境模板
│   └── ecosystem.config.js    # PM2 进程配置
│
├── 🚀 启动脚本
│   ├── start-local.sh         # 本地开发启动
│   └── scripts/
│       ├── setup.js           # 配置向导脚本
│       └── deploy.sh          # 服务器部署脚本
│
├── 💻 源代码
│   └── src/
│       ├── index.js           # 主入口和 HTTP 服务
│       └── services/
│           ├── lark.js        # 飞书消息服务
│           ├── monitor.js     # 网站监控服务
│           ├── deploy.js      # GitHub 部署服务
│           └── report.js      # 报告生成服务
│
└── 📦 其他
    ├── .gitignore             # Git 忽略配置
    └── LICENSE                # 开源许可证

```

---

## ✨ 功能特性

### 1. 网站监控 🔔
- **自动健康检查**：每 5 分钟检查网站可用性
- **SSL 证书监控**：每天检查证书过期时间
- **性能测试**：页面加载速度测试
- **异常告警**：网站异常时自动推送飞书消息

### 2. 内容管理 📝
- **文章管理**：查看文章列表和统计
- **草稿管理**：保存和管理草稿
- **阅读统计**：集成不蒜子阅读量统计

### 3. 部署管理 🚀
- **一键部署**：通过飞书命令触发 GitHub 部署
- **部署状态**：查看部署历史和状态
- **紧急回滚**：快速回滚到上一个版本

### 4. 数据报告 📊
- **日报推送**：每天早上 9 点自动发送
- **周报推送**：每周一早上 9 点自动发送
- **数据分析**：访问量、热门文章、性能指标
- **优化建议**：基于数据的网站改进建议

### 5. 机器人命令 🤖

| 命令 | 说明 | 示例 |
|------|------|------|
| `/help` | 查看帮助信息 | `/help` |
| `/status` | 查看网站状态 | `/status` |
| `/deploy` | 手动部署网站 | `/deploy` |
| `/report daily` | 查看日报 | `/report daily` |
| `/report weekly` | 查看周报 | `/report weekly` |

---

## 🚀 快速开始

### 方式 1：本地测试（5分钟）

```bash
# 1. 进入项目目录
cd lark-bot

# 2. 安装依赖
npm install

# 3. 运行配置向导
npm run setup

# 4. 启动开发服务器
npm run dev
```

### 方式 2：部署到云服务器（30分钟）

```bash
# 1. 准备一台云服务器（阿里云/腾讯云等）
#    - 配置：1核2G，1M带宽
#    - 系统：Ubuntu 22.04
#    - 价格：约 50-100 元/年

# 2. 使用自动部署脚本
cd lark-bot
./scripts/deploy.sh 你的服务器IP root

# 3. SSH 登录服务器配置
ssh root@你的服务器IP
cd /opt/lark-bot
nano .env  # 编辑配置文件，填入飞书凭证
./start.sh  # 启动服务
```

详细步骤请参考 [DEPLOY.md](DEPLOY.md)

---

## 📚 文档索引

### 入门指南
- [QUICKSTART.md](QUICKSTART.md) - 5分钟快速上手指南
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - 详细设置流程图

### 配置指南
- [FEISHU_SETUP.md](FEISHU_SETUP.md) - 飞书应用配置详细步骤
- [DEPLOY.md](DEPLOY.md) - 服务器部署方案详解
- [CHECKLIST.md](CHECKLIST.md) - 部署检查清单

### 参考文档
- [README.md](README.md) - 完整项目文档
- [package.json](package.json) - 依赖和脚本说明

---

## 🔧 技术栈

### 后端
- **Node.js 18+** - 运行时环境
- **Express.js** - Web 框架
- **node-cron** - 定时任务
- **axios** - HTTP 客户端

### API 集成
- **飞书 OpenAPI** - 消息推送和事件接收
- **GitHub API** - 部署触发

### 部署运维
- **PM2** - 进程管理
- **Nginx** - 反向代理（可选）
- **Docker** - 容器化（可选）

---

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

### 提交 Issue
- 描述问题时请提供详细的信息
- 包括复现步骤、错误日志等
- 标注相关的标签

### 提交 PR
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [飞书开放平台](https://open.feishu.cn/) 提供的 API 支持
- [Node.js](https://nodejs.org/) 社区
- 所有贡献者和用户

---

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件到：your-email@example.com
- 微信：your-wechat-id

---

**祝你使用愉快！** 🎉

如果这份文档对你有帮助，请给个 Star ⭐ 支持一下！
