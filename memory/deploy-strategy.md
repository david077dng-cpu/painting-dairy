# VPS 部署策略笔记

## 部署脚本对比

### 1. deploy.sh (完整部署)
适合生产环境，最可靠
```bash
bash .claude/skills/vps-incremental-deploy/scripts/deploy.sh
```

### 2. deploy-diff.sh (智能部署)
基于 git diff 自动选择策略
```bash
bash .claude/skills/vps-incremental-deploy/scripts/deploy-diff.sh
```

**策略矩阵：**
| 变更类型 | 部署模式 | 说明 |
|---------|---------|------|
| `src/` 源码 | 完整构建 | 需要重新构建 |
| `public/` 静态文件 | 直接同步 | 无需构建 |
| `src/content/` | 完整构建 | 内容需要重建 |
| 配置文件 | 完整构建 | 影响构建结果 |

## 回滚
```bash
# 列出备份
ssh root@47.77.237.222 "ls -la /var/www/backups/"

# 回滚
bash .claude/skills/vps-incremental-deploy/scripts/rollback.sh <备份名>
```

## 配置
- VPS: `root@47.77.237.222`
- 远程目录: `/var/www/html`
- 备份目录: `/var/www/backups`
- PM2 应用名: `painting-dairy`
