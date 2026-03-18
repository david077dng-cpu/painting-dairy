
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const postsDir = './src/content/posts';
const imagesDir = './public/images';

// 确保图片目录存在
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// 获取所有md文件
const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'));

console.log(`找到 ${files.length} 篇文章`);

// 用于跟踪已下载的图片，避免重复下载
const downloadedImages = new Map();
let imageCounter = 0;

// 下载图片函数
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// 处理单篇文章
async function processArticle(file) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 匹配所有图片链接: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const alt = match[1];
    const url = match[2];

    // 只处理微信图片
    if (url.includes('mmbiz.qpic.cn') || url.includes('mmbiz.qlogo.cn') || url.includes('res.wx.qq.com')) {
      // 检查是否已经下载过这个URL
      let localPath = downloadedImages.get(url);

      if (!localPath) {
        // 生成新的文件名
        let ext;
        if (url.includes('wx_fmt=gif')) {
          ext = '.gif';
        } else if (url.includes('wx_fmt=png') || url.endsWith('.png')) {
          ext = '.png';
        } else {
          ext = '.jpg';
        }
        imageCounter++;
        const filename = `image-${imageCounter}${ext}`;
        localPath = `/images/${filename}`;
        const localFilepath = path.join(imagesDir, filename);

        try {
          console.log(`下载: ${url.substring(0, 60)}... -> ${filename}`);
          await downloadImage(url, localFilepath);
          downloadedImages.set(url, localPath);
        } catch (err) {
          console.error(`下载失败 ${url.substring(0, 50)}...:`, err.message);
          continue;
        }
      }

      // 替换为本地路径
      const newImageTag = `![${alt}](${localPath})`;
      content = content.replace(fullMatch, newImageTag);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// 主函数
async function main() {
  let updatedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n处理文章 ${i + 1}/${files.length}: ${file}`);

    try {
      const updated = await processArticle(file);
      if (updated) {
        updatedCount++;
      }
    } catch (err) {
      console.error(`处理文章失败 ${file}:`, err.message);
    }

    // 每5篇文章稍作延迟，避免请求过快
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n\n完成！`);
  console.log(`- 处理文章: ${files.length}`);
  console.log(`- 更新文章: ${updatedCount}`);
  console.log(`- 下载图片: ${imageCounter}`);
}

main().catch(console.error);
