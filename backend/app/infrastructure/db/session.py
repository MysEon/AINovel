"""
数据库会话管理
统一 engine / sessionmaker / 依赖注入
禁止在此模块执行 create_all()
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def _enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
    """SQLite 默认关闭外键约束 —— 在每个底层连接上开启。

    历史上本项目的硬外键（如 characters.organization_id）实际从未生效，
    删除实体后留下孤儿软引用即根因之一。开启后新写入受约束保护；
    SQLite 不会回溯校验既有数据，故对存量行安全。
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def create_async_db_engine(settings=None):
    """创建异步数据库引擎"""
    settings = settings or get_settings()
    connect_args = {}
    if _is_sqlite(settings.db.url):
        connect_args["check_same_thread"] = False

    engine = create_async_engine(
        settings.db.url,
        echo=settings.db.echo,
        pool_pre_ping=settings.db.pool_pre_ping,
        pool_recycle=settings.db.pool_recycle,
        connect_args=connect_args,
    )

    if _is_sqlite(settings.db.url):
        # 在底层 DBAPI 连接上启用外键约束（async engine 的 sync_engine 暴露 connect 事件）
        event.listen(engine.sync_engine, "connect", _enable_sqlite_foreign_keys)

    return engine


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
