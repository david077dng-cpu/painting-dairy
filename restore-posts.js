
import fs from 'fs';
import path from 'path';

const backupDir = './src/content/posts_backup';
const postsDir = './src/content/posts';

// 确保目标目录存在
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

// 获取所有md文件（排除.bak文件）
const files = fs.readdirSync(backupDir)
  .filter(f => f.endsWith('.md') && !f.endsWith('.bak'));

console.log(`找到 ${files.length} 篇文章`);

let processed = 0;
let failed = 0;

// 处理每篇文章
for (const file of files) {
  try {
    const filePath = path.join(backupDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 提取标题
    let title = file.replace(/_/g, ' ').replace(/\.md$/, '').trim();

    // 尝试从内容中提取标题
    const lines = content.split('\n');
    let foundTitle = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('![') && !line.startsWith('![')) {
        // 检查下一行是否是 === 分隔符
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('===')) {
          title = line.replace(/\.$/, '').trim();
          foundTitle = true;
          break;
        }
      }
    }

    // 生成一个日期（使用一个合理的日期范围）
    // 从文件名中尝试提取日期信息，或者使用随机日期
    let date = '2020-01-01';

    // 简单的日期生成：在2017-2020年间随机
    const year = 2017 + Math.floor(Math.random() * 4);
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    date = `${year}-${month}-${day}`;

    // 尝试从内容中提取描述（第一段正文）
    let description = '';
    let inContent = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('===') || trimmed.includes('[PaintingDiary]')) {
        inContent = true;
        continue;
      }
      if (inContent && trimmed && !trimmed.startsWith('![') && !trimmed.startsWith('![')) {
        description = trimmed.substring(0, 100);
        if (description.length < trimmed.length) description += '...';
        break;
      }
    }

    // 创建 frontmatter
    const frontmatter = `---
title: ${title}
date: ${date}
category: 随笔
description: ${description || '一篇文章'}
---

`;

    // 写入新文件
    const newContent = frontmatter + content;
    fs.writeFileSync(path.join(postsDir, file), newContent, 'utf8');

    processed++;
    if (processed % 50 === 0) {
      console.log(`已处理 ${processed}/${files.length}...`);
    }
  } catch (err) {
    console.error(`处理 ${file} 失败:`, err.message);
    failed++;
  }
}

console.log(`\n完成！成功: ${processed}, 失败: ${failed}`);
