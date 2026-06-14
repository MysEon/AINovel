"""Shared type definitions for the chat assistant workflow and tools."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import NotRequired

from langchain.agents.middleware import AgentState
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class ChatAssistantContext:
    project_id: int
    session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]]
    injected_system_prompt: str | None = None
    # 已经按当前降级 stage 渲染好的分层章节文本段（L1/L2/L3）。
    # 由 LegacyAIService 在调用 graph 前组装并按降级链替换重试。
    chapter_context_segment: str | None = None


class ChatAssistantState(AgentState):
    project_context: NotRequired[str]
