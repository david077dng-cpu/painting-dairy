#!/usr/bin/env python3
"""MOBI 文件转 TXT 工具"""
import sys
from pathlib import Path

def mobi_to_txt(mobi_path, output_path=None):
    try:
        from mobi import Mobi
    except ImportError:
        print("错误: 需要安装 mobi 库")
        print("运行: pip install mobi")
        return False

    mobi_path = Path(mobi_path)
    if not mobi_path.exists():
        print(f"错误: 文件不存在 {mobi_path}")
        return False

    if output_path is None:
        output_path = mobi_path.with_suffix('.txt')

    try:
        print(f"正在读取 {mobi_path.name}...")
        book = Mobi(mobi_path)
        book.parse()

        print(f"正在提取文本...")
        text = ""

        # 获取所有记录
        for record in book:
            content = record.decode('utf-8', errors='ignore')
            # 移除 HTML 标签
            import re
            content = re.sub(r'<[^>]+>', '', content)
            content = re.sub(r'&[a-zA-Z]+;', ' ', content)
            content = re.sub(r'\s+', ' ', content)
            if len(content.strip()) > 10:
                text += content.strip() + "\n\n"

        # 清理文本
        text = re.sub(r'\n{3,}', '\n\n', text)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)

        print(f"✓ 转换完成: {output_path}")
        print(f"  文本长度: {len(text):,} 字符")
        return True

    except Exception as e:
        print(f"错误: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python convert_mobi.py <mobi文件> [输出txt文件]")
        sys.exit(1)

    mobi_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    success = mobi_to_txt(mobi_file, output_file)
    sys.exit(0 if success else 1)
