"""
AI 上下文构建器 — 从项目数据统一组装 LLM 上下文

职责：
- 按项目 ID 聚合角色、世界观、地点、组织、章节摘要
- 为不同工作流提供不同粒度的上下文（outline/chat/revision）
- 控制上下文体积（截断策略）
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 8000
CHAT_CONTEXT_MAX_CHARS = 4000


def _truncate(text: str, max_len: int = 500) -> str:
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len] + "…"


def count_tokens_estimate(text: str) -> int:
    """粗略估算 token 数，按中文经验值 len / 1.6。"""
    return max(1, int(len(text) // 1.6))


class AIContextBuilder:
    """项目上下文构建器"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_project_context(
        self,
        project_id: int,
        *,
        mode: str = "full",
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

    async def _get_project(self, project_id: int) -> Project | None:
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def _get_characters(self, project_id: int) -> list[dict]:
        result = await self.db.execute(
            select(Character).where(Character.project_id == project_id).order_by(Character.id)
        )
        return [
            {
                "name": c.name,
                "description": _truncate(c.description, 200),
                "personality": _truncate(c.personality, 200),
                "background": _truncate(c.background, 200),
                "appearance": _truncate(c.appearance, 200),
            }
            for c in result.scalars().all()
        ]

    async def _get_worldviews(self, project_id: int) -> list[dict]:
        result = await self.db.execute(select(Worldview).where(Worldview.project_id == project_id).limit(10))
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
        result = await self.db.execute(select(Location).where(Location.project_id == project_id).limit(15))
        return [
            {
                "name": loc.name,
                "description": _truncate(loc.description, 200),
                "geography": _truncate(loc.geography, 150),
            }
            for loc in result.scalars().all()
        ]

    async def _get_organizations(self, project_id: int) -> list[dict]:
        result = await self.db.execute(select(Organization).where(Organization.project_id == project_id).limit(10))
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
            select(Chapter).where(Chapter.project_id == project_id).order_by(Chapter.chapter_number).limit(30)
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

    async def get_referenced_entities(
        self,
        project_id: int,
        refs: list[dict],
    ) -> dict[str, list[dict]]:
        """
        按 (type, id) 子集聚合用户显式关联的实体。

        - 严格按 project_id 过滤：跨项目的引用会被静默忽略（防越权）
        - 不存在的 ID 会被静默忽略（不抛错，体验更软）
        - 输入 refs 形如 [{"type":"character","id":1}, ...]
        - 输出 dict 形如 {"characters":[...], "locations":[...], ...}（仅包含有命中的桶）

        与 `_get_characters` 等批量方法的区别：
        - 这里按 ID 集合精筛，不限制条数（调用方应在更上层做数量上限）
        - 复用相同的字段截断策略，保持 prompt 注入风格一致
        """
        # 把 refs 按类型分桶
        ids_by_type: dict[str, set[int]] = {}
        for ref in refs:
            ref_type = ref.get("type")
            ref_id = ref.get("id")
            if not isinstance(ref_type, str) or not isinstance(ref_id, int):
                continue
            ids_by_type.setdefault(ref_type, set()).add(ref_id)

        result: dict[str, list[dict]] = {}

        if char_ids := ids_by_type.get("character"):
            rows = await self.db.execute(
                select(Character)
                .where(Character.project_id == project_id, Character.id.in_(char_ids))
                .order_by(Character.id)
            )
            chars: list[dict] = []
            for c in rows.scalars().all():
                relationships: dict | None = None
                if c.extra_attributes:
                    try:
                        import json as _json

                        extra = _json.loads(c.extra_attributes)
                        if isinstance(extra, dict):
                            rel = extra.get("relationships")
                            if isinstance(rel, dict) and rel:
                                relationships = rel
                    except (ValueError, TypeError):
                        pass
                chars.append(
                    {
                        "id": c.id,
                        "name": c.name,
                        "description": _truncate(c.description, 200),
                        "personality": _truncate(c.personality, 200),
                        "background": _truncate(c.background, 200),
                        "relationships": relationships,
                    }
                )
            if chars:
                result["characters"] = chars

        if loc_ids := ids_by_type.get("location"):
            rows = await self.db.execute(
                select(Location)
                .where(Location.project_id == project_id, Location.id.in_(loc_ids))
                .order_by(Location.id)
            )
            locs = [
                {
                    "id": loc.id,
                    "name": loc.name,
                    "description": _truncate(loc.description, 200),
                }
                for loc in rows.scalars().all()
            ]
            if locs:
                result["locations"] = locs

        if org_ids := ids_by_type.get("organization"):
            rows = await self.db.execute(
                select(Organization)
                .where(Organization.project_id == project_id, Organization.id.in_(org_ids))
                .order_by(Organization.id)
            )
            orgs = [
                {
                    "id": org.id,
                    "name": org.name,
                    "description": _truncate(org.description, 200),
                }
                for org in rows.scalars().all()
            ]
            if orgs:
                result["organizations"] = orgs

        if wv_ids := ids_by_type.get("worldview"):
            rows = await self.db.execute(
                select(Worldview)
                .where(Worldview.project_id == project_id, Worldview.id.in_(wv_ids))
                .order_by(Worldview.id)
            )
            wvs = [
                {
                    "id": w.id,
                    "name": w.name,
                    "description": _truncate(w.description, 300),
                }
                for w in rows.scalars().all()
            ]
            if wvs:
                result["worldviews"] = wvs

        return result

    @staticmethod
    def format_referenced_entities(entities: dict[str, list[dict]]) -> str:
        """
        把 `get_referenced_entities` 的结果渲染成 prompt 可注入的中文文本段。
        空字典返回空字符串，调用方据此决定是否拼接。
        """
        if not entities:
            return ""

        lines: list[str] = ["【已知项目实体（仅供参考）】"]

        for c in entities.get("characters") or []:
            lines.append(f"- 角色《{c['name']}》")
            if c.get("description"):
                lines.append(f"  · 一句话定位：{c['description']}")
            if c.get("personality"):
                lines.append(f"  · 性格：{c['personality']}")
            if c.get("background"):
                lines.append(f"  · 背景：{c['background']}")
            rel = c.get("relationships")
            if rel:
                rel_text = "、".join(f"{k}={v}" for k, v in rel.items())
                lines.append(f"  · 已记载关系：{rel_text}")

        for loc in entities.get("locations") or []:
            lines.append(f"- 地点《{loc['name']}》")
            if loc.get("description"):
                lines.append(f"  · 描述：{loc['description']}")

        for org in entities.get("organizations") or []:
            lines.append(f"- 组织《{org['name']}》")
            if org.get("description"):
                lines.append(f"  · 描述：{org['description']}")

        for w in entities.get("worldviews") or []:
            lines.append(f"- 世界观《{w['name']}》")
            if w.get("description"):
                lines.append(f"  · 描述：{w['description']}")

        return "\n".join(lines)

    def format_for_chat(self, ctx: dict) -> str:
        """格式化 chat 用轻量上下文：项目元数据 + 角色基础列表。"""
        return self._format_chat_characters(ctx, field_limit=200, compact=False)

    def format_for_chat_with_budget(self, ctx: dict, max_chars: int = CHAT_CONTEXT_MAX_CHARS) -> str:
        """按角色数量自适应预算格式化 chat 上下文。"""
        characters = ctx.get("characters") or []
        count = len(characters)
        if count > 8:
            text = self._format_chat_characters(ctx, field_limit=100, compact=True)
        else:
            field_limit = 200 if count <= 3 else max(100, 200 - (count - 3) * 20)
            text = self._format_chat_characters(ctx, field_limit=field_limit, compact=False)

        if len(text) <= max_chars:
            return text

        if count <= 8:
            text = self._format_chat_characters(ctx, field_limit=100, compact=False)
            if len(text) <= max_chars:
                return text

        text = self._format_chat_characters(ctx, field_limit=100, compact=True)
        if len(text) <= max_chars:
            return text
        return text[: max(0, max_chars - 8)] + "\n…（已截断）"

    def _format_chat_characters(self, ctx: dict, *, field_limit: int, compact: bool) -> str:
        parts = []
        if ctx.get("project_name"):
            parts.append(f"项目：{ctx['project_name']}")
        if ctx.get("project_description"):
            parts.append(f"简介：{_truncate(ctx['project_description'], min(1000, field_limit * 3))}")

        characters = ctx.get("characters") or []
        lines = ["【角色基础列表】"]
        if not characters:
            lines.append("暂无角色。")
        else:
            for c in characters:
                name = c.get("name", "未命名")
                if compact:
                    desc = _truncate(c.get("description", ""), field_limit)
                    lines.append(f"- {name}：{desc}" if desc else f"- {name}")
                    continue
                lines.append(
                    "\n".join(
                        [
                            f"- {name}",
                            f"  描述：{_truncate(c.get('description', ''), field_limit)}",
                            f"  性格：{_truncate(c.get('personality', ''), field_limit)}",
                            f"  背景：{_truncate(c.get('background', ''), field_limit)}",
                            f"  外貌：{_truncate(c.get('appearance', ''), field_limit)}",
                        ]
                    )
                )
        parts.append("\n".join(lines))
        return "\n\n".join(parts)

    def count_tokens_estimate(self, text: str) -> int:
        """实例方法包装，便于调用方从 builder 使用。"""
        return count_tokens_estimate(text)

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
