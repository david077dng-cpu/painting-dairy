# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Astro-based personal portfolio website with Markdown blog posts. The site features a homepage with personal info/skills and a blog section with article listings.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:4321
npm run build    # Production build
npm run preview  # Preview production build
```

## Architecture

- **Content Collections**: Blog posts are stored as Markdown files in `src/content/posts/`. Each post uses frontmatter with `title`, `date`, `description`, and `category` fields. Schema is defined in [src/content/config.ts](src/content/config.ts).
- **Routing**: Uses Astro's file-based routing
  - `src/pages/index.astro` - Homepage
  - `src/pages/posts/index.astro` - Blog listing
  - `src/pages/posts/[slug].astro` - Dynamic post pages
- **Layouts**: [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro) provides the common shell (nav, footer). [src/layouts/PostLayout.astro](src/layouts/PostLayout.astro) handles article typography.

## Adding Content

Create new `.md` files in `src/content/posts/` with frontmatter:

```markdown
---
title: Your Title
date: 2026-03-15
category: Category
description: Brief description
---
```