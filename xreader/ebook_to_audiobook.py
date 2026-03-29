#!/usr/bin/env python3
"""
电子书转有声书工具
支持 EPUB/TXT 批量转 MP3，自动分段，进度显示
"""

import asyncio
import argparse
import sys
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List
import json

import edge_tts

# 可选依赖
try:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup
    EBOOKLIB_AVAILABLE = True
except ImportError:
    EBOOKLIB_AVAILABLE = False

try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False


@dataclass
class ConversionConfig:
    """转换配置"""
    voice: str = "zh-CN-XiaoxiaoNeural"
    chunk_size: int = 3000
    max_concurrent: int = 3
    rate: str = "+0%"
    volume: str = "+0%"
    output_format: str = "mp3"


class ProgressTracker:
    """进度跟踪器"""

    def __init__(self, total: int, desc: str = "Processing"):
        self.total = total
        self.current = 0
        self.desc = desc
        self.pbar = None

        if TQDM_AVAILABLE and total > 1:
            self.pbar = tqdm(total=total, desc=desc, unit="chunk")

    def update(self, n: int = 1):
        self.current += n
        if self.pbar:
            self.pbar.update(n)
        else:
            percent = (self.current / self.total) * 100
            print(f"\r{self.desc}: {self.current}/{self.total} ({percent:.1f}%)", end="", flush=True)

    def close(self):
        if self.pbar:
            self.pbar.close()
        elif self.total > 1:
            print()


