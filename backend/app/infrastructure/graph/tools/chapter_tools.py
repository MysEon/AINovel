"""Chapter tools for the chat assistant graph."""

from __future__ import annotations

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy import select

from app.application.ai_context_builder import _truncate
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext, ChatAssistantState


@tool
async def get_chapter_summary(
    chapter_number: int,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Get a chapter content summary by chapter number. Use when previous chapter details are needed."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Chapter)
            .where(Chapter.project_id == ctx.project_id)
            .where(Chapter.chapter_number == chapter_number)
            .limit(1)
        )
        chapter = result.scalar_one_or_none()
    if chapter is None:
        return f"未找到章节：第{chapter_number}章"
    content = _truncate(chapter.content, 500)
    title = chapter.title or f"第{chapter_number}章"
    return f"第{chapter.chapter_number}章《{title}》：{content}"
