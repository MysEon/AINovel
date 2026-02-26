"""
结构化日志模块
- dev 环境: 可读文本格式
- prod 环境: JSON 格式（便于日志采集）
- 支持 request_id 关联
"""

import logging
import sys
import json
from datetime import datetime, timezone
from typing import Optional


class JSONFormatter(logging.Formatter):
    """JSON 格式日志（生产环境用）"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)


DEV_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(env: str = "dev", level: Optional[str] = None) -> None:
    """初始化全局日志配置，应在应用启动时调用一次"""
    log_level = getattr(logging, (level or "DEBUG" if env == "dev" else "INFO").upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(log_level)

    # 清除已有 handler，避免重复
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if env == "prod":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(DEV_FORMAT))

    root.addHandler(handler)

    # 降低第三方库日志噪音
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """获取命名 logger 的快捷方式"""
    return logging.getLogger(name)
