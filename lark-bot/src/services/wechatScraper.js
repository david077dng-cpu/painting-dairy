/**
 * 微信文章爬虫服务
 * 从微信文章URL抓取内容并转换为Markdown
 */

const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

// 初始化 HTML -> Markdown 转换器
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// 请求头，模拟浏览器访问
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://mp.weixin.qq.com/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

class WechatScraper {
  /**
   * 抓取微信文章内容
   * @param {string} url 微信文章URL
   * @returns {Promise<{title: string, date: string, content: string, description: string}>}
   */
  async scrape(url) {
    console.log(`开始抓取: ${url}`);

    const html = await this.fetchHtml(url);
    return this.parseHtml(html, url);
  }

  /**
   * 获取HTML内容
   */
  async fetchHtml(url) {
    // 随机延迟 1-3 秒，避免被反爬
    await this.randomDelay(1000, 3000);

    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 30000,
    });

    return response.data;
  }

  /**
   * 解析HTML提取内容
   */
  parseHtml(html, url) {
    const $ = cheerio.load(html);

    // 提取标题
    const title = this.extractTitle($);

    // 提取发布日期
    const date = this.extractDate($);

    // 提取正文内容
    const contentHtml = this.extractContentHtml($);

    // 转换为Markdown
    const contentMarkdown = turndownService.turndown(contentHtml);

    // 生成描述（取正文前 200 字）
    const description = this.generateDescription(contentMarkdown);

    return {
      title,
      date,
      content: contentMarkdown,
      description,
      url,
    };
  }

  /**
   * 提取标题
   */
  extractTitle($) {
    // 尝试多个选择器
    let title = $('h1#activity-name').text().trim();
    if (title) return title;

    title = $('h2.rich_media_title').text().trim();
    if (title) return title;

    title = $('title').text().trim();
    if (title) return title.replace(/\_微信公众号$/, '').trim();

    return '未知标题';
  }

  /**
   * 提取发布日期
   */
  extractDate($) {
    // 尝试多个选择器
    let dateStr = $('em#post-date').text().trim();
    if (dateStr) {
      // 处理常见格式 "2026-03-15" 或 "2026年03月15日"
      return this.normalizeDate(dateStr);
    }

    dateStr = $('.rich_media_meta_text').first().text().trim();
    if (dateStr) {
      return this.normalizeDate(dateStr);
    }

    dateStr = $('.post-date').text().trim();
    if (dateStr) {
      return this.normalizeDate(dateStr);
    }

    // 如果找不到，返回今天
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 标准化日期格式
   */
  normalizeDate(dateStr) {
    // 已经是 YYYY-MM-DD 格式
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      return dateStr;
    }

    // 格式: 2026年03月15日
    const chineseMatch = dateStr.match(/(\d{4})[年\s](\d{1,2})[月\s](\d{1,2})/);
    if (chineseMatch) {
      const [, year, month, day] = chineseMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 格式: 2026/03/15
    const slashMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 无法解析，返回今天
    console.warn(`无法解析日期: ${dateStr}，使用今天`);
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 提取正文HTML
   */
  extractContentHtml($) {
    // 微信文章正文主要容器 - 尝试多个选择器
    let content = null;

    // 1. 完整的 rich_media 容器
    content = $('.rich_media').html();
    if (content && content.trim().length > 200) {
      console.log(`使用 .rich_media，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    // 2. #js_content 最常见
    content = $('#js_content').parent().html();
    if (content && content.trim().length > 200) {
      console.log(`使用 #js_content.parent，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    // 3. #js_content itself
    content = $('#js_content').html();
    if (content && content.trim().length > 0) {
      console.log(`使用 #js_content，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    // 4. .rich_media_content
    content = $('.rich_media_content').parent().html();
    if (content && content.trim().length > 200) {
      console.log(`使用 .rich_media_content.parent，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    // 5. .rich_media_content
    content = $('.rich_media_content').html();
    if (content && content.trim().length > 0) {
      console.log(`使用 .rich_media_content，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    // 6. #content
    content = $('#content').html();
    if (content && content.trim().length > 0) {
      console.log(`使用 #content，长度 ${content.length}`);
      return this.cleanupHtml(content);
    }

    throw new Error('无法提取文章内容，可能被反爬拦截');
  }

  /**
   * 清理HTML，移除不必要的元素
   */
  cleanupHtml(html) {
    if (!html) return '';

    // 移除微信公众号水印、二维码、脚本、底部提示等
    let cleaned = html
      // 移除各种容器
      .replace(/<div[^>]*class="[^"]*rich_media_wrp[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*weui-msg__area[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*rich_media_extra[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*id="js_extra_area[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*profile_container[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*qr_code[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*original[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*copyright[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<section[^>]*class="[^"]*tools[^"]*"[^>]*>.*?<\/section>/gi, '')
      // 移除微信版权和底部提示
      .replace(/var.*first_screen.*?\}\s*;/gi, '')
      .replace(/预览时标签不可点|微信扫一扫|关注该公众号|继续滑动看下一个|PaintingDiarty?/gi, '')
      .replace(/<[^>]*javascript:void\(0\)[^>]*>/gi, '')
      // 去掉空行
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    cleaned = cleaned.trim();
    console.log(`清理后长度: ${cleaned.length}`);
    return cleaned;
  }

  /**
   * 从正文生成描述
   */
  generateDescription(content) {
    // 取前 200 字符，去掉多余空白和换行
    const clean = content
      .replace(/!\[.*?\]\(.*?\)/g, '[图片]') // 替换图片链接
      .replace(/#+\s*/g, '') // 移除标题标记
      .replace(/\*\*/g, '') // 移除粗体标记
      .replace(/\n+/g, ' ') // 合并换行
      .trim();

    return clean.substring(0, 200) + (clean.length > 200 ? '...' : '');
  }

  /**
   * 随机延迟
   */
  randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = { WechatScraper };
