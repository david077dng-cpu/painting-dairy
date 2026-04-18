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

4. 增量同步 dist/
   └─ 使用 rsync 将本地 dist/ 增量同步到远程 /var/www/html/

5. 同步 public/content 目录
   └─ 所有微信导出文章都存在这里，Astro SSR 不会自动复制，单独同步

6. 同步 src 目录
   └─ Astro SSR 运行时 content collections 仍然需要 src/content 文件

7. 同步依赖文件
   ├─ rsync 同步 package.json 和 package-lock.json
   └─ 在远程安装生产依赖（npm install --omit=dev）

8. 重启 PM2 进程
   └─ pm2 restart painting-dairy

9. 修复文件权限
   └─ chown 为正确用户

10. 健康检查
    ├─ 等待 5 秒让同步完成
    └─ curl 测试网站返回 200 OK
```

## 项目特定注意事项 (painting-dairy)

### Astro SSR 模式部署要点

本项目使用 **Astro output: server (SSR)** 模式部署，有几个关键点：

1. **`public/content/` 需要单独同步**
   - Astro SSR 构建不会把 `public/` 目录复制到 `dist/`
   - 所有微信导出的文章都存在 `public/content/group/`
   - **部署脚本会自动同步** `./public/content/` → `$REMOTE_DIR/public/content/`
   - 使用 `--delete` 保持本地和远程内容一致，微信新增文章会自动同步上去

2. **`src/` 需要同步**
   - 在 Astro SSR 模式下，Content Collections 在运行时仍然需要源文件
   - 部署脚本会自动增量同步 `./src/` → `$REMOTE_DIR/src/`

3. **node_modules 需要在远程安装**
   - 本地构建只输出编译后的 Astro 服务端代码
   - 运行时依赖（node_modules）仍然需要在 VPS 上安装
   - 部署脚本会自动处理：同步 package.json → 远程 npm install

4. **路径解析注意事项**
   - PM2 启动时工作目录 `cwd` 就是项目根 `/var/www/html`
   - 所以 `path.resolve(process.cwd(), 'public/content/group')` 能正确解析
   - 不要使用 `import.meta.url` 相对路径，因为构建后文件位置会变

5. **PM2 进程管理**
   - 网站 (`painting-dairy`) 和 微信监听服务 (`lark-bot`) 是两个独立 PM2 进程
   - 网站运行在 `localhost:3001`，由 Nginx 反向代理
   - lark-bot 运行在 `localhost:3000`，webhook 路径 `/webhook/wechat` 由 Nginx 转发

### Nginx 配置

```nginx
server {
  listen 443 ssl http2;
  server_name xlilian.cn www.xlilian.cn;

  # 静态文件直接服务
  location ~* ^/content/.*\.(jpg|jpeg|png|gif|webp|css|js|mp4|pdf)$ {
    root /var/www/html/public;
    expires 7d;
  }

  # webhook 转发到 lark-bot
  location ~ ^/webhook/ {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # 所有其他请求转发到 Astro SSR 服务
  location / {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
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
| PM2 app name | `painting-dairy` |

如果需要修改配置，请编辑 `scripts/deploy.sh` 头部的配置变量。

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
ssh root@101.132.32.3 "echo '=== Deployment Status ===' && ls -lh /var/www/html/ && echo && echo '=== PM2 Status ===' && pm2 status && echo && echo '=== Nginx Config ===' && cat /etc/nginx/sites-enabled/*"
```

### 回滚到上个版本

```bash
# 列出可用备份
ssh root@101.132.32.3 "ls -la /var/www/backups/"

# 回滚 (替换 <backup-name> 为实际备份名)
bash /path/to/vps-incremental-deploy/scripts/rollback.sh <backup-name>
```

## 特点

- **增量同步**：只传输变更文件，比全量部署快 5-10 倍
- **本地构建**：不占用 VPS 构建资源，利用本地更快的网络和编译速度
- **自动备份**：每次部署自动备份，支持一键回滚
- **预检查**：部署前验证一切正常，减少部署失败
- **健康检查**：部署后自动验证网站可访问
- **SSR 友好**：专为 Astro SSR 设计，自动处理远程依赖安装

## 已解决的常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 合集显示"该合集暂时没有内容" | `public/content` 目录不存在于远程 | 部署脚本会自动同步 `public/content`，重新部署一次即可 |
| 502 Bad Gateway  after deploy | 模块依赖缺失，ERR_MODULE_NOT_FOUND | 脚本会自动在远程安装依赖，确保 package.json 已同步 |
| 路径找不到文件 | 相对路径 `import.meta.url` 在构建后位置变化 | 使用 `process.cwd()`，PM2 的 cwd 就是项目根 |
| 微信推送接收失败报错 | 微信发送加密消息但代码不支持解密 | 添加 AES 解密支持，配置 `WECHAT_ENCODING_AES_KEY` |

## 注意事项

1. 确保你有 VPS 的 SSH 访问权限（当前环境已配置）
2. rsync 需要在本地和远程都可用（默认已安装）
3. 备份存储在 VPS 的 `/var/www/backups/`，定期清理旧备份
4. Nginx 配置已经在 VPS 配置好，不需要修改
5. `public/content/` 目录不会被 rsync 覆盖删除，因为它不在 `./dist` 里
