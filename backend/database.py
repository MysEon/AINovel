"""
数据库连接和配置模块
负责SQLite数据库的连接、会话管理和初始化
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models import Base

# 数据库配置
DATABASE_URL = "sqlite+aiosqlite:///./ainovel.db"
SYNC_DATABASE_URL = "sqlite:///./ainovel.db"

# 创建异步引擎
async_engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # 开发环境下显示SQL语句
    future=True
)

# 创建同步引擎（用于数据库初始化）
sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=True,
    future=True
)

# 创建异步会话
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    """
    获取数据库会话的依赖注入函数
    用于FastAPI的Depends
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def create_tables():
    """
    创建所有数据表
    仅在首次运行时调用
    """
    Base.metadata.create_all(bind=sync_engine)
    print("数据库表创建完成")

def drop_tables():
    """
    删除所有数据表
    谨慎使用！
    """
    Base.metadata.drop_all(bind=sync_engine)
    print("数据库表已删除")

async def init_database():
    """
    初始化数据库
    创建表结构
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("异步数据库初始化完成")

if __name__ == "__main__":
    # 直接运行此文件时创建数据表
    create_tables()