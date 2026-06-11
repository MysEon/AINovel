"""字数计算 — 领域逻辑

中英文混合字数统计，供 Application Service 调用。
"""

import re


def calculate_word_count(content: str) -> int:
    """计算字数（中英文混合）"""
    if not content:
        return 0
    content = re.sub(r"\s+", " ", content.strip())
    chinese = len(re.findall(r"[一-鿿　-〿＀-￯]", content))
    english = len(re.findall(r"\b[a-zA-Z]+\b", content))
    return chinese + english
