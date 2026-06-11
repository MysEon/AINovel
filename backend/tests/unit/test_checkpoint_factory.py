"""Checkpointer 工厂单元测试"""

import pytest
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.infrastructure.checkpoint import get_sqlite_checkpointer, reset_sqlite_checkpointer


class TestCheckpointFactory:
    async def test_returns_same_singleton(self):
        """get_sqlite_checkpointer() 返回同一单例"""
        reset_sqlite_checkpointer()
        cp1 = await get_sqlite_checkpointer(":memory:")
        cp2 = await get_sqlite_checkpointer(":memory:")
        assert cp1 is cp2
        reset_sqlite_checkpointer()

    async def test_returns_basecheckpointsaver_subclass(self):
        """返回类型是 BaseCheckpointSaver 子类"""
        reset_sqlite_checkpointer()
        cp = await get_sqlite_checkpointer(":memory:")
        assert isinstance(cp, BaseCheckpointSaver)
        reset_sqlite_checkpointer()
