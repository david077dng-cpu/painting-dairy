
import fs from 'fs';
import path from 'path';

const postsDir = './src/content/posts';

// 获取所有md文件
const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'));

console.log(`检查 ${files.length} 篇文章...`);

let fixed = 0;

// 处理每篇文章
for (const file of files) {
  try {
    const filePath = path.join(postsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 检查 frontmatter 中的 title 是否需要引号
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);

      if (titleMatch) {
        const titleValue = titleMatch[1];
        // 如果标题看起来像数字（纯数字或以数字开头且没有引号）
        if (/^\d+$/.test(titleValue) && !titleValue.startsWith('"') && !titleValue.startsWith("'")) {
          // 用引号包裹标题
          const newFrontmatter = frontmatter.replace(
            /^title:\s*.+$/m,
            `title: "${titleValue}"`
          );
          content = content.replace(frontmatterMatch[0], `---\n${newFrontmatter}\n---`);
          fs.writeFileSync(filePath, content, 'utf8');
          fixed++;
          console.log(`修复: ${file} - title: "${titleValue}"`);
        }
      }
    }
  } catch (err) {
    console.error(`处理 ${file} 失败:`, err.message);
  }
}

console.log(`\n完成！修复了 ${fixed} 篇文章`);
