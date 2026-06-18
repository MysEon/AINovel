"""
AI 上下文构建器 — 从项目数据统一组装 LLM 上下文

职责：
- 按项目 ID 聚合角色、世界观、地点、组织、章节摘要
- 为不同工作流提供不同粒度的上下文（outline/chat/revision）
- 控制上下文体积（截断策略）
- 章节分层注入：L1 当前章全文 / L2 近 3 章详细 / L3 更早 ≤6 章简要（共 ≤10 章）
"""

import asyncio
import logging
from dataclasses import dataclass

from sqlalchemy import nullslast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.story_knowledge import EntityRelationship, EntityStateEvent
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 8000
CHAT_CONTEXT_MAX_CHARS = 4000

# ── 分层章节摘要参数 ─────────────────────────────────────────────────────
TIERED_TOTAL_CHAPTERS = 10  # L1 + L2 + L3 共最多注入这么多章
TIERED_L2_MAX = 3  # L2 详细概括最多几章（当前章前 3 章）
TIERED_L3_MAX = 6  # L3 简要概括最多几章（L2 之前的 6 章）
TIERED_L2_TARGET_CHARS = 500  # L2 详细概括目标字数
TIERED_L3_TARGET_CHARS = 150  # L3 简要概括目标字数


def _truncate(text: str, max_len: int = 500) -> str:
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len] + "…"


