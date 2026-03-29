#!/usr/bin/env python3
"""MOBI 文件转 TXT 工具"""

import sys
import re
import html
from pathlib import Path


def mobi_to_txt(mobi_path, output_path=None):
    """Convert MOBI file to TXT"""
    try:
        import mobi
    except ImportError:
        print("Error: need to install mobi library")
        print("Run: pip install mobi")
        return False

    mobi_path = Path(mobi_path)
    if not mobi_path.exists():
        print(f"Error: file not found {mobi_path}")
        return False

    if output_path is None:
        output_path = mobi_path.with_suffix('.txt')
    else:
        output_path = Path(output_path)

    try:
        print(f"Reading {mobi_path.name}...")

        # Use mobi.extract to extract content
        tempdir, filepath = mobi.extract(str(mobi_path))

        print(f"Extracted to: {filepath}")

        # Read extracted HTML file
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            html_content = f.read()

        # Convert to plain text
        text = html_to_text(html_content)

        # Clean up
        text = clean_text(text)

        # Save
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)

        # Clean up temp files
        import shutil
        shutil.rmtree(tempdir, ignore_errors=True)

        print(f"Done!")
        print(f"  Output: {output_path}")
        print(f"  Characters: {len(text):,}")
        return True

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def html_to_text(html_content):
    """Simple HTML to text conversion"""
    # Remove script and style tags with content
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Convert common block elements to newlines
    text = re.sub(r'</p>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</div>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</h[1-6]>', '\n\n', text, flags=re.IGNORECASE)

    # Remove all other HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Decode HTML entities
    text = html.unescape(text)

    return text


def clean_text(text):
    """Clean up text"""
    # Remove excessive blank lines
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    # Remove leading/trailing whitespace from lines
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join(lines).strip()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python mobi_to_txt.py <mobi_file> [output_txt_file]")
        sys.exit(1)

    mobi_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    success = mobi_to_txt(mobi_file, output_file)
    sys.exit(0 if success else 1)
