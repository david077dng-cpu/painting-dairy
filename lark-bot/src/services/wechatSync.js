/**
 * 微信文章同步服务
 * 将抓取的文章同步到 Astro 博客内容集合
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { WechatScraper } = require('./wechatScraper');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_ARTICLES_JSON_PATH = path.resolve(__dirname, '../../data/wechat-articles.json');
const POSTS_DIR = path.resolve(PROJECT_ROOT, 'src/content/posts');

class WechatSync {
  constructor(options = {}) {
    this.scraper = new WechatScraper();
    this.articlesJsonPath = options.articlesJsonPath || process.env.WECHAT_ARTICLES_JSON_PATH || DEFAULT_ARTICLES_JSON_PATH;
    this.defaultCategory = options.defaultCategory || process.env.WECHAT_DEFAULT_CATEGORY || 'Painting Diary';
    this.ensureDataDir();
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDir() {
    const dir = path.dirname(this.articlesJsonPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.articlesJsonPath)) {
      fs.writeFileSync(this.articlesJsonPath, JSON.stringify({
        articles: [],
        lastSync: null,
        importCount: 0,
      }, null, 2), 'utf8');
    }
  }

  /**
   * 读取文章列表
   */
  loadArticles() {
    const data = fs.readFileSync(this.articlesJsonPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * 保存文章列表
   */
  saveArticles(data) {
    data.lastSync = new Date().toISOString();
    fs.writeFileSync(this.articlesJsonPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * 从标题生成 slug
   */
  generateSlug(title) {
    // 转小写，替换非字母数字为连字符
    let slug = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 如果是中文，使用日期前缀避免冲突
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    if (/^[\u4e00-\u9fa5]/.test(slug) || slug.length < 3) {
      slug = `${dateStr}-${slug}`;
    }

    // 限制长度
    if (slug.length > 80) {
      slug = slug.substring(0, 80);
    }

    return slug;
  }

  /**
   * 保存文章为 Markdown 文件
   */
  saveArticleToFile(articleData, slug, category) {
    const frontmatter = `---
title: ${articleData.title}
date: ${articleData.date}
category: ${category || this.defaultCategory}
description: ${articleData.description.replace(/\n/g, ' ')}
author: Lilian
---

`;

    const content = frontmatter + articleData.content;
    const filePath = path.join(POSTS_DIR, `${slug}.md`);

    // 确保目录存在
    if (!fs.existsSync(POSTS_DIR)) {
      fs.mkdirSync(POSTS_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`文章已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 运行图片下载脚本（复用已有代码）
   */
  runDownloadImages() {
    const scriptPath = path.join(PROJECT_ROOT, 'download-images.js');
    if (!fs.existsSync(scriptPath)) {
      console.warn('download-images.js 不存在，跳过图片下载');
      return false;
    }

    try {
      console.log('开始下载图片...');
      const output = execSync(`node ${scriptPath}`, { encoding: 'utf8', cwd: PROJECT_ROOT });
      console.log(output);
      return true;
    } catch (err) {
      console.error('图片下载失败:', err.message);
      return false;
    }
  }

  /**
   * 同步所有待导入文章
   */
  async sync() {
    const data = this.loadArticles();
    const pendingArticles = data.articles.filter(a => !a.imported);

    if (pendingArticles.length === 0) {
      console.log('没有待导入的文章');
      return {
        success: true,
        importedCount: 0,
        message: '没有待导入的文章',
      };
    }

    console.log(`找到 ${pendingArticles.length} 篇待导入文章`);
    let importedCount = 0;
    const errors = [];

    for (const article of pendingArticles) {
      try {
        console.log(`\n开始导入: ${article.url}`);

        // 抓取内容
        const articleData = await this.scraper.scrape(article.url);

        // 生成 slug
        const slug = article.slug || this.generateSlug(articleData.title);

        // 保存文件
        this.saveArticleToFile(articleData, slug, article.category);

        // 更新状态
        article.title = articleData.title;
        article.imported = true;
        article.importedAt = new Date().toISOString();
        article.slug = slug;

        importedCount++;
        data.importCount = (data.importCount || 0) + 1;

        console.log(`导入成功: ${articleData.title} -> ${slug}.md`);

        // 请求之间随机延迟 2-5 秒，避免反爬
        await this.randomDelay(2000, 5000);
      } catch (err) {
        console.error(`导入失败 ${article.url}:`, err.message);
        errors.push({
          url: article.url,
          error: err.message,
        });
      }
    }

    // 保存更新后的 JSON
    this.saveArticles(data);

    // 如果有导入文章，下载图片
    if (importedCount > 0) {
      this.runDownloadImages();
    }

    return {
      success: errors.length === 0,
      importedCount,
      pendingCount: pendingArticles.length - importedCount,
      errors,
      message: importedCount > 0
        ? `成功导入 ${importedCount} 篇文章`
        : '没有文章被导入',
    };
  }

  /**
   * 获取同步统计信息
   */
  getStats() {
    const data = this.loadArticles();
    const total = data.articles.length;
    const imported = data.articles.filter(a => a.imported).length;
    const pending = total - imported;

    return {
      total,
      imported,
      pending,
      lastSync: data.lastSync,
      importCount: data.importCount || 0,
    };
  }

  /**
   * 添加新文章到待导入列表
   */
  addArticle(url, category = null) {
    const data = this.loadArticles();

    // 检查是否已存在
    const exists = data.articles.find(a => a.url === url);
    if (exists) {
      return {
        success: false,
        message: '该URL已存在于列表中',
      };
    }

    data.articles.push({
      url,
      title: null,
      category: category,
      addedAt: new Date().toISOString(),
      imported: false,
      importedAt: null,
      slug: null,
    });

    this.saveArticles(data);

    return {
      success: true,
      message: `已添加到待导入列表，当前共 ${data.articles.length} 篇，待导入 ${data.articles.length - (data.importCount || 0)} 篇`,
    };
  }

  /**
   * 列出待导入文章
   */
  listPending() {
    const data = this.loadArticles();
    return data.articles.filter(a => !a.imported);
  }

  /**
   * 随机延迟
   */
  randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = { WechatSync };