@dataclass
class TieredChapterContext:
    """分层章节上下文聚合结果。"""

    l1: Chapter | None  # 当前章节（全文）
    l2: list[Chapter]  # 近 3 章（用 summary_detailed）
    l3: list[Chapter]  # 更早 ≤6 章（用 summary_brief）
    summary_errors: list[Exception]  # 摘要生成期间收集的异常（不致命）


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

        if mode in ("full", "outline", "chat"):
            ctx["worldviews"] = await self._get_worldviews(project_id)
            ctx["locations"] = await self._get_locations(project_id)
            ctx["organizations"] = await self._get_organizations(project_id)
            entity_names = await self._get_entity_name_lookup(project_id)
            ctx["relationships"] = await self._get_relationships(project_id, entity_names)
            ctx["state_events"] = await self._get_state_events(project_id, entity_names)

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
                "id": c.id,
                "name": c.name,
                "description": _truncate(c.description, 200),
                "personality": _truncate(c.personality, 200),
                "background": _truncate(c.background, 200),
                "appearance": _truncate(c.appearance, 200),
                "organization_id": c.organization_id,
            }
            for c in result.scalars().all()
        ]

    async def _get_worldviews(self, project_id: int) -> list[dict]:
        result = await self.db.execute(select(Worldview).where(Worldview.project_id == project_id).limit(10))
        return [
            {
                "id": w.id,
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
                "id": loc.id,
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
                "id": org.id,
                "name": org.name,
                "description": _truncate(org.description, 200),
                "purpose": _truncate(org.purpose, 150),
            }
            for org in result.scalars().all()
        ]

    async def _get_entity_name_lookup(self, project_id: int) -> dict[tuple[str, int], str]:
        lookup: dict[tuple[str, int], str] = {}
        model_pairs = (
            ("character", Character),
            ("worldview", Worldview),
            ("location", Location),
            ("organization", Organization),
        )
        for entity_type, model in model_pairs:
            rows = await self.db.execute(
                select(model.id, model.name).where(model.project_id == project_id)
            )
            for entity_id, name in rows.all():
                lookup[(entity_type, entity_id)] = name
        return lookup

    async def _get_relationships(
        self,
        project_id: int,
        entity_names: dict[tuple[str, int], str],
    ) -> list[dict]:
        result = await self.db.execute(
            select(EntityRelationship)
            .where(EntityRelationship.project_id == project_id, EntityRelationship.status == "active")
            .order_by(EntityRelationship.updated_at.desc(), EntityRelationship.id.desc())
            .limit(30)
        )
        return [
            {
                "source_type": rel.source_type,
                "source_id": rel.source_id,
                "source_name": entity_names.get((rel.source_type, rel.source_id)),
                "relation_type": rel.relation_type,
                "target_type": rel.target_type,
                "target_id": rel.target_id,
                "target_name": entity_names.get((rel.target_type, rel.target_id)),
                "description": _truncate(rel.description, 200),
                "evidence": _truncate(rel.evidence, 160),
                "confidence": rel.confidence,
            }
            for rel in result.scalars().all()
        ]

    async def _get_state_events(
        self,
        project_id: int,
        entity_names: dict[tuple[str, int], str],
    ) -> list[dict]:
        result = await self.db.execute(
            select(EntityStateEvent)
            .where(EntityStateEvent.project_id == project_id)
            .order_by(
                nullslast(EntityStateEvent.chapter_order.desc()),
                EntityStateEvent.created_at.desc(),
                EntityStateEvent.id.desc(),
            )
            .limit(30)
        )
        return [
            {
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "entity_name": entity_names.get((event.entity_type, event.entity_id)),
                "state_key": event.state_key,
                "old_value": _truncate(event.old_value, 120),
                "new_value": _truncate(event.new_value, 160),
                "summary": _truncate(event.summary, 200),
                "chapter_id": event.chapter_id,
            }
            for event in result.scalars().all()
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
        text = self._format_chat_characters(ctx, field_limit=200, compact=False)
        wb_text = self._format_chat_worldbuilding(ctx, field_limit=120)
        graph_text = self._format_chat_graph(ctx, field_limit=120)
        if wb_text:
            text = text + "\n\n" + wb_text
        if graph_text:
            text = text + "\n\n" + graph_text
        return text

    # ── 分层章节注入（L1 当前章全文 / L2 近 3 章详细 / L3 更早 ≤6 章简要） ──

    async def get_tiered_chapter_context(
        self,
        project_id: int,
        current_chapter_id: int,
        chat_model,
    ) -> "TieredChapterContext":
        """
        按 L1/L2/L3 分层选择章节并按需生成摘要。

        - L1 = current_chapter（全文，不截断）
        - L2 = current 之前 chapter_number 排序的最多 3 章（用 summary_detailed）
        - L3 = L2 之前的最多 6 章（用 summary_brief），与 L1+L2 合计 ≤10 章
        - 三层之外的章节不注入（远处摘要也是噪音）

        如果 L2/L3 章节的 summary 字段缺失或 word_count 与
        summary_source_word_count 不一致 → 调用 chat_model 重新生成并落库。
        L2 / L3 各自的所有缺失摘要任务用 asyncio.gather 并发执行。

        chat_model 由调用方提供（来自 _get_config_and_model），失败时
        TieredChapterContext.summary_errors 收集异常，调用方按需降级。
        """
        # 1. 拉取本项目所有章节（按 chapter_number 升序）
        result = await self.db.execute(
            select(Chapter).where(Chapter.project_id == project_id).order_by(Chapter.chapter_number)
        )
        all_chapters = list(result.scalars().all())
        if not all_chapters:
            return TieredChapterContext(l1=None, l2=[], l3=[], summary_errors=[])

        # 2. 找当前章的位置
        current_idx = next(
            (i for i, ch in enumerate(all_chapters) if ch.id == current_chapter_id),
            None,
        )
        if current_idx is None:
            # 章节 id 不属于本项目，退化为"取末尾章作为 L1"
            logger.warning(
                "current_chapter_id=%s 不属于项目 %s，退化为最末章作为 L1",
                current_chapter_id,
                project_id,
            )
            current_idx = len(all_chapters) - 1

        l1_chapter = all_chapters[current_idx]

        # 3. 切 L2 / L3 滑动窗口
        l2_start = max(0, current_idx - TIERED_L2_MAX)
        l2_chapters = all_chapters[l2_start:current_idx]  # 最多 3 章

        # L1+L2 已占用的章数；剩下的额度给 L3
        used = 1 + len(l2_chapters)
        l3_budget = min(TIERED_L3_MAX, TIERED_TOTAL_CHAPTERS - used)
        l3_start = max(0, l2_start - l3_budget)
        l3_chapters = all_chapters[l3_start:l2_start]

        # 4. 按需生成 L2 / L3 摘要（并发）
        summary_errors: list[Exception] = []

        async def _ensure_l2_summary(ch: Chapter) -> None:
            if not self._is_summary_stale(ch, "detailed"):
                return
            try:
                summary = await self._generate_chapter_summary(
                    ch, chat_model, target_chars=TIERED_L2_TARGET_CHARS, level="detailed"
                )
                ch.summary_detailed = summary
                ch.summary_source_word_count = ch.word_count or 0
            except Exception as exc:  # noqa: BLE001
                logger.warning("L2 摘要生成失败 chapter_id=%s: %s", ch.id, exc, exc_info=True)
                summary_errors.append(exc)

        async def _ensure_l3_summary(ch: Chapter) -> None:
            if not self._is_summary_stale(ch, "brief"):
                return
            try:
                summary = await self._generate_chapter_summary(
                    ch, chat_model, target_chars=TIERED_L3_TARGET_CHARS, level="brief"
                )
                ch.summary_brief = summary
                ch.summary_source_word_count = ch.word_count or 0
            except Exception as exc:  # noqa: BLE001
                logger.warning("L3 摘要生成失败 chapter_id=%s: %s", ch.id, exc, exc_info=True)
                summary_errors.append(exc)

        tasks = [_ensure_l2_summary(ch) for ch in l2_chapters] + [
            _ensure_l3_summary(ch) for ch in l3_chapters
        ]
        if tasks:
            await asyncio.gather(*tasks)
            # 任何摘要写入需 commit；如失败章节字段维持 None / 旧值
            await self.db.commit()
            for ch in l2_chapters + l3_chapters:
                await self.db.refresh(ch)

        return TieredChapterContext(
            l1=l1_chapter,
            l2=list(l2_chapters),
            l3=list(l3_chapters),
            summary_errors=summary_errors,
        )

    @staticmethod
    def _is_summary_stale(chapter: Chapter, level: str) -> bool:
        """判断章节摘要是否过期或缺失。"""
        if not chapter.content or not chapter.content.strip():
            return False  # 空章节没必要生成摘要
        target_field = "summary_detailed" if level == "detailed" else "summary_brief"
        existing = getattr(chapter, target_field, None)
        if not existing:
            return True
        # word_count 快照对不上 → 摘要过期
        return (chapter.word_count or 0) != (chapter.summary_source_word_count or 0)

    @staticmethod
    async def _generate_chapter_summary(
        chapter: Chapter,
        chat_model,
        *,
        target_chars: int,
        level: str,
    ) -> str:
        """调用 LLM 生成单章摘要。失败抛异常由调用方 collect。"""
        from langchain_core.messages import HumanMessage, SystemMessage

        from app.schemas.legacy_ai import ChapterSummarySchema

        if level == "detailed":
            instruction = (
                f"请用约 {target_chars} 字概括以下章节，保留人物动作、关键转折、"
                "情绪线、伏笔。要事实性陈述，不要文学化润色，不要剧透角色心理推测。"
            )
        else:
            instruction = (
                f"请用约 {target_chars} 字概括以下章节的主线进展和关键事件，"
                "不保留细节描写，只抓最重要的剧情节点。"
            )

        system_prompt = (
            "你是一个小说章节摘要器。严格按以下 JSON schema 输出：\n"
            '{ "summary": "string，章节摘要内容" }\n\n'
            f"{instruction}"
        )
        user_content = (
            f"章节标题：{chapter.title or '未命名'}\n"
            f"章节序号：{chapter.chapter_number}\n\n"
            f"章节正文：\n{chapter.content or ''}"
        )

        try:
            structured = chat_model.with_structured_output(ChapterSummarySchema, method="json_mode")
        except TypeError:
            structured = chat_model.with_structured_output(ChapterSummarySchema)

        result = await structured.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_content)]
        )
        if isinstance(result, ChapterSummarySchema):
            return result.summary.strip()
        return ChapterSummarySchema.model_validate(result).summary.strip()

    @staticmethod
    def render_tiered_chapter_segment(
        tiered: "TieredChapterContext",
        *,
        l1_tail_chars: int | None = None,
        include_l2: bool = True,
    ) -> str:
        """
        把分层章节上下文渲染为 prompt 文本段（系统提示插入用）。

        l1_tail_chars: 当前章超长时取最后 N 字（用于渐进降级）；None = 全文
        include_l2: 第三段降级时丢弃 L2，仅保留 L3
        """
        parts: list[str] = []

        # L3 简要（最早的章节先呈现，让 AI 按时间顺序读）
        if tiered.l3:
            lines = ["【小说前情简述】"]
            for ch in tiered.l3:
                summary = (ch.summary_brief or "").strip()
                if summary:
                    lines.append(f"- 第{ch.chapter_number}章《{ch.title or '未命名'}》：{summary}")
                else:
                    lines.append(f"- 第{ch.chapter_number}章《{ch.title or '未命名'}》：（摘要生成失败，本章已跳过）")
            parts.append("\n".join(lines))

        # L2 详细
        if include_l2 and tiered.l2:
            lines = ["【近期章节回顾】"]
            for ch in tiered.l2:
                summary = (ch.summary_detailed or "").strip()
                if summary:
                    lines.append(f"\n第{ch.chapter_number}章《{ch.title or '未命名'}》：\n{summary}")
                else:
                    lines.append(f"\n第{ch.chapter_number}章《{ch.title or '未命名'}》：（摘要生成失败，本章已跳过）")
            parts.append("\n".join(lines))

        # L1 当前章全文（或截断后）
        if tiered.l1:
            ch = tiered.l1
            content = ch.content or ""
            header = f"【当前章节正在写的内容（第{ch.chapter_number}章《{ch.title or '未命名'}》）】"
            if l1_tail_chars is not None and len(content) > l1_tail_chars:
                omitted = len(content) - l1_tail_chars
                content = (
                    f"【...前文 {omitted} 字已省略，以下是当前章节最近的内容...】\n\n"
                    + content[-l1_tail_chars:]
                )
            parts.append(f"{header}\n{content}")

        return "\n\n".join(parts)

    def format_for_chat_with_budget(self, ctx: dict, max_chars: int = CHAT_CONTEXT_MAX_CHARS) -> str:
        """按角色数量自适应预算格式化 chat 上下文。"""
        characters = ctx.get("characters") or []
        count = len(characters)
        if count > 8:
            text = self._format_chat_characters(ctx, field_limit=100, compact=True)
        else:
            field_limit = 200 if count <= 3 else max(100, 200 - (count - 3) * 20)
            text = self._format_chat_characters(ctx, field_limit=field_limit, compact=False)

        # 追加世界观/地点/组织（如存在）
        wb_text = self._format_chat_worldbuilding(ctx, field_limit=120)
        if wb_text:
            text = text + "\n\n" + wb_text
        graph_text = self._format_chat_graph(ctx, field_limit=120)
        if graph_text:
            text = text + "\n\n" + graph_text

        if len(text) <= max_chars:
            return text

        # 降级 1：更紧凑的角色格式 + 保留世界building
        if count <= 8:
            text = self._format_chat_characters(ctx, field_limit=100, compact=False)
            wb_text = self._format_chat_worldbuilding(ctx, field_limit=80)
            graph_text = self._format_chat_graph(ctx, field_limit=80)
            if wb_text:
                text = text + "\n\n" + wb_text
            if graph_text:
                text = text + "\n\n" + graph_text
            if len(text) <= max_chars:
                return text

        # 降级 2：最紧凑角色格式 + 保留世界building
        text = self._format_chat_characters(ctx, field_limit=100, compact=True)
        wb_text = self._format_chat_worldbuilding(ctx, field_limit=60)
        graph_text = self._format_chat_graph(ctx, field_limit=60)
        if wb_text:
            text = text + "\n\n" + wb_text
        if graph_text:
            text = text + "\n\n" + graph_text
        if len(text) <= max_chars:
            return text

        # 降级 3：仅保留角色，丢弃世界building
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

    def _format_chat_worldbuilding(self, ctx: dict, *, field_limit: int) -> str:
        """格式化 chat 用的世界观/地点/组织精简段。"""
        sections: list[str] = []

        worldviews = ctx.get("worldviews") or []
        if worldviews:
            lines = ["【世界观】"]
            for w in worldviews:
                name = w.get("name", "未命名")
                desc = _truncate(w.get("description", ""), field_limit)
                lines.append(f"- {name}：{desc}" if desc else f"- {name}")
            sections.append("\n".join(lines))

        locations = ctx.get("locations") or []
        if locations:
            lines = ["【地点】"]
            for loc in locations:
                name = loc.get("name", "未命名")
                desc = _truncate(loc.get("description", ""), field_limit)
                lines.append(f"- {name}：{desc}" if desc else f"- {name}")
            sections.append("\n".join(lines))

        organizations = ctx.get("organizations") or []
        if organizations:
            lines = ["【组织】"]
            for org in organizations:
                name = org.get("name", "未命名")
                desc = _truncate(org.get("description", ""), field_limit)
                lines.append(f"- {name}：{desc}" if desc else f"- {name}")
            sections.append("\n".join(lines))

        return "\n\n".join(sections) if sections else ""

    def _format_chat_graph(self, ctx: dict, *, field_limit: int) -> str:
        sections: list[str] = []

        relationships = ctx.get("relationships") or []
        if relationships:
            lines = ["[Known Relationships]"]
            for rel in relationships:
                source = rel.get("source_name") or f"{rel.get('source_type')}#{rel.get('source_id')}"
                target = rel.get("target_name") or f"{rel.get('target_type')}#{rel.get('target_id')}"
                relation = rel.get("relation_type") or "related_to"
                desc = _truncate(rel.get("description", ""), field_limit)
                line = f"- {source} --{relation}--> {target}"
                if desc:
                    line += f": {desc}"
                lines.append(line)
            sections.append("\n".join(lines))

        state_events = ctx.get("state_events") or []
        if state_events:
            lines = ["[State Timeline]"]
            for event in state_events:
                entity = event.get("entity_name") or f"{event.get('entity_type')}#{event.get('entity_id')}"
                key = event.get("state_key") or "state"
                value = _truncate(event.get("new_value", ""), field_limit)
                summary = _truncate(event.get("summary", ""), field_limit)
                line = f"- {entity} / {key}"
                if value:
                    line += f": {value}"
                if summary:
                    line += f" ({summary})"
                lines.append(line)
            sections.append("\n".join(lines))

        return "\n\n".join(sections) if sections else ""

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

        if ctx.get("organizations"):
            lines = ["[Organizations]"]
            for org in ctx["organizations"]:
                lines.append(f"- {org['name']}: {org.get('description', '')}")
            parts.append("\n".join(lines))

        graph_text = self._format_chat_graph(ctx, field_limit=160)
        if graph_text:
            parts.append(graph_text)

        if ctx.get("previous_chapters"):
            lines = ["【前文摘要】"]
            for ch in ctx["previous_chapters"][-5:]:
                lines.append(f"- 第{ch['number']}章 {ch['title']}：{ch.get('summary', '')}")
            parts.append("\n".join(lines))

        text = "\n\n".join(parts)
        if len(text) > MAX_CONTEXT_CHARS:
            text = text[:MAX_CONTEXT_CHARS] + "\n…（上下文已截断）"
        return text
