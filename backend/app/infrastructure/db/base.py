"""
ORM 模型基类与通用 Mixin
所有模型统一从此处导入 Base
"""

from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """声明式基类（SQLAlchemy 2.x 风格）"""
    pass


class TimestampMixin:
    """通用时间戳字段"""
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
