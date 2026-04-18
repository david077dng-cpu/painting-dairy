# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Personal portfolio website and blog built with Astro, plus a Feishu (Lark) bot for website management and monitoring.

- **Main site**: Astro-based personal portfolio with Markdown blog posts, homepage with personal info/skills, and a blog section with article listings.
- **Lark Bot**: Node.js/Express bot for website monitoring, deployment management, and data reporting via Feishu.

## Commands

### Main Site (Astro)
```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:4321
npm run build        # Production build
npm run preview      # Preview production build
node download-images.js  # Download external images (WeChat) to local
node fix-image-paths.js  # Fix image paths in posts
node fix-posts.js    # Fix post frontmatter
node test-posts.js   # Validate posts
```

### Lark Bot (in lark-bot/ directory)
```bash
cd lark-bot
npm install                    # Install dependencies
npm run setup                  # Run configuration wizard
npm run dev                    # Start local dev server
./start-local.sh               # Alternative local startup
npm start                      # Production start with Node
```

### Deployment
Use the `vps-incremental-deploy` skill for incremental deployment to VPS:
```
/vps-incremental-deploy         # Full automated deployment to root@101.132.32.3
```

## Architecture

### Main Astro Site

- **Output**: Server-side render with `@astrojs/node` adapter, deployed to VPS at https://xlilian.cn
- **Content Collections**: Blog posts are stored as Markdown files in `src/content/posts/`. Each post uses frontmatter with `title`, `date`, `description`, and `category` fields. Schema defined in [src/content.config.ts](src/content.config.ts).
- **Routing**: Uses Astro's file-based routing
  - `src/pages/index.astro` - Homepage with personal info
  - `src/pages/posts/index.astro` - Blog listing page
  - `src/pages/posts/[slug].astro` - Dynamic post pages
- **Layouts**: [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro) provides common shell (nav, footer). [src/layouts/PostLayout.astro](src/layouts/PostLayout.astro) handles article typography.
- **Configuration**: [astro.config.mjs](astro.config.mjs) - configured for server output with site: `https://xlilian.cn`

### Lark Bot (Feishu Management Bot)

Location: `lark-bot/` - A complete Node.js/Express service that provides:

- **Website Monitoring**: Health checks every 5 minutes, SSL certificate monitoring daily, SSL expiration alerts
- **Content Management**: Article listing, draft management, reading statistics
- **Deployment Management**: Trigger deployment via GitHub, rollback support
- **Automated Reporting**: Daily/weekly analytics reports pushed to Feishu
- **Bot Commands**: `/help`, `/status`, `/deploy`, `/report daily|weekly` via Feishu chat

**Structure**:
- `lark-bot/src/index.js` - Main entry and HTTP server
- `lark-bot/src/services/` - Individual service modules (lark, monitor, deploy, report, wechatSync, gitSync)
- `lark-bot/.env` - Environment variables (Feishu app credentials, webhook)
- `lark-bot/ecosystem.config.js` - PM2 process configuration

### Root Utility Scripts

- `download-images.js` - Downloads WeChat images from `mmbiz.qpic.cn` to local `public/images/` and updates post content
- `fix-image-paths.js` - Fixes image paths in posts
- `fix-posts.js` - Fixes post frontmatter issues
- `restore-posts.js` - Restores posts from backup
- `deploy.sh` - Server deployment script

### AI Art Advisor Scripts (in scripts/)
Various test scripts for AI image generation and prompt testing with Anthropic/Volcengine/OpenAI providers.

## Adding Content

Create new `.md` files in `src/content/posts/` with frontmatter:

```markdown
---
title: Your Title
date: 2026-03-15
category: Category
description: Brief description
---

# Your content here...
```

After adding content, run `node download-images.js` to download any external images to local storage.

## Deployment

- Configured for deployment to VPS at `root@101.132.32.3` (xlilian.cn)
- Use the `vps-incremental-deploy` skill for automated incremental deployment with backup and health check
- Output: server mode builds to `dist/` directory which is synced to server
