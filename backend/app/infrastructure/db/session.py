"""
数据库会话管理
统一 engine / sessionmaker / 依赖注入
禁止在此模块执行 create_all()
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import create_engine

from app.core.config import get_settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def create_async_db_engine(settings=None):
    """创建异步数据库引擎"""
    settings = settings or get_settings()
    connect_args = {}
    if _is_sqlite(settings.db.url):
        connect_args["check_same_thread"] = False

    return create_async_engine(
        settings.db.url,
        echo=settings.db.echo,
        pool_pre_ping=settings.db.pool_pre_ping,
        pool_recycle=settings.db.pool_recycle,
        connect_args=connect_args,
    )


def create_sync_db_engine(settings=None):
    """创建同步引擎（Alembic 迁移用）"""
    settings = settings or get_settings()
    return create_engine(
        settings.db.sync_url,
        echo=settings.db.echo,
    )


# ── 模块级单例（延迟初始化） ─────────────────────────────────

_async_engine = None
_async_session_factory = None


def get_async_engine():
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_db_engine()
    return _async_engine


def get_session_factory():
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session_factory


# ── FastAPI 依赖注入 ─────────────────────────────────────────

async def get_db():
    """FastAPI Depends 用：每请求一个 session，自动关闭"""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def dispose_engine():
    """应用关闭时释放连接池"""
    global _async_engine, _async_session_factory
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
        _async_session_factory = None
