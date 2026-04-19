const { WechatSync } = require('./src/services/wechatSync');

const sync = new WechatSync();

async function main() {
  console.log('开始同步待导入文章...');
  try {
    const result = await sync.sync();
    console.log('同步结果:', result);
  } catch (err) {
    console.error('同步失败:', err);
  }
  
  console.log('\n同步完成');
}

main().catch(console.error);
