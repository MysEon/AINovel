"""
启动时表存在性检查
仅对关键缺失表做兜底创建，不替代 Alembic 迁移
"""

import logging

from sqlalchemy import inspect

from app.infrastructure.db.models.auth import TokenBlacklist

logger = logging.getLogger(__name__)


async def ensure_token_blacklist_table(engine) -> None:
    """检查 token_blacklist 表是否存在，不存在则自动创建"""

    def _check_and_create(sync_conn):
        inspector = inspect(sync_conn)
        if not inspector.has_table("token_blacklist"):
            TokenBlacklist.__table__.create(sync_conn)
            logger.info("token_blacklist 表缺失，已自动创建")
        else:
            logger.debug("token_blacklist 表已存在")

    async with engine.begin() as conn:
        await conn.run_sync(_check_and_create)