class EbookParser:
    """电子书解析器"""

    SUPPORTED_FORMATS = {'.txt', '.epub'}

    @classmethod
    def parse(cls, file_path: Path) -> str:
        """解析电子书返回纯文本"""
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        suffix = file_path.suffix.lower()

        if suffix == '.txt':
            return cls._parse_txt(file_path)
        elif suffix == '.epub':
            return cls._parse_epub(file_path)
        else:
            raise ValueError(f"不支持的格式: {suffix}，支持 {cls.SUPPORTED_FORMATS}")

    @staticmethod
    def _parse_txt(file_path: Path) -> str:
        """解析 TXT 文件"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16', 'latin-1']

        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    text = f.read()
                text = re.sub(r'\n{3,}', '\n\n', text)
                return text.strip()
            except (UnicodeDecodeError, UnicodeError):
                continue

        raise ValueError(f"无法识别文件编码: {file_path}")

    @staticmethod
    def _parse_epub(file_path: Path) -> str:
        """解析 EPUB 文件"""
        if not EBOOKLIB_AVAILABLE:
            raise ImportError(
                "解析 EPUB 需要安装 ebooklib 和 beautifulsoup4\n"
                "请运行: pip install ebooklib beautifulsoup4 lxml"
            )

        try:
            book = epub.read_epub(str(file_path))
        except Exception as e:
            raise ValueError(f"无法解析 EPUB 文件: {e}")

        texts = []

        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                try:
                    content = item.get_content().decode('utf-8')
                    soup = BeautifulSoup(content, 'lxml')

                    for element in soup(['script', 'style', 'nav', 'header', 'footer']):
                        element.decompose()

                    text = soup.get_text()
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = ' '.join(chunk for chunk in chunks if chunk)

                    if text and len(text) > 50:
                        texts.append(text)

                except Exception:
                    continue

        if not texts:
            raise ValueError("无法从 EPUB 中提取有效文本")

        full_text = '\n\n'.join(texts)
        full_text = re.sub(r'\n{3,}', '\n\n', full_text)
        return full_text.strip()


class TextChunker:
    """文本分块器"""

    def __init__(self, chunk_size: int = 3000):
        self.chunk_size = chunk_size

    def chunk(self, text: str) -> List[str]:
        """将文本分割成适当大小的块"""
        paragraphs = text.split('\n')
        chunks = []
        current_chunk = []
        current_length = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_length = len(para)

            if para_length > self.chunk_size:
                if current_chunk:
                    chunks.append('\n'.join(current_chunk))
                    current_chunk = []
                    current_length = 0

                sentences = re.split(r'([。！？.!?]+)', para)
                temp_chunk = ""
                for i in range(0, len(sentences), 2):
                    sentence = sentences[i]
                    if i + 1 < len(sentences):
                        sentence += sentences[i + 1]

                    if len(temp_chunk) + len(sentence) < self.chunk_size:
                        temp_chunk += sentence
                    else:
                        if temp_chunk:
                            chunks.append(temp_chunk)
                        temp_chunk = sentence

                if temp_chunk:
                    chunks.append(temp_chunk)

            elif current_length + para_length < self.chunk_size:
                current_chunk.append(para)
                current_length += para_length + 1
            else:
                chunks.append('\n'.join(current_chunk))
                current_chunk = [para]
                current_length = para_length

        if current_chunk:
            chunks.append('\n'.join(current_chunk))

        return chunks


class AudiobookConverter:
    """有声书转换器"""

    VOICE_OPTIONS = {
        'xiaoxiao': 'zh-CN-XiaoxiaoNeural',
        'xiaoyi': 'zh-CN-XiaoyiNeural',
        'yunxi': 'zh-CN-YunxiNeural',
        'yunyang': 'zh-CN-YunyangNeural',
        'yunjian': 'zh-CN-YunjianNeural',
        'hsiaochen': 'zh-TW-HsiaoChenNeural',
        'hiujyu': 'zh-HK-HiuMaanNeural',
        'jenny': 'en-US-JennyNeural',
        'guy': 'en-US-GuyNeural',
    }

    def __init__(self, config: ConversionConfig):
        self.config = config
        self.chunker = TextChunker(config.chunk_size)
        self.semaphore = asyncio.Semaphore(config.max_concurrent)

    def list_voices(self):
        """列出所有可用语音"""
        print("\n可用语音选项:")
        print("-" * 50)
        for key, voice in self.VOICE_OPTIONS.items():
            print(f"  {key:12} -> {voice}")
        print("-" * 50)
        print("使用: -v xiaoxiao (默认女声)\n")

    def resolve_voice(self, voice_key: str) -> str:
        """解析语音名称"""
        if voice_key in self.VOICE_OPTIONS:
            return self.VOICE_OPTIONS[voice_key]
        return voice_key

    async def convert_chunk(self, chunk: str, output_path: Path, retries: int = 3):
        """转换单个文本块"""
        async with self.semaphore:
            for attempt in range(retries):
                try:
                    communicate = edge_tts.Communicate(
                        chunk,
                        self.config.voice,
                        rate=self.config.rate,
                        volume=self.config.volume
                    )
                    await communicate.save(str(output_path))
                    return True
                except Exception as e:
                    if attempt == retries - 1:
                        print(f"\n错误: 转换失败 - {e}")
                        return False
                    await asyncio.sleep(1 * (attempt + 1))
            return False

    async def convert_file(self, input_path: Path, output_dir: Path) -> bool:
        """转换单个文件"""
        print(f"\n{'='*60}")
        print(f"处理: {input_path.name}")
        print(f"{'='*60}")

        try:
            print("正在解析电子书...")
            text = EbookParser.parse(input_path)
            total_chars = len(text)
            print(f"文本长度: {total_chars:,} 字符")

            if total_chars < 100:
                print("错误: 文本太短，跳过")
                return False
        except Exception as e:
            print(f"解析失败: {e}")
            return False

        print("正在分段...")
        chunks = self.chunker.chunk(text)
        print(f"分成 {len(chunks)} 段")

        output_name = input_path.stem
        output_subdir = output_dir / output_name
        output_subdir.mkdir(parents=True, exist_ok=True)

        manifest = {
            "source": str(input_path),
            "total_chars": total_chars,
            "chunks": len(chunks),
            "voice": self.config.voice,
            "files": []
        }

        print(f"\n开始转换 (并发: {self.config.max_concurrent})...")
        tracker = ProgressTracker(len(chunks), "转换进度")

        tasks = []
        chunk_files = []

        for i, chunk in enumerate(chunks):
            chunk_file = output_subdir / f"{output_name}_{i+1:03d}.{self.config.output_format}"
            chunk_files.append(chunk_file)
            task = self._convert_with_tracking(chunk, chunk_file, tracker)
            tasks.append(task)

        results = await asyncio.gather(*tasks)
        tracker.close()

        success_count = sum(results)
        failed_count = len(results) - success_count

        print(f"\n完成: {success_count}/{len(chunks)} 成功")
        if failed_count > 0:
            print(f"失败: {failed_count}")

        manifest["files"] = [str(f.name) for f in chunk_files if f.exists()]
        playlist_path = output_subdir / "playlist.m3u"
        with open(playlist_path, 'w', encoding='utf-8') as f:
            f.write("#EXTM3U\n")
            for mf in manifest["files"]:
                f.write(f"{mf}\n")

        with open(output_subdir / "manifest.json", 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        print(f"\n输出目录: {output_subdir}")
        print(f"播放列表: {playlist_path}")

        return success_count > 0

    async def _convert_with_tracking(self, chunk: str, output_path: Path, tracker: ProgressTracker) -> bool:
        """带进度跟踪的转换"""
        result = await self.convert_chunk(chunk, output_path)
        tracker.update(1)
        return result


async def async_main():
    """异步主函数"""
    parser = argparse.ArgumentParser(
        description="电子书转有声书工具 - 支持 EPUB/TXT 批量转 MP3",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python ebook_to_audiobook.py book.epub
  python ebook_to_audiobook.py ./books/ -o ./audiobooks/
  python ebook_to_audiobook.py book.txt -v yunxi -r "+20%"
        """
    )

    parser.add_argument("input", help="输入文件或目录")
    parser.add_argument("-o", "--output", default="./audiobooks",
                        help="输出目录 (默认: ./audiobooks)")
    parser.add_argument("-v", "--voice", default="xiaoxiao",
                        help="语音选择 (默认: xiaoxiao)")
    parser.add_argument("-c", "--chunk-size", type=int, default=3000,
                        help="每段最大字符数 (默认: 3000)")
    parser.add_argument("-j", "--jobs", type=int, default=3,
                        help="并发数 (默认: 3)")
    parser.add_argument("-r", "--rate", default="+0%",
                        help="语速调整 (默认: +0%%)")
    parser.add_argument("--list-voices", action="store_true",
                        help="列出所有可用语音")

    args = parser.parse_args()

    converter = AudiobookConverter(ConversionConfig())

    if args.list_voices:
        converter.list_voices()
        return 0

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误: 找不到 {args.input}")
        return 1

    config = ConversionConfig(
        voice=converter.resolve_voice(args.voice),
        chunk_size=args.chunk_size,
        max_concurrent=args.jobs,
        rate=args.rate
    )
    converter = AudiobookConverter(config)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    files_to_process = []
    if input_path.is_file():
        files_to_process.append(input_path)
    else:
        for ext in ['.txt', '.epub']:
            files_to_process.extend(input_path.rglob(f'*{ext}'))

    if not files_to_process:
        print(f"在 {input_path} 中没有找到 .txt 或 .epub 文件")
        return 1

    print(f"\n找到 {len(files_to_process)} 个文件待处理")
    print(f"输出目录: {output_dir}")
    print(f"语音: {args.voice} ({config.voice})")
    print(f"分段大小: {config.chunk_size} 字符")
    print(f"并发数: {config.max_concurrent}")
    print("=" * 60)

    success_count = 0
    failed_files = []

    for i, file_path in enumerate(files_to_process, 1):
        print(f"\n[{i}/{len(files_to_process)}] 正在处理...")
        try:
            result = await converter.convert_file(file_path, output_dir)
            if result:
                success_count += 1
            else:
                failed_files.append(str(file_path))
        except KeyboardInterrupt:
            print("\n用户中断")
            break
        except Exception as e:
            print(f"错误: {e}")
            failed_files.append(str(file_path))

    print("\n" + "=" * 60)
    print("转换完成!")
    print(f"成功: {success_count}/{len(files_to_process)}")
    if failed_files:
        print(f"失败: {len(failed_files)}")
        for f in failed_files:
            print(f"  - {f}")

    return 0 if len(failed_files) == 0 else 1


def main():
    """同步入口"""
    try:
        return asyncio.run(async_main())
    except KeyboardInterrupt:
        print("\n已取消")
        return 130


if __name__ == "__main__":
    sys.exit(main())
