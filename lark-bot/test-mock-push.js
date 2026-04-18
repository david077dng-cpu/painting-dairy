/**
 * Mock 完整的微信公众号加密推送测试
 *
 * 使用真实加密算法构造一条加密推送，模拟今天早晨的推送场景
 * 测试完整流程: 接收 -> 正则匹配提取加密内容 -> 解密 -> 解析 -> 同步 -> 发邮件
 */

require('dotenv').config();
const crypto = require('crypto');
const { WechatPushHandler } = require('./src/services/wechatPush');

console.log('='.repeat(80));
console.log('🔍 Mock 微信公众号加密推送 - 完整流程测试');
console.log('='.repeat(80));

// 检查配置
console.log('\n📋 [配置检查]');
console.log(`WECHAT_TOKEN: ${process.env.WECHAT_TOKEN ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`WECHAT_ENCODING_AES_KEY: ${process.env.WECHAT_ENCODING_AES_KEY ? '✅ 已配置 (长度 ${process.env.WECHAT_ENCODING_AES_KEY?.length})' : '❌ 未配置'}`);
console.log(`WECHAT_APPID: ${process.env.WECHAT_APPID ? `✅ 已配置 (${process.env.WECHAT_APPID}, 长度 ${process.env.WECHAT_APPID.length})` : '❌ 未配置'}`);
console.log(`EMAIL_NOTIFICATION_ENABLED: ${process.env.EMAIL_NOTIFICATION_ENABLED}`);
console.log(`EMAIL_SMTP_HOST: ${process.env.EMAIL_SMTP_HOST ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`EMAIL_SMTP_USER: ${process.env.EMAIL_SMTP_USER ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`EMAIL_SMTP_PASS: ${process.env.EMAIL_SMTP_PASS ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`EMAIL_NOTIFICATION_TO: ${process.env.EMAIL_NOTIFICATION_TO ? '✅ 已配置' : '❌ 未配置'}`);

// 创建处理器
const handler = new WechatPushHandler({
  sendMessage: async (chatId, text) => {
    console.log('\n[飞书通知模拟]:', text);
  }
});

console.log('\n🚀 [处理器初始化完成]');
console.log(`token: ${handler.token ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`appid: ${handler.appid}`);
console.log(`encodingAesKey: ${handler.encodingAesKey ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`emailEnabled: ${handler.emailEnabled}`);
console.log(`transporter: ${handler.transporter ? '✅ 已创建' : '❌ 未创建'}`);

// ==========================================
// 构造一条真实的测试推送（加密后）
// ==========================================

// 1. 构造明文 XML（模拟一篇新文章推送）
const plainXml = `
<xml>
<ToUserName><![CDATA[gh_24e3f5ee7ee5]]></ToUserName>
<FromUserName><![CDATA[wx7121acb4193e6df2]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[mpnews]]></MsgType>
<ArticleCount>1</ArticleCount>
<Articles>
<item>
<Title><![CDATA[测试文章 - 这是今天早晨推送的新文章]]></Title>
<Description><![CDATA[这是一篇测试文章，用于验证自动推送流程]]></Description>
<Url><![CDATA[https://mp.weixin.qq.com/s/abc123xyz456]]></Url>
<PicUrl><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/example/640]]></PicUrl>
</item>
</Articles>
</xml>
`.trim();

console.log('\n📝 [构造测试明文]:');
console.log(plainXml);
console.log('\n' + '='.repeat(80));

// 手动加密（按照微信加密算法）
function encryptMessage(plainXml, encodingAesKey, appid) {
  // 微信加密格式:
  // 16 bytes random + 4 bytes msg len + msg len network byte order + plain xml + appid
  // 然后 PKCS#7 padding, AES-256-CBC encrypt, base64 encode

  const key = Buffer.from(encodingAesKey + '=', 'base64');
  const iv = key.slice(0, 16);

  // 计算消息长度（网络字节序，大端）
  const msgLen = Buffer.byteLength(plainXml);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgLen, 0);

  // 生成 16 字节随机数
  const random = crypto.randomBytes(16);

  // 拼接: random(16) + len(4) + plainXml + appid
  const message = Buffer.concat([
    random,
    lenBuf,
    Buffer.from(plainXml),
    Buffer.from(appid || '')
  ]);

  // PKCS#7 padding
  const blockSize = 32;
  const padLength = blockSize - (message.length % blockSize);
  const padding = Buffer.alloc(padLength, padLength);
  const paddedMessage = Buffer.concat([message, padding]);

  // AES-256-CBC 加密
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(paddedMessage, null, 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// 使用当前配置加密
const encryptedContent = encryptMessage(
  plainXml,
  handler.encodingAesKey,
  handler.appid
);

console.log('\n🔐 [加密完成]');
console.log(`加密后长度: ${encryptedContent.length} bytes`);
console.log(`加密内容前 100 字符: ${encryptedContent.substring(0, 100)}...`);

// 构造完整的微信推送 XML
const fullXml = `<xml>
<Encrypt><![CDATA[${encryptedContent}]]></Encrypt>
<MsgSignature>mock-signature</MsgSignature>
<TimeStamp>${Math.floor(Date.now() / 1000)}</TimeStamp>
<Nonce>mock-nonce</Nonce>
</xml>`;

console.log('\n📦 [完整推送XML构造完成]');
console.log(`XML 总长度: ${fullXml.length} bytes`);
console.log('='.repeat(80));

// 调用处理
console.log('\n🧪 开始处理推送...\n');
handler.handlePush(fullXml)
  .then(result => {
    console.log('\n' + '='.repeat(80));
    console.log('✅ 处理完成!');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    if (result.handled) {
      console.log(`
🎉 推送处理成功！
• 消息类型: ${result.title ? 'mpnews' : '?' }
• 标题: ${result.title || 'N/A'}
• URL: ${result.url || 'N/A'}
• 导入数量: ${result.importedCount}

如果邮件配置正确，通知邮件已经发送到 ${process.env.EMAIL_NOTIFICATION_TO}
请检查你的邮箱!
`);
    } else {
      console.log(`
⚠️  推送处理未完成: ${result.reason}
`);
    }
  })
  .catch(err => {
    console.log('\n' + '='.repeat(80));
    console.log('❌ 处理失败!');
    console.log('='.repeat(80));
    console.error('错误:', err);
  });
