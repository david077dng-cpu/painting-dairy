# 🌸 我的个人网站 · Astro 版

基于 [Astro](https://astro.build) 构建的个人主页，支持 Markdown 写文章。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd my-portfolio
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 → http://localhost:4321

---

## ✍️ 写新文章（核心功能）

只需在 `src/content/posts/` 目录下新建一个 `.md` 文件：

```
src/content/posts/
  ├── my-new-post.md   ← 新建这个文件
  ├── film-photography.md
  └── design-tools.md
```

文章模板：

```markdown
---
title: 文章标题
date: 2026-03-15
category: 随笔
description: 一句话简介（可选）
---

## 正文从这里开始

你的内容...
```

保存后，网站自动更新，文章立刻出现在 `/posts` 页面 ✅

---

## 📁 项目结构

```
my-portfolio/
├── src/
│   ├── content/
│   │   ├── config.ts          # 内容集合配置
│   │   └── posts/             # ← 把 .md 文章放这里
│   ├── layouts/
│   │   ├── BaseLayout.astro   # 页面通用框架（导航 + 页脚）
│   │   └── PostLayout.astro   # 文章页排版
│   └── pages/
│       ├── index.astro        # 主页
│       └── posts/
│           ├── index.astro    # 文章列表页
│           └── [slug].astro   # 文章详情页（自动路由）
├── public/                    # 静态资源（图片等）
├── astro.config.mjs
└── package.json
```

---

## 🔧 自定义内容

### 修改个人信息
编辑 `src/pages/index.astro`，搜索并替换：
- `李春晓` → 你的名字
- `北京，中国` → 你的城市
- 技能卡片、作品内容等

### 修改导航 Logo
编辑 `src/layouts/BaseLayout.astro`，找到 `nav-logo` 部分。

---

## 🌐 部署

### 方案 A：Vercel（推荐，最简单）
1. 把项目推送到 GitHub
2. 登录 [vercel.com](https://vercel.com)，导入仓库
3. 点击 Deploy，完成 ✅

### 方案 B：GitHub Pages
1. 安装适配器：`npm install @astrojs/node`
2. 修改 `astro.config.mjs`：
   ```js
   export default defineConfig({
     site: 'https://david077dng-cpu.github.io',
     base: '/painting-dairy',
   });
   ```
3. 推送代码，在 GitHub 仓库设置开启 Pages

---

## Markdown 语法速查

| 语法 | 效果 |
|------|------|
| `## 标题` | 二级标题 |
| `**粗体**` | **粗体** |
| `*斜体*` | *斜体* |
| `> 引用` | 引用块（暖色样式） |
| `` `代码` `` | 行内代码 |
| `![图片](url)` | 插入图片 |
| `[链接](url)` | 插入链接 |

---

用心维护 ♥
