---
name: vps-incremental-deploy
description: 增量部署 Astro 项目到 VPS (root@101.132.32.3 xlilian.cn)。当用户需要增量部署、直接部署到VPS、检查VPS部署状态、回滚部署时使用这个skill。包括预检查、本地构建、rsync增量同步、自动备份、健康检查全流程自动化。
---

# VPS 增量部署 Skill

增量部署本地 Astro 项目到 `root@101.132.32.3` VPS 的自动化 skill。针对 `xlilian.cn` 网站部署优化。

## 何时使用

**一定要使用这个 skill 当用户：**
- 需要增量部署代码到 VPS 时（说"增量部署"、"incremental deploy"、"部署到VPS"）
- 需要直接从本地部署跳过 GitHub Actions 时
- 需要检查当前 VPS 上的部署状态时
- 需要回滚到之前的部署版本时
- 提到 `47.77.237.222` 或 `xlilian.cn` 部署相关操作时

## 工作流程

### 完整增量部署流程

```
1. 预检查 (Pre-flight Check)
   ├─ SSH 连接测试
   ├─ 检查远程目录存在性和磁盘空间
   ├─ 检查 Nginx 配置
   └─ 检查本地项目状态

2. 本地构建
   ├─ 检查 package.json 变化，如果有变化则运行 npm install
   ├─ 运行 npm run build 生成 dist 目录
   └─ 检查构建产物

3. 远程备份
   ├─ 在 VPS 上创建备份目录 /var/www/backups/<timestamp>
   └─ 复制当前部署到备份目录

4. 增量同步
   └─ 使用 rsync 将本地 dist/ 增量同步到远程 /var/www/html/

5. 健康检查
   ├─ 等待 5 秒让同步完成
   └─ curl 测试网站返回 200 OK
```

## 使用方法

### 完整部署

```bash
# 使用预置的部署脚本
bash /path/to/vps-incremental-deploy/scripts/deploy.sh
```

### 仅检查状态

如果你只需要检查当前部署状态，不需要部署：

```bash
# 连接 VPS 并报告当前状态
ssh root@101.132.32.3 "echo '=== Deployment Status ===' && ls -lh /var/www/html/ && echo && echo '=== Nginx Config ===' && cat /etc/nginx/sites-enabled/*"
```

### 回滚到上个版本

```bash
# 列出可用备份
ssh root@101.132.32.3 "ls -la /var/www/backups/"

# 回滚 (替换 <backup-name> 为实际备份名)
bash /path/to/vps-incremental-deploy/scripts/rollback.sh <backup-name>
```

## 配置

默认配置已针对本项目设置好：

| 配置项 | 值 |
|--------|-----|
| VPS Host | `root@101.132.32.3` |
| 远程目录 | `/var/www/html` |
| 本地构建目录 | `./dist` |
| 备份目录 | `/var/www/backups` |
| 网站 URL | `https://xlilian.cn` |

如果需要修改配置，请编辑 `scripts/deploy.sh` 头部的配置变量。

## 特点

- **增量同步**：只传输变更文件，比全量部署快 5-10 倍
- **本地构建**：不占用 VPS 构建资源
- **自动备份**：每次部署自动备份，支持一键回滚
- **预检查**：部署前验证一切正常，减少部署失败
- **健康检查**：部署后自动验证网站可访问

## 脚本位置

- 主部署脚本：`scripts/deploy.sh`
- 回滚脚本：`scripts/rollback.sh`

## 注意事项

1. 确保你有 VPS 的 SSH 访问权限（当前环境已配置）
2. rsync 需要在本地和远程都可用（默认已安装）
3. 备份存储在 VPS 的 `/var/www/backups/`，定期清理旧备份
4. Nginx 配置已经在 VPS 配置好，不需要修改
