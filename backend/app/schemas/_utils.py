"""Schema 工具函数"""

from datetime import datetime


def serialize_datetime(value: datetime | None) -> str | None:
    """将 datetime 序列化为带 Z 后缀的 RFC 3339 格式字符串"""
    if value is None:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")
