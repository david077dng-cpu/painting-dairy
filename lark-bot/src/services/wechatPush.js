/**
 * 微信公众号推送接收服务
 * 处理公众号新文章推送，自动触发同步
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { WechatSync } = require('./wechatSync');
const { GitSync } = require('./gitSync');

class WechatPushHandler {
  constructor(options = {}) {
    this.token = options.token || process.env.WECHAT_TOKEN;
    this.appid = options.appid || process.env.WECHAT_APPID;
    this.encodingAesKey = options.encodingAesKey || process.env.WECHAT_ENCODING_AES_KEY;
    this.wechatSync = new WechatSync();
    this.gitSync = new GitSync();
    this.reportChatId = options.reportChatId || process.env.REPORT_CHAT_ID;
    this.sendMessage = options.sendMessage; // 飞书发消息回调

    // 邮件通知配置
    this.emailEnabled = process.env.EMAIL_NOTIFICATION_ENABLED === 'true';
    if (this.emailEnabled && process.env.EMAIL_SMTP_HOST && process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASS,
        },
      });
      this.emailFrom = process.env.EMAIL_SMTP_USER;
      console.log('[WechatPush] 邮件通知已启用');
    } else {
      this.transporter = null;
      this.emailFrom = null;
    }
    this.emailTo = process.env.EMAIL_NOTIFICATION_TO;
  }

  /**
   * 验证微信服务器签名
   */
  verifySignature(query) {
    const { signature, timestamp, nonce, echostr } = query;
    const arr = [this.token, timestamp, nonce].sort();
    const str = arr.join('');
    const hash = crypto.createHash('sha1').update(str).digest('hex');

    return {
      valid: hash === signature,
      echostr: hash === signature ? echostr : null
    };
  }

  /**
   * AES 解密微信加密消息
   */
  decryptMessage(encryptContent) {
    if (!this.encodingAesKey) {
      console.error('[WechatPush] 加密消息收到，但 WECHAT_ENCODING_AES_KEY 未配置');
      return null;
    }

    console.log(`[WechatPush] 开始解密: encryptContent length=${encryptContent.length}, appid=${this.appid}, appid length=${this.appid ? this.appid.length : 0}`);

    try {
      const key = Buffer.from(this.encodingAesKey + '=', 'base64');
      console.log(`[WechatPush] 密钥长度: key=${key.length} bytes`);

      const iv = key.slice(0, 16);
      console.log(`[WechatPush] IV: iv length=${iv.length} bytes`);

      const cipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = cipher.update(encryptContent, 'base64', 'utf8');
      decrypted += cipher.final('utf8');

      console.log(`[WechatPush] 解密后长度: ${decrypted.length} bytes`);

      // 去除填充
      const pad = decrypted.charCodeAt(decrypted.length - 1);
      console.log(`[WechatPush] PKCS#7 padding: pad length=${pad}`);
      decrypted = decrypted.slice(0, decrypted.length - pad);
      console.log(`[WechatPush] 去除填充后长度: ${decrypted.length} bytes`);

      // 提取 XML 部分（去掉前面的 16 字节随机 + 4 字节消息长度 + AppID）
      // 如果没有配置 appid，默认为 0 长度
      const appidLength = this.appid ? this.appid.length : 0;
      const xml = decrypted.slice(16 + 4 + appidLength);
      console.log(`[WechatPush] 提取XML: offset=${16 + 4 + appidLength}, xml length=${xml.length}`);

      if (xml.length > 0) {
        console.log(`[WechatPush] XML 开头: ${xml.substring(0, Math.min(200, xml.length))}`);
      }

      return xml;
    } catch (err) {
      console.error('[WechatPush] 解密失败:', err);
      return null;
    }
  }

  /**
   * 解析推送的XML
   */
  parseXml(xml) {
    // 检查输入
    if (!xml) {
      console.error('[WechatPush] parseXml: xml is empty or null');
      return {};
    }

    // 检查是否是加密消息
    // 使用非贪婪匹配 ([\\s\\S]+?) 来获取完整的 CDATA 内容
    const encryptMatch = xml.match(/<Encrypt><!\[CDATA\[([\s\S]+?)\]\]><\/Encrypt>/);
    if (encryptMatch) {
      // 加密消息需要解密
      console.log(`[WechatPush] 检测到加密消息，加密内容长度: ${encryptMatch[1].length}`);
      const decryptedXml = this.decryptMessage(encryptMatch[1]);
      if (!decryptedXml) {
        console.error('[WechatPush] parseXml: decryption failed, check WECHAT_ENCODING_AES_KEY and WECHAT_APPID configuration');
        return {};
      }
      xml = decryptedXml;
    }

    // 简单解析，提取关键信息
    const result = {};
    // 使用非贪婪匹配，避免遇到 ] 就中断
    const titleMatch = xml ? xml.match(/<Title><!\[CDATA\[([\s\S]+?)\]\]><\/Title>/) : null;
    const urlMatch = xml ? xml.match(/<Url><!\[CDATA\[([\s\S]+?)\]\]><\/Url>/) : null;
    const msgTypeMatch = xml ? xml.match(/<MsgType><!\[CDATA\[([\s\S]+?)\]\]><\/MsgType>/) : null;
    const eventMatch = xml ? xml.match(/<Event><!\[CDATA\[([\s\S]+?)\]\]><\/Event>/) : null;
    // 群发完成事件中，文章URL在 ArticleUrl 标签中
    const articleUrlMatch = xml ? xml.match(/<ArticleUrl><!\[CDATA\[([\s\S]+?)\]\]><\/ArticleUrl>/) : null;

    if (titleMatch) result.title = titleMatch[1];
    if (urlMatch) result.url = urlMatch[1];
    if (msgTypeMatch) result.msgType = msgTypeMatch[1];
    if (eventMatch) result.event = eventMatch[1];
    // 处理 MASSSENDJOBFINISH 事件，提取文章URL
    if (eventMatch && eventMatch[1] === 'MASSSENDJOBFINISH' && articleUrlMatch) {
      result.url = articleUrlMatch[1];
      result.msgType = 'mpnews'; // 当做文章推送处理
      console.log('[WechatPush] 检测到群发完成事件，提取文章URL:', result.url);
    }

    console.log('[WechatPush] parseXml result:', result);
    return result;
  }

  /**
   * 处理推送事件
   */
  async handlePush(xmlBody) {
    // 始终记录原始请求体，不管是否能解析
    console.log('[WechatPush] 收到原始推送 XML:');
    console.log(xmlBody);
    console.log('[WechatPush] --------------------------');

    // 同时保存到文件，方便事后排查问题
    const fs = require('fs');
    const path = require('path');
    try {
      const logDir = path.join(__dirname, '../../data/logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logDir, `wechat-push-${timestamp}.xml`);
      fs.writeFileSync(logFile, String(xmlBody || ''), 'utf8');
      console.log(`[WechatPush] 原始内容已保存到: data/logs/wechat-push-${timestamp}.xml`);
    } catch (e) {
      console.log('[WechatPush] 保存原始内容到文件失败:', e.message);
    }

    const parsed = this.parseXml(xmlBody || '');
    console.log('[WechatPush] 解析结果:', parsed);

    // 只处理群发图文推送（新文章发布）
    if (parsed.msgType !== 'mpnews' && parsed.msgType !== 'news') {
      console.log('[WechatPush] 不是文章推送，忽略');
      return {
        handled: false,
        reason: `不是文章推送，消息类型: ${parsed.msgType}`
      };
    }

    if (!parsed.url || !parsed.url.includes('mp.weixin.qq.com/s')) {
      console.log('[WechatPush] URL无效，忽略');
      return {
        handled: false,
        reason: 'URL无效'
      };
    }

    // 添加到待导入列表
    const addResult = this.wechatSync.addArticle(parsed.url, null);
    if (!addResult.success) {
      console.log('[WechatPush] 添加失败:', addResult.message);
      return {
        handled: false,
        reason: addResult.message
      };
    }

    console.log('[WechatPush] 已添加到待导入列表，开始同步');

    // 触发同步
    try {
      const syncResult = await this.wechatSync.sync();

      // 飞书通知
      if (this.sendMessage && this.reportChatId) {
        if (syncResult.importedCount === 0) {
          await this.sendMessage(this.reportChatId,
            `ℹ️ 收到公众号新文章推送，但同步完成后没有导入新文章\n• URL: ${parsed.url}`
          );
        } else {
          await this.sendMessage(this.reportChatId,
            `🎉 公众号新文章自动同步完成!\n` +
            `• 标题: ${parsed.title || '未知'}\n` +
            `• URL: ${parsed.url}\n` +
            `• 导入: ${syncResult.importedCount} 篇\n` +
            `⏰ ${new Date().toLocaleString()}`
          );

          // Git 推送
          try {
            const gitResult = await this.gitSync.sync(syncResult.importedCount);
            if (gitResult.success) {
              await this.sendMessage(this.reportChatId,
                `✅ Git 推送成功，网站将自动部署\n• ${gitResult.message}`
              );
            } else {
              await this.sendMessage(this.reportChatId,
                `⚠️ Git 推送失败: ${gitResult.message}`
              );
            }
          } catch (gitErr) {
            await this.sendMessage(this.reportChatId,
              `❌ Git 推送出错: ${gitErr.message}`
            );
          }
        }
      }

      // 邮件通知
      if (this.emailEnabled && this.transporter && this.emailTo) {
        const subject = syncResult.importedCount === 0
          ? `ℹ️ 公众号新文章推送 - 无新文章导入`
          : `🎉 公众号新文章 "${parsed.title || '未知'}" 自动同步完成`;

        let text = '';
        if (syncResult.importedCount === 0) {
          text = `🎉 收到公众号新文章推送！\n` +
            `标题: ${parsed.title || '未知'}\n` +
            `推送文章地址: ${parsed.url}\n` +
            `\n同步完成，但没有导入新文章\n` +
            `时间: ${new Date().toLocaleString()}`;
        } else {
          text = `🎉 公众号新文章自动同步完成！\n` +
            `标题: ${parsed.title || '未知'}\n` +
            `推送文章地址: ${parsed.url}\n` +
            `导入: ${syncResult.importedCount} 篇\n` +
            `同步时间: ${new Date().toLocaleString()}\n` +
            `\n博客地址: https://xlilian.cn`;
        }

        await this.transporter.sendMail({
          from: this.emailFrom,
          to: this.emailTo,
          subject: subject,
          text: text,
        });
        console.log('[WechatPush] 邮件通知已发送');
      }

      return {
        handled: true,
        importedCount: syncResult.importedCount,
        title: parsed.title,
        url: parsed.url
      };
    } catch (err) {
      console.error('[WechatPush] 同步失败:', err);

      // 飞书通知
      if (this.sendMessage && this.reportChatId) {
        await this.sendMessage(this.reportChatId,
          `❌ 公众号新文章同步失败\n• URL: ${parsed.url}\n• 错误: ${err.message}`
        );
      }

      // 邮件通知
      if (this.emailEnabled && this.transporter && this.emailTo && this.emailFrom) {
        await this.transporter.sendMail({
          from: this.emailFrom,
          to: this.emailTo,
          subject: `❌ 公众号新文章同步失败`,
          text: `URL: ${parsed.url}\n错误: ${err.message}`,
        });
      }

      throw err;
    }
  }
}

module.exports = { WechatPushHandler };
