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


class ChatAssistantState(AgentState):
    project_context: NotRequired[str]
