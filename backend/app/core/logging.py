"""
结构化日志模块
- dev 环境: 可读文本格式
- prod 环境: JSON 格式（便于日志采集）
- 支持 request_id / run_id 自动关联
- 敏感字段自动脱敏
"""

import logging
import re
import sys
import json
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

# ── 请求级上下文变量（中间件写入，Filter 自动读取） ──
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
run_id_var: ContextVar[Optional[int]] = ContextVar("run_id", default=None)

# ── 脱敏 ─────────────────────────────────────────────
_SENSITIVE_RE = re.compile(
    r"(api[_-]?key|secret|password|authorization|token|credential)",
    re.IGNORECASE,
)
_BEARER_RE = re.compile(r"(Bearer\s+)\S+", re.IGNORECASE)


def sanitize_value(key: str, value) -> str:
    """对敏感字段值做掩码"""
    if _SENSITIVE_RE.search(key):
        s = str(value)
        return s[:4] + "***" + s[-4:] if len(s) > 8 else "***"
    return value


def sanitize_header(value: str) -> str:
    """对 Authorization header 做掩码"""
    return _BEARER_RE.sub(r"\1***", value)


class ContextFilter(logging.Filter):
    """自动将 ContextVar 注入每条 LogRecord"""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("")  # type: ignore[attr-defined]
        record.run_id = run_id_var.get(None)  # type: ignore[attr-defined]
        return True


class JSONFormatter(logging.Formatter):
    """JSON 格式日志（生产环境用）"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        rid = getattr(record, "request_id", "")
        if rid:
            log_entry["request_id"] = rid
        run_id = getattr(record, "run_id", None)
        if run_id is not None:
            log_entry["run_id"] = run_id
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)


DEV_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | rid=%(request_id)s | %(message)s"


def setup_logging(env: str = "dev", level: Optional[str] = None) -> None:
    """初始化全局日志配置，应在应用启动时调用一次"""
    log_level = getattr(logging, (level or "DEBUG" if env == "dev" else "INFO").upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(log_level)

    # 清除已有 handler / filter，避免重复
    root.handlers.clear()
    root.filters.clear()

    # 全局 Filter：自动注入 request_id / run_id
    root.addFilter(ContextFilter())

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
