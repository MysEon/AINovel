"""
AI 上下文构建器 — 从项目数据统一组装 LLM 上下文

职责：
- 按项目 ID 聚合角色、世界观、地点、组织、章节摘要
- 为不同工作流提供不同粒度的上下文（outline/chat/revision）
- 控制上下文体积（截断策略）
"""

import logging
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview
from app.infrastructure.db.models.manuscript import Chapter

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 8000


def _truncate(text: str, max_len: int = 500) -> str:
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len] + "…"


class AIContextBuilder:
    """项目上下文构建器"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_project_context(
        self, project_id: int, *, mode: str = "full",
    ) -> dict:
        """
        构建项目上下文。

        mode:
          - "full": 完整上下文（角色+世界观+地点+组织+章节摘要）
          - "outline": 大纲生成用（角色+世界观+前文摘要）
          - "chat": 对话用（精简版）
        """
        project = await self._get_project(project_id)
        if not project:
            return {}

        ctx = {
            "project_name": project.name,
            "project_description": _truncate(project.description, 1000),
        }

        if mode in ("full", "outline", "chat"):
            ctx["characters"] = await self._get_characters(project_id)

        if mode in ("full", "outline"):
            ctx["worldviews"] = await self._get_worldviews(project_id)
            ctx["locations"] = await self._get_locations(project_id)
            ctx["organizations"] = await self._get_organizations(project_id)

        if mode in ("full", "outline"):
            ctx["previous_chapters"] = await self._get_chapter_summaries(project_id)

        return ctx

    async def _get_project(self, project_id: int) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def _get_characters(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Character).where(Character.project_id == project_id).limit(20)
        )
        return [
            {
                "name": c.name,
                "description": _truncate(c.description, 200),
                "personality": _truncate(c.personality, 200),
                "background": _truncate(c.background, 200),
            }
            for c in result.scalars().all()
        ]

    async def _get_worldviews(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Worldview).where(Worldview.project_id == project_id).limit(10)
        )
        return [
            {
                "name": w.name,
                "description": _truncate(w.description, 300),
                "rules": _truncate(w.rules, 300),
                "magic_system": _truncate(w.magic_system, 200),
            }
            for w in result.scalars().all()
        ]

    async def _get_locations(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Location).where(Location.project_id == project_id).limit(15)
        )
        return [
            {
                "name": loc.name,
                "description": _truncate(loc.description, 200),
                "geography": _truncate(loc.geography, 150),
            }
            for loc in result.scalars().all()
        ]

    async def _get_organizations(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Organization).where(Organization.project_id == project_id).limit(10)
        )
        return [
            {
                "name": org.name,
                "description": _truncate(org.description, 200),
                "purpose": _truncate(org.purpose, 150),
            }
            for org in result.scalars().all()
        ]

    async def _get_chapter_summaries(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Chapter)
            .where(Chapter.project_id == project_id)
            .order_by(Chapter.chapter_number)
            .limit(30)
        )
        return [
            {
                "number": ch.chapter_number,
                "title": ch.title,
                "summary": _truncate(ch.content, 300) if ch.content else "",
                "word_count": ch.word_count or 0,
            }
            for ch in result.scalars().all()
        ]

    def format_as_text(self, ctx: dict) -> str:
        """将上下文 dict 格式化为纯文本（供 prompt 注入）"""
        parts = []
        if ctx.get("project_name"):
            parts.append(f"项目：{ctx['project_name']}")
        if ctx.get("project_description"):
            parts.append(f"简介：{ctx['project_description']}")

        if ctx.get("characters"):
            lines = ["【角色】"]
            for c in ctx["characters"]:
                lines.append(f"- {c['name']}：{c.get('description', '')}")
            parts.append("\n".join(lines))

        if ctx.get("worldviews"):
            lines = ["【世界观】"]
            for w in ctx["worldviews"]:
                lines.append(f"- {w['name']}：{w.get('description', '')}")
            parts.append("\n".join(lines))

        if ctx.get("locations"):
            lines = ["【地点】"]
            for loc in ctx["locations"]:
                lines.append(f"- {loc['name']}：{loc.get('description', '')}")
            parts.append("\n".join(lines))

        if ctx.get("previous_chapters"):
            lines = ["【前文摘要】"]
            for ch in ctx["previous_chapters"][-5:]:
                lines.append(f"- 第{ch['number']}章 {ch['title']}：{ch.get('summary', '')}")
            parts.append("\n".join(lines))

        text = "\n\n".join(parts)
        if len(text) > MAX_CONTEXT_CHARS:
            text = text[:MAX_CONTEXT_CHARS] + "\n…（上下文已截断）"
        return text
