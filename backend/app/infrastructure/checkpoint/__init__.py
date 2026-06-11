"""
Checkpointer 工厂 — 提供持久化 checkpointer 实例

设计模式：Factory + Singleton
- 当前实现：AsyncSqliteSaver（SQLite 异步）
- 后续可替换为 AsyncPostgresSaver（PostgreSQL 异步）
"""

import logging
from typing import Optional

from langgraph.checkpoint.base import BaseCheckpointSaver

logger = logging.getLogger(__name__)

# 单例缓存
_sqlite_checkpointer: Optional[BaseCheckpointSaver] = None


async def get_sqlite_checkpointer(db_path: str = "ainovel_checkpoints.db") -> BaseCheckpointSaver:
    """
    获取 AsyncSqliteSaver 单例实例。

    Args:
        db_path: SQLite 数据库文件路径，默认当前目录下 ainovel_checkpoints.db

    Returns:
        AsyncSqliteSaver 实例（已初始化）
    """
    global _sqlite_checkpointer
    if _sqlite_checkpointer is None:
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        import aiosqlite

        conn = await aiosqlite.connect(db_path)
        _sqlite_checkpointer = AsyncSqliteSaver(conn)
        logger.info("AsyncSqliteSaver initialized at %s", db_path)
    return _sqlite_checkpointer


def reset_sqlite_checkpointer() -> None:
    """重置单例缓存（主要用于测试）"""
    global _sqlite_checkpointer
    _sqlite_checkpointer = None
