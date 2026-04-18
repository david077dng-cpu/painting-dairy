/**
 * Mock 微信公众号推送 - 测试完整流程（含邮件发送）
 *
 * 运行: node mock-wechat-push.js
 */

require('dotenv').config();
const { WechatPushHandler } = require('./src/services/wechatPush');

// Mock 一条测试图文推送的 XML（解密后）
// 实际场景中，这个 XML 是解密后得到的
const MOCK_DECRYPTED_XML = `
<xml>
<ToUserName><![CDATA[gh_24e3f5ee7ee5]]></ToUserName>
<FromUserName><![CDATA[PaintingDiary]]></FromUserName>
<CreateTime>1713246000</CreateTime>
<MsgType><![CDATA[mpnews]]></MsgType>
<ArticleCount>1</ArticleCount>
<Articles>
<item>
<Title><![CDATA[测试文章 - 这是一篇来自微信公众号的新文章]]></Title>
<Description><![CDATA[]]></Description>
<Url><![CDATA[https://mp.weixin.qq.com/s/abcdefghijklmnopqrstuvwxyz123456]]></Url>
<PicUrl><![CDATA[https://example.com/image.jpg]]></PicUrl>
</item>
</Articles>
</xml>
`;

console.log('='.repeat(70));
console.log('🧪 Mock 微信公众号推送测试（完整流程）');
console.log('='.repeat(70));

// 检查配置
console.log('\n📋 [配置检查]');
console.log(`WECHAT_TOKEN: ${process.env.WECHAT_TOKEN ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`WECHAT_ENCODING_AES_KEY: ${process.env.WECHAT_ENCODING_AES_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`WECHAT_APPID: ${process.env.WECHAT_APPID ? `✅ 已配置 (${process.env.WECHAT_APPID})` : '❌ 未配置'}`);
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
console.log(`emailEnabled: ${handler.emailEnabled}`);
console.log(`transporter: ${handler.transporter ? '✅ 已创建' : '❌ 未创建'}`);

// 测试邮件发送（即使没有实际导入新文章，也可以测试邮件发送功能）
if (handler.emailEnabled && handler.transporter && handler.emailTo) {
  console.log('\n' + '='.repeat(70));
  console.log('📧 测试邮件发送...');
  console.log('='.repeat(70));

  try {
    const result = await handler.transporter.sendMail({
      to: handler.emailTo,
      subject: '🧪 微信公众号自动推送测试',
      text: `这是一封测试邮件，来自 lark-bot 的 mock 推送测试。

如果您收到这封邮件，说明：
✅ SMTP 配置正确
✅ 授权密码有效
✅ 邮件发送功能正常

当公众号真的推送新文章时，就会收到通知了！

测试时间: ${new Date().toLocaleString()}
`,
    });

    console.log('\n✅ 测试邮件发送成功！');
    console.log('────────────────────────────────────────');
    console.log(`收件人: ${handler.emailTo}`);
    console.log(`消息ID: ${result.messageId}`);
    console.log('────────────────────────────────────────');
    console.log('请检查你的邮箱 xlilian@126.com，应该已经收到这封测试邮件了');
  } catch (err) {
    console.log('\n❌ 测试邮件发送失败！');
    console.error('错误信息:', err.message);
    console.log('\n请检查:');
    console.log('1. SMTP 服务器地址: ' + process.env.EMAIL_SMTP_HOST);
    console.log('2. 用户名: ' + process.env.EMAIL_SMTP_USER);
    console.log('3. 授权密码是否正确');
    console.log('4. 126 邮箱是否开启了 SMTP');
  }
} else {
  console.log('\n⚠️  邮件通知未启用或配置不完整，跳过测试');
}

console.log('\n' + '='.repeat(70));
console.log('测试完成');
console.log('='.repeat(70));
