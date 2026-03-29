#!/usr/bin/env python3
"""本地测试 - 测试解析和分段功能"""

import sys
sys.path.insert(0, '.')

from ebook_to_audiobook import EbookParser, TextChunker, ConversionConfig
from pathlib import Path

# 测试文本解析
print("=" * 60)
print("测试1: 文本解析")
print("=" * 60)

test_file = Path("test_wikipedia.txt")
if test_file.exists():
    text = EbookParser.parse(test_file)
    print(f"✓ 成功解析文件")
    print(f"  总字符数: {len(text):,}")
    print(f"  总行数: {text.count(chr(10)):,}")
    print(f"  预览 (前200字符):")
    print(f"  {text[:200]}...")
else:
    print(f"✗ 测试文件不存在: {test_file}")
    sys.exit(1)

# 测试文本分块
print()
print("=" * 60)
print("测试2: 文本分块")
print("=" * 60)

chunk_sizes = [1000, 2000, 3000, 5000]
for size in chunk_sizes:
    chunker = TextChunker(chunk_size=size)
    chunks = chunker.chunk(text)
    avg_chunk_size = sum(len(c) for c in chunks) / len(chunks) if chunks else 0
    print(f"✓ 块大小 {size:>4}: {len(chunks):>3} 块, 平均 {avg_chunk_size:>6.0f} 字符/块")

# 显示一个示例块
print()
print("示例块内容 (第1块, size=3000):")
chunker = TextChunker(chunk_size=3000)
chunks = chunker.chunk(text)
if chunks:
    print("-" * 60)
    print(chunks[0][:500] + "..." if len(chunks[0]) > 500 else chunks[0])
    print("-" * 60)
    print(f"块长度: {len(chunks[0])} 字符")

print()
print("=" * 60)
print("本地测试完成!")
print("=" * 60)
print()
print("要运行完整的 TTS 转换，请使用:")
print("  python ebook_to_audiobook.py test_wikipedia.txt -o ./output")
