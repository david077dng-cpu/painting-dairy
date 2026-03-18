
import fs from 'fs';
import path from 'path';

const postsDir = './src/content/posts';
const basePath = '/painting-dairy';

// 获取所有md文件
const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'));

console.log(`找到 ${files.length} 篇文章`);

// 处理单篇文章
function processArticle(file) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 匹配所有图片链接: ![alt](/images/xxx.jpg)
  // 但不要处理已经有 basePath 的
  const imageRegex = /!\[([^\]]*)\]\((\/images\/[^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const alt = match[1];
    const imagePath = match[2];

    // 检查是否已经有 basePath 了
    if (!imagePath.startsWith(basePath + '/')) {
      const newPath = basePath + imagePath;
      const newImageTag = `![${alt}](${newPath})`;
      content = content.replace(fullMatch, newImageTag);
      modified = true;
      console.log(`更新: ${imagePath} -> ${newPath}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// 主函数
function main() {
  let updatedCount = 0;

  for (const file of files) {
    const updated = processArticle(file);
    if (updated) {
      updatedCount++;
    }
  }

  console.log(`\n\n完成！`);
  console.log(`- 处理文章: ${files.length}`);
  console.log(`- 更新文章: ${updatedCount}`);
}

main();
