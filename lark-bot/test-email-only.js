/**
 * 单独测试邮件发送功能
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('='.repeat(70));
console.log('📧 测试邮件发送');
console.log('='.repeat(70));

console.log('\n📋 [配置检查]');
console.log(`EMAIL_SMTP_HOST: ${process.env.EMAIL_SMTP_HOST}`);
console.log(`EMAIL_SMTP_PORT: ${process.env.EMAIL_SMTP_PORT || 587}`);
console.log(`EMAIL_SMTP_SECURE: ${process.env.EMAIL_SMTP_SECURE}`);
console.log(`EMAIL_SMTP_USER: ${process.env.EMAIL_SMTP_USER}`);
console.log(`EMAIL_SMTP_PASS: ${process.env.EMAIL_SMTP_PASS ? '***' : '未配置'}`);
console.log(`EMAIL_NOTIFICATION_TO: ${process.env.EMAIL_NOTIFICATION_TO}`);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
  secure: process.env.EMAIL_SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASS,
  },
});

console.log('\n🚀 正在连接 SMTP 服务器并发送测试邮件...');

transporter.sendMail({
  from: process.env.EMAIL_SMTP_USER,
  to: process.env.EMAIL_NOTIFICATION_TO,
  subject: '🧪 测试邮件 - 微信公众号自动推送',
  text: `这是一封测试邮件，来自 painting-dairy lark-bot。

如果你收到这封邮件，说明：
✅ SMTP 配置正确
✅ 授权密码有效
✅ VPS 网络可以连接 126.com 服务器
✅ 新文章推送后会正常发送通知邮件

测试时间: ${new Date().toLocaleString()}

- painting-dairy 自动推送系统
`,
}, (err, info) => {
  if (err) {
    console.log('\n❌ 发送失败:');
    console.error(err);
    process.exit(1);
  } else {
    console.log('\n✅ 发送成功!');
    console.log('MessageID:', info.messageId);
    console.log('响应:', info.response);
    console.log(`\n请检查 ${process.env.EMAIL_NOTIFICATION_TO} 邮箱，应该已经收到了！`);
  }
});
