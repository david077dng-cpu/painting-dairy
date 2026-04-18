/**
 * 测试微信公众号推送解密
 * 使用今天实际收到的推送记录进行测试
 *
 * 使用方法：
 * 1. 在 VPS 上执行：pm2 logs lark-bot --lines 100
 * 2. 找到今天收到推送的完整日志，复制 <Encrypt><![CDATA[...]]></Encrypt> 中 ... 部分
 * 3. 粘贴到下面 ACTUAL_ENCRYPT_CONTENT 变量中
 * 4. 运行：cd lark-bot && node test-wechat-push.js
 */

require('dotenv').config();
const { WechatPushHandler } = require('./src/services/wechatPush');

// ==========================================
// ↓ 请在这里粘贴今天收到的加密内容（CDATA 里面的部分）
// ==========================================
const ACTUAL_ENCRYPT_CONTENT = `
<!-- 粘贴在这里 -->
`;
// ==========================================
// ↑ 请在这里粘贴今天收到的加密内容
// ==========================================

console.log('='.repeat(70));
console.log('🔍 微信公众号推送解密测试');
console.log('='.repeat(70));

// 检查环境配置
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
console.log(`appid: ${handler.appid || '(空)'}`);
console.log(`encodingAesKey: ${handler.encodingAesKey ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`emailEnabled: ${handler.emailEnabled}`);
console.log(`transporter: ${handler.transporter ? '✅ 已创建' : '❌ 未创建'}`);

// 如果有实际加密内容就测试
const encryptContent = ACTUAL_ENCRYPT_CONTENT.trim();
if (encryptContent && encryptContent !== '<!-- 粘贴在这里 -->') {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 开始解密测试...');
  console.log('='.repeat(70));

  const fullXml = `<xml><Encrypt><![CDATA[${encryptContent}]]></Encrypt></xml>`;

  console.log('\n📥 [输入信息]');
  console.log(`完整 XML 长度: ${fullXml.length} bytes`);
  console.log(`加密内容长度: ${encryptContent.length} bytes`);

  const result = handler.parseXml(fullXml);
  console.log('\n📤 [解析结果]:', JSON.stringify(result, null, 2));

  if (result && result.msgType && result.url) {
    console.log('\n✅ 解密成功！可以正确提取信息');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`消息类型: ${result.msgType}`);
    if (result.title) console.log(`文章标题: ${result.title}`);
    if (result.contentUrl) console.log(`文章链接: ${result.contentUrl}`);
    console.log('────────────────────────────────────────────────────────────────');
    console.log('👉 VPS 上配置正确后，就能正常处理推送并发邮件了');
  } else if (result === null) {
    console.log('\n❌ 解密失败，请检查上面的日志输出定位问题');
  } else {
    console.log('\n⚠️  解密完成但未能提取到文章信息');
    console.log('可能这不是新文章推送消息（可能是普通消息或其他事件）');
  }
} else {
  console.log(`
${'='.repeat(70)}

❗ 请将今天收到的加密内容粘贴到 ACTUAL_ENCRYPT_CONTENT 变量中，
然后再次运行:

  cd lark-bot && node test-wechat-push.js

📝 如何获取加密内容：
  1. SSH 登录到你的 VPS
  2. 执行: pm2 logs lark-bot --lines 100
  3. 在日志中找到今天推送记录，找到类似:
     <xml><Encrypt><![CDATA[abcdef...]]></Encrypt>...
  4. 复制 [[CDATA[ 和 ]]] 之间的部分（就是长长的一串字符）
  5. 粘贴到本文件的 ACTUAL_ENCRYPT_CONTENT 变量中

${'='.repeat(70)}
`);
}
