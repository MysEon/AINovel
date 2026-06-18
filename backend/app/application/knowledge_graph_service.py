"""Application service for story knowledge graph proposals."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, nullslast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.project_service import ProjectService
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.model_scenarios import DEFAULT_SCENARIOS, KNOWLEDGE_UPDATE_SCENARIO, MODEL_SCENARIOS
from app.domain.ai_runtime.enums import RunStatus
from app.infrastructure.db.models.ai_runtime import AIRun, LangGraphSession, LangGraphWorkflow
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.story_knowledge import (
    EntityChangeProposal,
    EntityRelationship,
    EntityStateEvent,
    ProposalOperation,
)
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview
from app.infrastructure.secrets import get_encryption_service
from app.infrastructure.task.runner import background_runner
from app.schemas.knowledge import (
    ChapterAnalysisStatusResponse,
    ChapterKnowledgeAnalysisDraft,
    ChapterKnowledgeAnalysisResponse,
    EntityChangeProposalCreate,
    EntityChangeProposalResponse,
    EntityRelationshipResponse,
    EntityStateEventResponse,
    KnowledgeOperationDraft,
    KnowledgeProposalDraft,
    ProposalAcceptRequest,
    ProposalOperationCreate,
    ProposalOperationResponse,
)

logger = logging.getLogger(__name__)

# 章节分析后台任务并发限流（避免批量发布时瞬间爆 N 个 LLM 调用）
_CHAPTER_ANALYSIS_SEMAPHORE = asyncio.Semaphore(2)

try:
    from langchain_core.exceptions import OutputParserException
except ImportError:  # pragma: no cover
    _PARSE_EXCEPTIONS: tuple[type[Exception], ...] = (PydanticValidationError, ValueError)
else:
    _PARSE_EXCEPTIONS = (OutputParserException, PydanticValidationError, ValueError)

_encryption_service = get_encryption_service()

ENTITY_MODELS = {
    "character": Character,
    "location": Location,
    "organization": Organization,
    "worldview": Worldview,
}

ENTITY_ALLOWED_FIELDS = {
    "character": {
        "name",
        "description",
        "personality",
        "background",
        "appearance",
        "gender",
        "age",
        "height",
        "weight",
        "birthday",
        "blood_type",
        "species",
        "alignment",
        "organization_id",
        "dimensions",
        "abilities",
        "weaknesses",
        "extra_attributes",
    },
    "location": {"name", "description", "geography", "culture", "history"},
    "organization": {"name", "description", "structure", "purpose", "influence"},
    "worldview": {"name", "description", "rules", "magic_system", "technology", "timeline"},
}

JSON_TEXT_FIELDS = {
    ("character", "dimensions"),
    ("character", "extra_attributes"),
}

DEFAULT_RELATION_POLICIES = {
    "ally_of": {"inverse_relation_type": "ally_of"},
    "enemy_of": {"inverse_relation_type": "enemy_of"},
    "spouse_of": {"inverse_relation_type": "spouse_of"},
    "parent_of": {"inverse_relation_type": "child_of"},
    "child_of": {"inverse_relation_type": "parent_of"},
    "located_in": {"exclusive_scope": "source_relation"},
}
TERMINAL_STATE_KEYS = {"status", "state", "condition", "life_status", "existence"}
DESTROYED_STATE_MARKERS = ("destroyed", "dead", "deceased", "灭亡", "覆灭", "已灭", "死亡", "身死", "陨落")
ASCENDED_STATE_MARKERS = ("ascended", "飞升")
DEFAULT_TERMINAL_RELATIONSHIP_EFFECTS = {
    "destroyed": [{"action": "deactivate", "scope": "entity"}],
    "ascended": [{"action": "deactivate", "scope": "source", "relation_type": "located_in"}],
}

ACTIVE_PROPOSAL_STATUSES = {"pending", "conflicted"}
ACTIVE_OPERATION_STATUSES = {"pending", "conflicted"}
CHAPTER_ANALYSIS_SOURCE = "chapter_analysis"


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _load_json(raw: str | None) -> Any:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


def _serialize_state_value(entity_type: str | None, field_name: str | None, value: Any) -> str | None:
    """将读出的字段值序列化为状态事件存储用的 Text 形式。"""
    if value is None:
        return None
    if (entity_type, field_name) in JSON_TEXT_FIELDS:
        return _dump_json(value)
    return value if isinstance(value, str) else str(value)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class KnowledgeGraphService:
    """Story knowledge graph and proposal lifecycle service."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.project_service = ProjectService(db)

    @staticmethod
    def _parse_scenarios(raw: str | None) -> list[str]:
        if raw is None:
            return MODEL_SCENARIOS.copy()
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return DEFAULT_SCENARIOS.copy()
        return parsed if isinstance(parsed, list) else DEFAULT_SCENARIOS.copy()

    @staticmethod
    def _build_structured_model(chat_model, schema):
        try:
            return chat_model.with_structured_output(schema, method="json_mode")
        except TypeError:
            return chat_model.with_structured_output(schema)

    async def _get_config_and_model(self, config_id: int, user_id: int):
        from app.infrastructure.llm.provider_adapters import ProviderConfig, get_provider

        result = await self.db.execute(
            select(ModelConfig).where(
                ModelConfig.id == config_id,
                ModelConfig.user_id == user_id,
            )
        )
        cfg = result.scalar_one_or_none()
        if not cfg:
            raise NotFoundError("模型配置不存在或无权访问")
        scenarios = self._parse_scenarios(cfg.scenarios)
        if KNOWLEDGE_UPDATE_SCENARIO not in scenarios:
            raise ForbiddenError("该模型未授权用于知识库更新场景")
        if not cfg.api_key:
            raise ForbiddenError("该模型配置没有保存 API 密钥")

        provider = get_provider(cfg.model_type)
        pcfg = ProviderConfig(
            api_key=_encryption_service.decrypt(cfg.api_key),
            model_name=cfg.model_name or "",
            temperature=float(cfg.temperature) if cfg.temperature else 0.2,
            max_tokens=cfg.max_tokens or 2000,
            top_p=float(cfg.top_p) if cfg.top_p else 1.0,
            api_url=cfg.api_url,
            proxy_url=cfg.proxy_url if cfg.enable_proxy else None,
            frequency_penalty=float(cfg.frequency_penalty) if cfg.frequency_penalty else 0.0,
            presence_penalty=float(cfg.presence_penalty) if cfg.presence_penalty else 0.0,
            stop_sequences=self._parse_stop_sequences(cfg.stop_sequences),
        )
        return cfg, provider.build_chat_model(pcfg)

    @staticmethod
    def _parse_stop_sequences(raw: str | None) -> list[str] | None:
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        return parsed if isinstance(parsed, list) else None

    async def _get_default_knowledge_model_config(self, user_id: int) -> ModelConfig | None:
        """查找用户第一个支持 knowledge_update 且有 API Key 的模型配置。"""
        result = await self.db.execute(
            select(ModelConfig)
            .where(
                ModelConfig.user_id == user_id,
                ModelConfig.api_key.isnot(None),
            )
            .order_by(ModelConfig.id)
        )
        for cfg in result.scalars().all():
            scenarios = self._parse_scenarios(cfg.scenarios)
            if KNOWLEDGE_UPDATE_SCENARIO in scenarios:
                return cfg
        return None

    async def _get_or_create_knowledge_workflow(
        self,
        project_id: int,
        model_config_id: int,
    ) -> LangGraphWorkflow:
        result = await self.db.execute(
            select(LangGraphWorkflow).where(
                LangGraphWorkflow.project_id == project_id,
                LangGraphWorkflow.workflow_type == "knowledge_update",
            )
        )
        workflow = result.scalar_one_or_none()
        if workflow:
            return workflow
        workflow = LangGraphWorkflow(
            name="知识更新",
            workflow_type="knowledge_update",
            project_id=project_id,
            model_config_id=model_config_id,
            status="active",
        )
        self.db.add(workflow)
        await self.db.flush()
        return workflow

    async def _get_or_create_knowledge_session(
        self,
        workflow_id: int,
        chapter_id: int,
    ) -> LangGraphSession:
        thread_id = f"knowledge-update-{workflow_id}-{chapter_id}"
        result = await self.db.execute(
            select(LangGraphSession).where(LangGraphSession.thread_id == thread_id)
        )
        session = result.scalar_one_or_none()
        if session:
            return session
        session = LangGraphSession(
            workflow_id=workflow_id,
            thread_id=thread_id,
            messages_count=0,
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def submit_chapter_analysis(
        self,
        project_id: int,
        chapter_id: int,
        user_id: int,
    ) -> int | None:
        """提交章节知识分析后台任务。返回 AIRun.id，None 表示去重跳过或没有可用模型。"""
        existing = await self._list_existing_chapter_analysis(project_id, chapter_id)
        if existing:
            logger.info("Chapter %s already has pending proposals, skipping analysis", chapter_id)
            return None

        cfg = await self._get_default_knowledge_model_config(user_id)
        if cfg is None:
            logger.warning("No knowledge_update model config found for user %s, skipping analysis", user_id)
            return None

        workflow = await self._get_or_create_knowledge_workflow(project_id, cfg.id)
        session = await self._get_or_create_knowledge_session(workflow.id, chapter_id)

        run = AIRun(
            session_id=session.id,
            workflow_type="knowledge_update",
            status=RunStatus.PENDING.value,
            input_data=_dump_json({
                "project_id": project_id,
                "chapter_id": chapter_id,
                "user_id": user_id,
                "model_config_id": cfg.id,
            }),
        )
        self.db.add(run)
        await self.db.flush()

        coro = _run_chapter_analysis_background(
            run.id, project_id, chapter_id, user_id, cfg.id,
        )
        background_runner.submit(run.id, coro)
        logger.info("Submitted chapter analysis background task run=%s chapter=%s", run.id, chapter_id)
        return run.id

    async def get_latest_chapter_analysis_run(
        self,
        project_id: int,
        user_id: int,
        chapter_id: int,
    ) -> ChapterAnalysisStatusResponse:
        """查询某章节最近的知识分析 AIRun 状态。"""
        await self.project_service.require_user_project(project_id, user_id)
        stmt = (
            select(AIRun)
            .join(LangGraphSession, AIRun.session_id == LangGraphSession.id)
            .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
            .join(Project, LangGraphWorkflow.project_id == Project.id)
            .where(
                Project.id == project_id,
                Project.user_id == user_id,
                AIRun.workflow_type == "knowledge_update",
            )
            .order_by(AIRun.id.desc())
            .limit(50)
        )
        result = await self.db.execute(stmt)
        for run in result.scalars().all():
            try:
                data = json.loads(run.input_data or "{}")
                if data.get("chapter_id") == chapter_id:
                    return ChapterAnalysisStatusResponse(
                        run_id=run.id,
                        status=run.status,
                        created_at=run.created_at,
                        started_at=run.started_at,
                        finished_at=run.finished_at,
                        error_message=run.error_message,
                    )
            except (json.JSONDecodeError, TypeError):
                continue
        return ChapterAnalysisStatusResponse(run_id=None, status=None)

    async def analyze_chapter(
        self,
        project_id: int,
        chapter_id: int,
        user_id: int,
        *,
        model_config_id: int,
        force: bool = False,
    ) -> ChapterKnowledgeAnalysisResponse:
        logger.info("Starting chapter analysis project=%s chapter=%s", project_id, chapter_id)
        await self.project_service.require_user_project(project_id, user_id)
        chapter = await self._require_chapter(project_id, chapter_id)

        existing = await self._list_existing_chapter_analysis(project_id, chapter_id)
        if existing and not force:
            logger.info("Chapter %s has existing pending proposals, returning cached", chapter_id)
            return ChapterKnowledgeAnalysisResponse(
                success=True,
                project_id=project_id,
                chapter_id=chapter_id,
                proposal_count=len(existing),
                skipped_proposal_count=0,
                proposals=[self._proposal_response(proposal) for proposal in existing],
                message="本章已有待处理知识变更提案",
            )

        _cfg, chat_model = await self._get_config_and_model(model_config_id, user_id)
        entities = await self._load_analysis_entities(project_id)
        prompt = self._build_chapter_analysis_prompt(chapter, entities)
        structured_model = self._build_structured_model(chat_model, ChapterKnowledgeAnalysisDraft)

        from langchain_core.messages import HumanMessage, SystemMessage

        last_error: Exception | None = None
        for _attempt in range(2):
            try:
                result = await structured_model.ainvoke(
                    [
                        SystemMessage(content=self._chapter_analysis_system_prompt()),
                        HumanMessage(content=prompt),
                    ]
                )
                draft = (
                    result
                    if isinstance(result, ChapterKnowledgeAnalysisDraft)
                    else ChapterKnowledgeAnalysisDraft.model_validate(result)
                )
                break
            except _PARSE_EXCEPTIONS as exc:
                last_error = exc
        else:
            logger.error("Chapter analysis parsing failed for chapter %s: %s", chapter_id, last_error)
            raise ValidationError("章节知识影响分析失败：模型输出无法解析", detail=str(last_error))

        proposals: list[EntityChangeProposalResponse] = []
        skipped = 0
        auto_written = 0
        for proposal_draft in draft.proposals:
            metadata_applied = 0
            canon_operations: list[KnowledgeOperationDraft] = []

            for op_draft in proposal_draft.operations:
                if self._is_metadata_operation(op_draft):
                    entity_id = self._resolve_entity_id(entities, op_draft.entity_type, op_draft.entity_name)
                    metadata_dict = op_draft.new_value if isinstance(op_draft.new_value, dict) else {}
                    applied = await self._apply_metadata_update(
                        project_id,
                        op_draft.entity_type,
                        entity_id,
                        metadata_dict,
                        chapter_id=chapter.id,
                        source=CHAPTER_ANALYSIS_SOURCE,
                    )
                    if applied:
                        metadata_applied += applied
                        continue

                canon_operations.append(op_draft)

            if metadata_applied:
                await self.db.commit()
                auto_written += metadata_applied

            if canon_operations:
                canon_draft = proposal_draft.model_copy(update={"operations": canon_operations})
                body = self._proposal_body_from_draft(chapter.id, canon_draft, entities)
                if body is not None:
                    proposals.append(await self.create_proposal(project_id, user_id, body))
                else:
                    skipped += 1
            else:
                if not metadata_applied:
                    skipped += 1

        logger.info(
            "Chapter analysis completed project=%s chapter=%s proposals=%s skipped=%s auto_written=%s",
            project_id, chapter.id, len(proposals), skipped, auto_written,
        )
        return ChapterKnowledgeAnalysisResponse(
            success=True,
            project_id=project_id,
            chapter_id=chapter.id,
            proposal_count=len(proposals),
            skipped_proposal_count=skipped,
            auto_written_count=auto_written,
            proposals=proposals,
            message="章节知识影响分析完成" if (proposals or auto_written) else "未发现可写入的知识变更",
        )

    async def create_proposal(
        self,
        project_id: int,
        user_id: int,
        body: EntityChangeProposalCreate,
    ) -> EntityChangeProposalResponse:
        await self.project_service.require_user_project(project_id, user_id)
        await self._require_chapter(project_id, body.chapter_id)

        proposal = EntityChangeProposal(
            project_id=project_id,
            chapter_id=body.chapter_id,
            title=body.title,
            summary=body.summary,
            evidence=body.evidence,
            confidence=body.confidence,
            source=body.source,
            raw_payload=_dump_json(body.raw_payload) if body.raw_payload is not None else None,
        )
        self.db.add(proposal)
        await self.db.flush()

        for index, operation_body in enumerate(body.operations):
            operation = await self._build_operation(project_id, operation_body, index)
            operation.proposal_id = proposal.id
            self.db.add(operation)

        await self.db.commit()
        proposal = await self._get_proposal_for_user(proposal.id, user_id)
        return self._proposal_response(proposal)

    async def list_proposals(
        self,
        project_id: int,
        user_id: int,
        *,
        status: str | None = None,
        chapter_id: int | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
    ) -> list[EntityChangeProposalResponse]:
        await self.project_service.require_user_project(project_id, user_id)

        stmt = (
            select(EntityChangeProposal)
            .where(EntityChangeProposal.project_id == project_id)
            .options(selectinload(EntityChangeProposal.operations))
            .order_by(EntityChangeProposal.created_at.desc(), EntityChangeProposal.id.desc())
        )
        if status:
            stmt = stmt.where(EntityChangeProposal.status == status)
        if chapter_id is not None:
            stmt = stmt.where(EntityChangeProposal.chapter_id == chapter_id)
        if entity_type or entity_id:
            stmt = stmt.join(ProposalOperation)
            if entity_type:
                stmt = stmt.where(
                    or_(ProposalOperation.entity_type == entity_type, ProposalOperation.target_type == entity_type)
                )
            if entity_id is not None:
                stmt = stmt.where(
                    or_(ProposalOperation.entity_id == entity_id, ProposalOperation.target_id == entity_id)
                )

        result = await self.db.execute(stmt)
        return [self._proposal_response(proposal) for proposal in result.scalars().unique().all()]

    async def get_proposal(self, proposal_id: int, user_id: int) -> EntityChangeProposalResponse:
        proposal = await self._get_proposal_for_user(proposal_id, user_id)
        return self._proposal_response(proposal)

    async def accept_proposal(
        self,
        proposal_id: int,
        user_id: int,
        body: ProposalAcceptRequest,
    ) -> EntityChangeProposalResponse:
        proposal = await self._get_proposal_for_user(proposal_id, user_id)

        # Bug 1: 加悲观锁（PostgreSQL 生产环境生效；SQLite aiosqlite 为 no-op 但不报错）
        lock_stmt = (
            select(EntityChangeProposal)
            .where(EntityChangeProposal.id == proposal_id)
            .with_for_update()
        )
        await self.db.execute(lock_stmt)

        # Bug 1: CAS 校验——已被终态处理则拒绝重复 accept
        if proposal.status not in ACTIVE_PROPOSAL_STATUSES:
            raise ValidationError("提案已处理，不能重复接受")

        available_ops = [op for op in proposal.operations if op.status in ACTIVE_OPERATION_STATUSES]
        available_ids = {op.id for op in available_ops}

        accepted_ids = (
            set(body.accepted_operation_ids) if body.accepted_operation_ids is not None else set(available_ids)
        )
        rejected_ids = set(body.rejected_operation_ids)
        if accepted_ids & rejected_ids:
            raise ValidationError("同一个子操作不能同时接受和拒绝")
        unknown_ids = (accepted_ids | rejected_ids) - available_ids
        if unknown_ids:
            raise ValidationError("子操作不存在或已处理", detail={"operation_ids": sorted(unknown_ids)})

        if body.accepted_operation_ids is not None:
            rejected_ids |= available_ids - accepted_ids
        else:
            accepted_ids -= rejected_ids

        accepted_ops = [op for op in available_ops if op.id in accepted_ids]
        rejected_ops = [op for op in available_ops if op.id in rejected_ids]

        conflicts = []
        if not body.force_conflicts:
            for operation in accepted_ops:
                conflict = await self._detect_conflict(proposal.project_id, operation)
                if conflict:
                    operation.status = "conflicted"
                    operation.conflict_reason = conflict
                    conflicts.append({"operation_id": operation.id, "reason": conflict})

        if conflicts:
            proposal.status = "conflicted"
            await self.db.flush()
            raise ConflictError("提案存在冲突，请重新分析或明确强制应用", detail={"conflicts": conflicts})

        for operation in rejected_ops:
            operation.status = "rejected"
            operation.conflict_reason = None

        for operation in self._operations_in_apply_order(accepted_ops):
            # Bug 1: 幂等兜底——已应用过的 operation 直接跳过
            if operation.applied_at is not None:
                continue
            success = await self._apply_operation(proposal, operation)
            if success:
                operation.status = "accepted"
                operation.conflict_reason = None
                operation.applied_at = _now()
            else:
                # Bug 7: 空关系删除失败（如 force 模式下 relationship 已不存在）
                operation.status = "conflicted"
                operation.conflict_reason = "要删除的关系不存在或已失效"
                conflicts.append({"operation_id": operation.id, "reason": operation.conflict_reason})

        if conflicts:
            proposal.status = "conflicted"
            await self.db.flush()
            raise ConflictError("提案存在冲突，请重新分析或明确强制应用", detail={"conflicts": conflicts})

        proposal.status = self._proposal_status_after_operations(proposal.operations)
        if proposal.status in {"accepted", "rejected"}:
            proposal.reviewed_at = _now()

        await self.db.commit()
        proposal = await self._get_proposal_for_user(proposal.id, user_id)
        return self._proposal_response(proposal)

    @staticmethod
    def _operations_in_apply_order(operations: list[ProposalOperation]) -> list[ProposalOperation]:
        return sorted(
            operations,
            key=lambda operation: (0 if operation.operation_type == "entity_create" else 1, operation.sort_order),
        )

    async def reject_proposal(
        self,
        proposal_id: int,
        user_id: int,
        *,
        reason: str | None = None,
    ) -> EntityChangeProposalResponse:
        proposal = await self._get_proposal_for_user(proposal_id, user_id)
        # Bug 5: 已终态提案拒绝重复 reject（不撤销已应用操作）
        if proposal.status in {"accepted", "rejected"}:
            raise ValidationError("提案已处理，不能重复拒绝")
        proposal.status = "rejected"
        proposal.reviewed_at = _now()
        for operation in proposal.operations:
            if operation.status in ACTIVE_OPERATION_STATUSES:
                operation.status = "rejected"
                operation.conflict_reason = reason
        await self.db.commit()
        proposal = await self._get_proposal_for_user(proposal.id, user_id)
        return self._proposal_response(proposal)

    async def list_relationships(
        self,
        project_id: int,
        user_id: int,
        *,
        entity_type: str | None = None,
        entity_id: int | None = None,
    ) -> list[EntityRelationshipResponse]:
        await self.project_service.require_user_project(project_id, user_id)
        stmt = select(EntityRelationship).where(EntityRelationship.project_id == project_id)
        if entity_type:
            stmt = stmt.where(
                or_(EntityRelationship.source_type == entity_type, EntityRelationship.target_type == entity_type)
            )
        if entity_id is not None:
            stmt = stmt.where(or_(EntityRelationship.source_id == entity_id, EntityRelationship.target_id == entity_id))
        stmt = stmt.order_by(EntityRelationship.updated_at.desc(), EntityRelationship.id.desc())
        result = await self.db.execute(stmt)
        return [self._relationship_response(row) for row in result.scalars().all()]

    async def list_state_events(
        self,
        project_id: int,
        user_id: int,
        *,
        entity_type: str | None = None,
        entity_id: int | None = None,
        chapter_id: int | None = None,
    ) -> list[EntityStateEventResponse]:
        await self.project_service.require_user_project(project_id, user_id)
        stmt = select(EntityStateEvent).where(EntityStateEvent.project_id == project_id)
        if entity_type:
            stmt = stmt.where(EntityStateEvent.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(EntityStateEvent.entity_id == entity_id)
        if chapter_id is not None:
            stmt = stmt.where(EntityStateEvent.chapter_id == chapter_id)
        stmt = stmt.order_by(
            nullslast(EntityStateEvent.chapter_order.desc()),
            EntityStateEvent.created_at.desc(),
            EntityStateEvent.id.desc(),
        )
        result = await self.db.execute(stmt)
        return [self._state_event_response(row) for row in result.scalars().all()]

    async def _list_existing_chapter_analysis(
        self,
        project_id: int,
        chapter_id: int,
    ) -> list[EntityChangeProposal]:
        stmt = (
            select(EntityChangeProposal)
            .where(
                EntityChangeProposal.project_id == project_id,
                EntityChangeProposal.chapter_id == chapter_id,
                EntityChangeProposal.source == CHAPTER_ANALYSIS_SOURCE,
                EntityChangeProposal.status == "pending",
            )
            .options(selectinload(EntityChangeProposal.operations))
            .order_by(EntityChangeProposal.created_at.desc(), EntityChangeProposal.id.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def _load_analysis_entities(self, project_id: int) -> dict[str, list[dict[str, Any]]]:
        entities: dict[str, list[dict[str, Any]]] = {}

        rows = await self.db.execute(select(Character).where(Character.project_id == project_id).order_by(Character.id))
        entities["character"] = [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "alignment": row.alignment,
                "organization_id": row.organization_id,
                "abilities": row.abilities,
                "weaknesses": row.weaknesses,
            }
            for row in rows.scalars().all()
        ]

        rows = await self.db.execute(select(Location).where(Location.project_id == project_id).order_by(Location.id))
        entities["location"] = [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "geography": row.geography,
                "culture": row.culture,
            }
            for row in rows.scalars().all()
        ]

        rows = await self.db.execute(select(Organization).where(Organization.project_id == project_id).order_by(Organization.id))
        entities["organization"] = [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "purpose": row.purpose,
                "influence": row.influence,
            }
            for row in rows.scalars().all()
        ]

        rows = await self.db.execute(select(Worldview).where(Worldview.project_id == project_id).order_by(Worldview.id))
        entities["worldview"] = [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "rules": row.rules,
                "magic_system": row.magic_system,
                "technology": row.technology,
            }
            for row in rows.scalars().all()
        ]

        entity_names = {
            (entity_type, item["id"]): item["name"]
            for entity_type in ("character", "location", "organization", "worldview")
            for item in entities.get(entity_type, [])
        }

        rows = await self.db.execute(
            select(EntityRelationship)
            .where(EntityRelationship.project_id == project_id, EntityRelationship.status == "active")
            .order_by(EntityRelationship.updated_at.desc(), EntityRelationship.id.desc())
            .limit(50)
        )
        entities["relationships"] = [
            {
                "source_type": row.source_type,
                "source_id": row.source_id,
                "source_name": entity_names.get((row.source_type, row.source_id)),
                "relation_type": row.relation_type,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "target_name": entity_names.get((row.target_type, row.target_id)),
                "description": row.description,
                "evidence": row.evidence,
                "confidence": row.confidence,
            }
            for row in rows.scalars().all()
        ]

        rows = await self.db.execute(
            select(EntityStateEvent)
            .where(EntityStateEvent.project_id == project_id)
            .order_by(
                nullslast(EntityStateEvent.chapter_order.desc()),
                EntityStateEvent.created_at.desc(),
                EntityStateEvent.id.desc(),
            )
            .limit(50)
        )
        entities["state_events"] = [
            {
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "entity_name": entity_names.get((row.entity_type, row.entity_id)),
                "state_key": row.state_key,
                "old_value": _load_json(row.old_value),
                "new_value": _load_json(row.new_value),
                "summary": row.summary,
                "chapter_id": row.chapter_id,
            }
            for row in rows.scalars().all()
        ]
        return entities

    @staticmethod
    def _chapter_analysis_system_prompt() -> str:
        return (
            "你是 AINovel 的小说知识库维护助手。"
            "你的任务是从稳定章节正文中提取会影响正史知识库的事件级变更提案。"
            "只基于章节内容和已知实体，不要编造不存在的实体。"
            "如果没有明确变化，返回空 proposals。"
            "所有输出必须符合结构化 schema，并以 JSON 对象形式返回（json）。"
        )

    def _build_chapter_analysis_prompt(self, chapter: Chapter, entities: dict[str, list[dict[str, Any]]]) -> str:
        return "\n\n".join(
            [
                "请分析本章是否造成角色、组织、地点、世界观的状态或关系变化。",
                "可用 operation_type：entity_create、entity_field_update、relationship_upsert、relationship_delete、entity_state_event。",
                "章节中首次出现且会影响后续剧情的新角色、组织、地点或世界观设定，使用 entity_create；entity_name 填名称，payload 填可写字段。",
                "同一个 proposal 中，后续 relationship_upsert/entity_state_event 可以用 entity_name/target_name 指向刚 entity_create 的新实体。",
                "字段更新只能使用下面 allowed_fields 中的英文字段名；不确定时优先生成 entity_state_event。",
                "关系建议使用英文 relation_type，例如 ally_of、enemy_of、member_of、controls、located_in、believes_in、affected_by。",
                "关系行为不要靠枚举：需要反向关系时在 payload.policy.inverse_relation_type 写反向 relation_type；需要唯一当前关系时写 payload.policy.exclusive_scope=source_relation 或 target_relation。",
                "状态事件会造成关系收束时，在 payload.relationship_effects 写 [{action:'deactivate', scope:'entity|source|target', relation_type?:'located_in'}]。",
                "每个 proposal 应是一个故事事件，operations 是这个事件造成的具体影响。",
                "低风险元数据（如角色最后出现章节、提及次数、候选标签）请使用 extra_attributes 下的 last_seen_chapter、mention_count、candidate_tags，与正史字段更新区分开。",
                f"章节：第 {chapter.chapter_number} 章《{chapter.title}》",
                f"章节正文：\n{chapter.content or ''}",
                "allowed_fields：\n" + _dump_json({key: sorted(value) for key, value in ENTITY_ALLOWED_FIELDS.items()}),
                "已知实体、已有关系 relationships、最近状态 state_events：\n" + _dump_json(entities),
            ]
        )

    def _proposal_body_from_draft(
        self,
        chapter_id: int,
        draft: KnowledgeProposalDraft,
        entities: dict[str, list[dict[str, Any]]],
    ) -> EntityChangeProposalCreate | None:
        operations: list[ProposalOperationCreate] = []
        created_refs: dict[tuple[str, str], dict[str, str]] = {}
        for operation_draft in draft.operations:
            if operation_draft.operation_type != "entity_create":
                continue
            operation = self._entity_create_operation_from_draft(operation_draft, entities)
            if operation is None or not operation.entity_type or not isinstance(operation.payload, dict):
                continue
            name = str(operation.payload.get("name") or "").strip()
            if name:
                created_refs[(operation.entity_type, name.casefold())] = {
                    "type": operation.entity_type,
                    "name": name,
                }

        for operation_draft in draft.operations:
            operation = self._operation_body_from_draft(operation_draft, entities, created_refs)
            if operation is not None:
                operations.append(operation)

        if not operations:
            return None

        return EntityChangeProposalCreate(
            title=draft.title,
            chapter_id=chapter_id,
            summary=draft.summary,
            evidence=draft.evidence,
            confidence=draft.confidence,
            source=CHAPTER_ANALYSIS_SOURCE,
            raw_payload={"source": CHAPTER_ANALYSIS_SOURCE, "draft": draft.model_dump()},
            operations=operations,
        )

    def _operation_body_from_draft(
        self,
        draft: KnowledgeOperationDraft,
        entities: dict[str, list[dict[str, Any]]],
        created_refs: dict[tuple[str, str], dict[str, str]] | None = None,
    ) -> ProposalOperationCreate | None:
        if draft.operation_type == "entity_create":
            return self._entity_create_operation_from_draft(draft, entities)

        entity_id = self._resolve_entity_id(entities, draft.entity_type, draft.entity_name)
        target_id = self._resolve_entity_id(entities, draft.target_type, draft.target_name)
        payload = dict(draft.payload) if isinstance(draft.payload, dict) else {}
        pending_entity_ref = self._pending_created_ref(created_refs, draft.entity_type, draft.entity_name)
        pending_target_ref = self._pending_created_ref(created_refs, draft.target_type, draft.target_name)

        if draft.operation_type == "entity_state_event" and not entity_id and pending_entity_ref:
            payload["pending_entity_ref"] = pending_entity_ref
        if draft.operation_type == "entity_field_update" and not entity_id:
            return None
        if draft.operation_type == "entity_state_event" and not entity_id and not pending_entity_ref:
            return None
        if draft.operation_type in {"relationship_upsert", "relationship_delete"}:
            if not entity_id and pending_entity_ref:
                payload["pending_source_ref"] = pending_entity_ref
            if not target_id and pending_target_ref:
                payload["pending_target_ref"] = pending_target_ref
            if (not entity_id and not pending_entity_ref) or (not target_id and not pending_target_ref):
                return None
        if draft.operation_type == "entity_field_update":
            if not draft.entity_type or not draft.field_name:
                return None
            if not self._is_allowed_model_field(draft.entity_type, draft.field_name):
                return None

        operation_data = {
            "operation_type": draft.operation_type,
            "entity_type": draft.entity_type,
            "entity_id": entity_id,
            "field_name": draft.field_name,
            "relation_type": draft.relation_type,
            "target_type": draft.target_type,
            "target_id": target_id,
            "state_key": draft.state_key,
            "new_value": draft.new_value,
            "payload": payload,
        }
        if "expected_old_value" in draft.model_fields_set:
            operation_data["expected_old_value"] = draft.expected_old_value
        return ProposalOperationCreate(**operation_data)

    def _entity_create_operation_from_draft(
        self,
        draft: KnowledgeOperationDraft,
        entities: dict[str, list[dict[str, Any]]],
    ) -> ProposalOperationCreate | None:
        if not draft.entity_type:
            return None
        payload = draft.payload if isinstance(draft.payload, dict) else {}
        if not payload and isinstance(draft.new_value, dict):
            payload = draft.new_value
        payload = dict(payload)
        if draft.entity_name and not payload.get("name"):
            payload["name"] = draft.entity_name

        data = self._coerce_entity_create_payload(draft.entity_type, payload)
        if data is None:
            return None
        if self._resolve_entity_id(entities, draft.entity_type, data["name"]):
            return None

        return ProposalOperationCreate(
            operation_type="entity_create",
            entity_type=draft.entity_type,
            payload=data,
        )

    @staticmethod
    def _resolve_entity_id(
        entities: dict[str, list[dict[str, Any]]],
        entity_type: str | None,
        entity_name: str | None,
    ) -> int | None:
        if not entity_type or not entity_name:
            return None
        normalized = entity_name.strip().casefold()
        for item in entities.get(entity_type) or []:
            if str(item.get("name") or "").strip().casefold() == normalized:
                return item.get("id")
        return None

    @staticmethod
    def _pending_created_ref(
        created_refs: dict[tuple[str, str], dict[str, str]] | None,
        entity_type: str | None,
        entity_name: str | None,
    ) -> dict[str, str] | None:
        if not created_refs or not entity_type or not entity_name:
            return None
        return created_refs.get((entity_type, entity_name.strip().casefold()))

    @staticmethod
    def _payload_ref(payload: dict[str, Any], key: str) -> dict[str, str] | None:
        ref = payload.get(key)
        if not isinstance(ref, dict):
            return None
        ref_type = ref.get("type")
        ref_name = ref.get("name")
        if not isinstance(ref_type, str) or not isinstance(ref_name, str) or not ref_name.strip():
            return None
        return {"type": ref_type, "name": ref_name.strip()}

    @staticmethod
    def _operation_has_pending_refs(operation: ProposalOperation) -> bool:
        payload = _load_json(operation.payload) or {}
        if not isinstance(payload, dict):
            return False
        return any(
            key in payload
            for key in ("pending_entity_ref", "pending_source_ref", "pending_target_ref")
        )

    def _resolve_pending_operation_refs(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> None:
        payload = _load_json(operation.payload) or {}
        if not isinstance(payload, dict):
            return

        entity_ref = self._payload_ref(payload, "pending_entity_ref")
        source_ref = self._payload_ref(payload, "pending_source_ref")
        target_ref = self._payload_ref(payload, "pending_target_ref")

        if entity_ref and not operation.entity_id:
            operation.entity_id = self._created_entity_id_from_ref(proposal, entity_ref)
        if source_ref and not operation.entity_id:
            operation.entity_id = self._created_entity_id_from_ref(proposal, source_ref)
        if target_ref and not operation.target_id:
            operation.target_id = self._created_entity_id_from_ref(proposal, target_ref)

    def _created_entity_id_from_ref(self, proposal: EntityChangeProposal, ref: dict[str, str]) -> int:
        ref_type = ref["type"]
        ref_name = ref["name"].strip().casefold()
        for operation in proposal.operations:
            if operation.operation_type != "entity_create" or operation.entity_type != ref_type:
                continue
            data = self._coerce_entity_create_payload(operation.entity_type, _load_json(operation.payload))
            if data and data["name"].strip().casefold() == ref_name and operation.entity_id:
                return operation.entity_id
        raise ValidationError(f"待创建实体尚未应用：{ref['type']}:{ref['name']}")

    async def _build_operation(
        self,
        project_id: int,
        body: ProposalOperationCreate,
        index: int,
    ) -> ProposalOperation:
        await self._validate_operation_refs(project_id, body)
        expected_old_value = body.expected_old_value
        payload = body.payload or {}
        if body.operation_type == "entity_create":
            payload = self._coerce_entity_create_payload(body.entity_type, body.payload) or {}
        if body.operation_type == "entity_field_update" and "expected_old_value" not in body.model_fields_set:
            entity = await self._get_entity(project_id, body.entity_type, body.entity_id)
            expected_old_value = self._read_field_value(entity, body.entity_type, body.field_name)

        return ProposalOperation(
            sort_order=index,
            operation_type=body.operation_type,
            entity_type=body.entity_type,
            entity_id=body.entity_id,
            field_name=body.field_name,
            relation_type=body.relation_type,
            target_type=body.target_type,
            target_id=body.target_id,
            state_key=body.state_key,
            expected_old_value=_dump_json(expected_old_value),
            new_value=_dump_json(body.new_value),
            payload=_dump_json(payload),
        )

    async def _validate_operation_refs(self, project_id: int, body: ProposalOperationCreate) -> None:
        if body.operation_type == "entity_create":
            if not body.entity_type:
                raise ValidationError("实体创建操作缺少 entity_type")
            data = self._coerce_entity_create_payload(body.entity_type, body.payload)
            if data is None:
                raise ValidationError("实体创建操作缺少有效 payload.name")
            if body.entity_type == "character" and data.get("organization_id") is not None:
                await self._get_entity(project_id, "organization", data["organization_id"])
            return

        payload = body.payload or {}
        if body.operation_type in {"entity_field_update", "entity_state_event"}:
            pending_entity_ref = self._payload_ref(payload, "pending_entity_ref")
            if not body.entity_type or (not body.entity_id and not pending_entity_ref):
                raise ValidationError("子操作缺少实体引用")
            if body.entity_id:
                await self._get_entity(project_id, body.entity_type, body.entity_id)

        if body.operation_type == "entity_field_update":
            if not body.field_name:
                raise ValidationError("字段更新操作缺少 field_name")
            self._ensure_allowed_field(body.entity_type, body.field_name)
            if body.entity_type == "character" and body.field_name == "organization_id":
                organization_id = self._coerce_optional_organization_id(body.new_value)
                if organization_id is not None:
                    await self._get_entity(project_id, "organization", organization_id)

        if body.operation_type == "entity_state_event" and not body.state_key:
            raise ValidationError("状态事件操作缺少 state_key")

        if body.operation_type in {"relationship_upsert", "relationship_delete"}:
            pending_source_ref = self._payload_ref(payload, "pending_source_ref")
            pending_target_ref = self._payload_ref(payload, "pending_target_ref")
            has_source = bool(body.entity_type and (body.entity_id or pending_source_ref))
            has_target = bool(body.target_type and (body.target_id or pending_target_ref))
            if not all([has_source, body.relation_type, has_target]):
                raise ValidationError("关系操作缺少 source/target/relation_type")
            if body.entity_id:
                await self._get_entity(project_id, body.entity_type, body.entity_id)
            if body.target_id:
                await self._get_entity(project_id, body.target_type, body.target_id)

    async def _detect_conflict(self, project_id: int, operation: ProposalOperation) -> str | None:
        if operation.operation_type == "entity_create":
            data = self._coerce_entity_create_payload(operation.entity_type, _load_json(operation.payload))
            if data is None:
                return "实体创建数据无效"
            existing = await self._find_entity_by_name(project_id, operation.entity_type, data["name"])
            if existing is not None:
                return f"同名实体已存在：{data['name']}"
            return await self._detect_pending_operation_conflict(project_id, operation)

        if self._operation_has_pending_refs(operation):
            return None

        if operation.operation_type == "entity_field_update":
            entity = await self._get_entity(project_id, operation.entity_type, operation.entity_id)
            expected = _load_json(operation.expected_old_value)
            current = self._read_field_value(entity, operation.entity_type, operation.field_name)
            if current != expected:
                return f"字段 {operation.field_name} 当前值已变化"
            return await self._detect_pending_operation_conflict(project_id, operation)

        if operation.operation_type == "relationship_delete":
            relationship = await self._find_relationship(project_id, operation)
            if relationship is None or relationship.status != "active":
                return "要删除的关系不存在或已失效"
            return await self._detect_pending_operation_conflict(project_id, operation)

        if operation.operation_type == "relationship_upsert":
            return await self._detect_pending_operation_conflict(project_id, operation)

        if operation.operation_type == "entity_state_event":
            return await self._detect_pending_operation_conflict(project_id, operation)

        return None

    async def _detect_pending_operation_conflict(self, project_id: int, operation: ProposalOperation) -> str | None:
        proposal_status_filter = EntityChangeProposal.status.in_(ACTIVE_PROPOSAL_STATUSES)
        operation_status_filter = ProposalOperation.status.in_(ACTIVE_OPERATION_STATUSES)
        stmt = (
            select(ProposalOperation.id)
            .join(EntityChangeProposal)
            .where(
                EntityChangeProposal.project_id == project_id,
                ProposalOperation.id != operation.id,
                ProposalOperation.proposal_id != operation.proposal_id,
                proposal_status_filter,
                operation_status_filter,
            )
            .limit(1)
        )

        if operation.operation_type == "entity_create":
            data = self._coerce_entity_create_payload(operation.entity_type, _load_json(operation.payload))
            if data is None:
                return "实体创建数据无效"
            create_stmt = (
                select(ProposalOperation)
                .join(EntityChangeProposal)
                .where(
                    EntityChangeProposal.project_id == project_id,
                    ProposalOperation.id != operation.id,
                    ProposalOperation.proposal_id != operation.proposal_id,
                    proposal_status_filter,
                    operation_status_filter,
                    ProposalOperation.operation_type == "entity_create",
                    ProposalOperation.entity_type == operation.entity_type,
                )
            )
            result = await self.db.execute(create_stmt)
            normalized_name = data["name"].strip().casefold()
            for other in result.scalars().all():
                other_data = self._coerce_entity_create_payload(other.entity_type, _load_json(other.payload))
                if other_data and other_data["name"].strip().casefold() == normalized_name:
                    return "存在另一个待处理提案创建同名实体"
            return None

        if operation.operation_type == "entity_field_update":
            stmt = stmt.where(
                ProposalOperation.operation_type == "entity_field_update",
                ProposalOperation.entity_type == operation.entity_type,
                ProposalOperation.entity_id == operation.entity_id,
                ProposalOperation.field_name == operation.field_name,
            )
        elif operation.operation_type in {"relationship_upsert", "relationship_delete"}:
            stmt = stmt.where(
                ProposalOperation.operation_type.in_(("relationship_upsert", "relationship_delete")),
                ProposalOperation.entity_type == operation.entity_type,
                ProposalOperation.entity_id == operation.entity_id,
                ProposalOperation.relation_type == operation.relation_type,
                ProposalOperation.target_type == operation.target_type,
                ProposalOperation.target_id == operation.target_id,
            )
        elif operation.operation_type == "entity_state_event":
            stmt = stmt.where(
                ProposalOperation.operation_type == "entity_state_event",
                ProposalOperation.entity_type == operation.entity_type,
                ProposalOperation.entity_id == operation.entity_id,
                ProposalOperation.state_key == operation.state_key,
            )
        else:
            return None

        result = await self.db.execute(stmt)
        return "存在另一个待处理提案修改同一目标" if result.scalar_one_or_none() is not None else None

    async def _apply_operation(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> bool:
        if operation.operation_type == "entity_create":
            await self._apply_entity_create(proposal, operation)
            return True
        if operation.operation_type in {"relationship_upsert", "relationship_delete", "entity_state_event"}:
            self._resolve_pending_operation_refs(proposal, operation)
        if operation.operation_type == "entity_field_update":
            await self._apply_field_update(proposal, operation)
            return True
        if operation.operation_type == "relationship_upsert":
            await self._apply_relationship_upsert(proposal, operation)
            return True
        if operation.operation_type == "relationship_delete":
            return await self._apply_relationship_delete(proposal, operation)
        if operation.operation_type == "entity_state_event":
            await self._apply_state_event(proposal, operation)
            return True
        raise ValidationError(f"不支持的子操作类型：{operation.operation_type}")

    async def _apply_entity_create(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> None:
        data = self._coerce_entity_create_payload(operation.entity_type, _load_json(operation.payload))
        if data is None:
            raise ValidationError("实体创建数据无效")
        model = ENTITY_MODELS.get(operation.entity_type)
        if model is None:
            raise ValidationError("实体类型无效")

        entity = model(**data, project_id=proposal.project_id)
        self.db.add(entity)
        await self.db.flush()
        operation.entity_id = entity.id

        chapter_order = await self._chapter_order(proposal.project_id, proposal.chapter_id)
        self.db.add(
            EntityStateEvent(
                project_id=proposal.project_id,
                chapter_id=proposal.chapter_id,
                entity_type=operation.entity_type,
                entity_id=entity.id,
                state_key="created",
                old_value=None,
                new_value=_dump_json(data),
                summary=f"创建实体：{data['name']}",
                evidence=proposal.evidence,
                confidence=proposal.confidence,
                source=proposal.source,
                proposal_id=proposal.id,
                proposal_operation_id=operation.id,
                chapter_order=chapter_order,
            )
        )

    async def _apply_field_update(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> None:
        entity = await self._get_entity(proposal.project_id, operation.entity_type, operation.entity_id)
        if not hasattr(type(entity), operation.field_name):
            logger.warning(
                "Entity %s has no attribute %s; skipping field update",
                operation.entity_type,
                operation.field_name,
            )
            return
        old_value = self._read_field_value(entity, operation.entity_type, operation.field_name)
        value = _load_json(operation.new_value)
        setattr(
            entity,
            operation.field_name,
            self._coerce_field_value(operation.entity_type, operation.field_name, value),
        )

        # 字段更新同步落入状态时间线，使"这章之后实体变成什么"可追溯
        chapter_order = await self._chapter_order(proposal.project_id, proposal.chapter_id)
        self.db.add(
            EntityStateEvent(
                project_id=proposal.project_id,
                chapter_id=proposal.chapter_id,
                entity_type=operation.entity_type,
                entity_id=operation.entity_id,
                state_key=operation.field_name,
                old_value=_serialize_state_value(operation.entity_type, operation.field_name, old_value),
                new_value=operation.new_value,
                summary=f"字段更新：{operation.field_name}",
                source=proposal.source,
                proposal_id=proposal.id,
                proposal_operation_id=operation.id,
                chapter_order=chapter_order,
            )
        )
        await self._sync_member_of_from_organization_field(proposal, operation, old_value, value)

    async def _apply_relationship_upsert(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
    ) -> None:
        payload = _load_json(operation.payload) or {}
        if not isinstance(payload, dict):
            payload = {}
        policy = self._relationship_policy(operation, payload)
        relationship = await self._upsert_relationship_record(
            proposal,
            operation,
            source_type=operation.entity_type,
            source_id=operation.entity_id,
            relation_type=operation.relation_type,
            target_type=operation.target_type,
            target_id=operation.target_id,
            payload=payload,
        )
        await self._sync_exclusive_relationship_upsert(proposal, operation, relationship, policy)
        await self._sync_inverse_relationship_upsert(proposal, operation, relationship, payload, policy)
        await self._sync_organization_field_from_member_of_upsert(proposal, operation, relationship)

    async def _upsert_relationship_record(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        *,
        source_type: str | None,
        source_id: int | None,
        relation_type: str | None,
        target_type: str | None,
        target_id: int | None,
        payload: dict[str, Any],
    ) -> EntityRelationship:
        relationship = await self._find_relationship_by_refs(
            proposal.project_id,
            source_type=source_type,
            source_id=source_id,
            relation_type=relation_type,
            target_type=target_type,
            target_id=target_id,
        )
        if relationship is None:
            relationship = EntityRelationship(
                project_id=proposal.project_id,
                source_type=source_type,
                source_id=source_id,
                relation_type=relation_type,
                target_type=target_type,
                target_id=target_id,
            )
            self.db.add(relationship)

        relationship.status = payload.get("status") or "active"
        relationship.description = payload.get("description")
        relationship.evidence = payload.get("evidence") or proposal.evidence
        relationship.confidence = payload.get("confidence", proposal.confidence)
        relationship.properties = _dump_json(payload.get("properties") or {})
        relationship.source = proposal.source
        # Bug 6: 仅当无溯源时才写 proposal_id，避免重激活时覆盖原创建者
        if relationship.proposal_id is None:
            relationship.proposal_id = proposal.id
            relationship.proposal_operation_id = operation.id
        return relationship

    async def _apply_relationship_delete(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> bool:
        payload = _load_json(operation.payload) or {}
        if not isinstance(payload, dict):
            payload = {}
        policy = self._relationship_policy(operation, payload)
        relationship = await self._find_relationship(proposal.project_id, operation)
        if relationship is not None:
            await self._deactivate_relationship(relationship, operation)
            await self._sync_inverse_relationship_delete(proposal, operation, policy)
            await self._sync_organization_field_from_member_of_delete(proposal, operation)
            return True
        return False

    async def _sync_exclusive_relationship_upsert(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        relationship: EntityRelationship,
        policy: dict[str, Any],
    ) -> None:
        exclusive_scope = policy.get("exclusive_scope")
        if relationship.status != "active" or not exclusive_scope:
            return
        if exclusive_scope == "source_relation":
            await self._deactivate_source_relationships(
                proposal.project_id,
                source_type=operation.entity_type,
                source_id=operation.entity_id,
                relation_type=operation.relation_type,
                operation=operation,
                keep_target_type=operation.target_type,
                keep_target_id=operation.target_id,
            )
        elif exclusive_scope == "target_relation":
            await self._deactivate_target_relationships(
                proposal.project_id,
                target_type=operation.target_type,
                target_id=operation.target_id,
                relation_type=operation.relation_type,
                operation=operation,
                keep_source_type=operation.entity_type,
                keep_source_id=operation.entity_id,
            )

    async def _sync_inverse_relationship_upsert(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        relationship: EntityRelationship,
        payload: dict[str, Any],
        policy: dict[str, Any],
    ) -> None:
        if relationship.status != "active":
            return
        inverse_relation_type = self._inverse_relation_type(operation, policy)
        if inverse_relation_type is None or self._is_self_inverse_ref(operation, inverse_relation_type):
            return
        properties = payload.get("properties") if isinstance(payload.get("properties"), dict) else {}
        inverse_payload = {
            **payload,
            "status": "active",
            "properties": {
                **properties,
                "synced_from": "inverse_relationship",
                "source_operation_id": operation.id,
                "source_relation_type": operation.relation_type,
            },
        }
        await self._upsert_relationship_record(
            proposal,
            operation,
            source_type=operation.target_type,
            source_id=operation.target_id,
            relation_type=inverse_relation_type,
            target_type=operation.entity_type,
            target_id=operation.entity_id,
            payload=inverse_payload,
        )

    async def _sync_inverse_relationship_delete(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        policy: dict[str, Any],
    ) -> None:
        inverse_relation_type = self._inverse_relation_type(operation, policy)
        if inverse_relation_type is None or self._is_self_inverse_ref(operation, inverse_relation_type):
            return
        inverse = await self._find_relationship_by_refs(
            proposal.project_id,
            source_type=operation.target_type,
            source_id=operation.target_id,
            relation_type=inverse_relation_type,
            target_type=operation.entity_type,
            target_id=operation.entity_id,
        )
        if inverse is not None:
            await self._deactivate_relationship(inverse, operation, sync_inverse=False)

    async def _sync_member_of_from_organization_field(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        old_value: Any,
        new_value: Any,
    ) -> None:
        if operation.entity_type != "character" or operation.field_name != "organization_id":
            return
        old_org_id = self._coerce_optional_organization_id(old_value)
        new_org_id = self._coerce_optional_organization_id(new_value)
        if old_org_id == new_org_id:
            return

        if new_org_id is not None:
            await self._upsert_relationship_record(
                proposal,
                operation,
                source_type="character",
                source_id=operation.entity_id,
                relation_type="member_of",
                target_type="organization",
                target_id=new_org_id,
                payload={"status": "active", "properties": {"synced_from": "character.organization_id"}},
            )

    async def _sync_organization_field_from_member_of_upsert(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        relationship: EntityRelationship,
    ) -> None:
        if not self._is_character_member_of_operation(operation) or relationship.status != "active":
            return
        character = await self._get_entity(proposal.project_id, "character", operation.entity_id)
        old_org_id = character.organization_id
        if old_org_id is not None:
            return
        character.organization_id = operation.target_id
        await self._add_synced_organization_state_event(proposal, operation, old_org_id, operation.target_id)

    async def _sync_organization_field_from_member_of_delete(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
    ) -> None:
        if not self._is_character_member_of_operation(operation):
            return
        character = await self._get_entity(proposal.project_id, "character", operation.entity_id)
        if character.organization_id != operation.target_id:
            return
        old_org_id = character.organization_id
        fallback_relationship = await self._find_active_member_of_relationship(proposal.project_id, operation.entity_id)
        new_org_id = fallback_relationship.target_id if fallback_relationship else None
        character.organization_id = new_org_id
        await self._add_synced_organization_state_event(proposal, operation, old_org_id, new_org_id)

    async def _find_active_member_of_relationship(
        self,
        project_id: int,
        character_id: int | None,
    ) -> EntityRelationship | None:
        if character_id is None:
            return None
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.source_type == "character",
            EntityRelationship.source_id == character_id,
            EntityRelationship.relation_type == "member_of",
            EntityRelationship.target_type == "organization",
            EntityRelationship.status == "active",
        )
        stmt = stmt.order_by(EntityRelationship.updated_at.desc(), EntityRelationship.id.desc()).limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _add_synced_organization_state_event(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
        old_org_id: int | None,
        new_org_id: int | None,
    ) -> None:
        chapter_order = await self._chapter_order(proposal.project_id, proposal.chapter_id)
        self.db.add(
            EntityStateEvent(
                project_id=proposal.project_id,
                chapter_id=proposal.chapter_id,
                entity_type="character",
                entity_id=operation.entity_id,
                state_key="organization_id",
                old_value=_dump_json(old_org_id),
                new_value=_dump_json(new_org_id),
                summary="同步组织归属关系",
                evidence=proposal.evidence,
                confidence=proposal.confidence,
                source=proposal.source,
                proposal_id=proposal.id,
                proposal_operation_id=operation.id,
                chapter_order=chapter_order,
            )
        )

    async def _apply_state_event(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
    ) -> None:
        payload = _load_json(operation.payload) or {}
        chapter_order = await self._chapter_order(proposal.project_id, proposal.chapter_id)
        state_event = EntityStateEvent(
            project_id=proposal.project_id,
            chapter_id=proposal.chapter_id,
            entity_type=operation.entity_type,
            entity_id=operation.entity_id,
            state_key=operation.state_key,
            old_value=operation.expected_old_value,
            new_value=operation.new_value,
            summary=payload.get("summary") or proposal.summary,
            evidence=payload.get("evidence") or proposal.evidence,
            confidence=payload.get("confidence", proposal.confidence),
            source=proposal.source,
            metadata_json=_dump_json(payload.get("metadata") or {}),
            proposal_id=proposal.id,
            proposal_operation_id=operation.id,
            chapter_order=chapter_order,
        )
        self.db.add(state_event)
        await self._sync_terminal_state_effects(proposal, operation)

    async def _find_relationship(self, project_id: int, operation: ProposalOperation) -> EntityRelationship | None:
        return await self._find_relationship_by_refs(
            project_id,
            source_type=operation.entity_type,
            source_id=operation.entity_id,
            relation_type=operation.relation_type,
            target_type=operation.target_type,
            target_id=operation.target_id,
        )

    async def _find_relationship_by_refs(
        self,
        project_id: int,
        *,
        source_type: str | None,
        source_id: int | None,
        relation_type: str | None,
        target_type: str | None,
        target_id: int | None,
    ) -> EntityRelationship | None:
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.source_type == source_type,
            EntityRelationship.source_id == source_id,
            EntityRelationship.relation_type == relation_type,
            EntityRelationship.target_type == target_type,
            EntityRelationship.target_id == target_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    def _relationship_policy(cls, operation: ProposalOperation, payload: dict[str, Any]) -> dict[str, Any]:
        policy = dict(DEFAULT_RELATION_POLICIES.get(operation.relation_type) or {})
        raw_policy = payload.get("policy") if isinstance(payload, dict) else None
        if isinstance(raw_policy, dict):
            policy.update(raw_policy)
        if isinstance(payload, dict):
            for key in ("inverse_relation_type", "exclusive_scope"):
                if key in payload:
                    policy[key] = payload[key]
            if "inverse" in payload and "inverse_relation_type" not in policy:
                policy["inverse_relation_type"] = payload["inverse"]
        return policy

    @staticmethod
    def _inverse_relation_type(operation: ProposalOperation, policy: dict[str, Any]) -> str | None:
        inverse = policy.get("inverse_relation_type")
        if inverse is True or inverse == "same":
            return operation.relation_type
        if isinstance(inverse, str) and inverse.strip():
            return inverse.strip()
        return None

    @staticmethod
    def _is_self_inverse_ref(operation: ProposalOperation, inverse_relation_type: str) -> bool:
        return (
            inverse_relation_type == operation.relation_type
            and operation.entity_type == operation.target_type
            and operation.entity_id == operation.target_id
        )

    async def _deactivate_source_relationships(
        self,
        project_id: int,
        *,
        source_type: str | None,
        source_id: int | None,
        relation_type: str | None,
        operation: ProposalOperation,
        keep_target_type: str | None = None,
        keep_target_id: int | None = None,
    ) -> None:
        if not source_type or not source_id:
            return
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.source_type == source_type,
            EntityRelationship.source_id == source_id,
            EntityRelationship.status == "active",
        )
        if relation_type:
            stmt = stmt.where(EntityRelationship.relation_type == relation_type)
        result = await self.db.execute(stmt)
        for relationship in result.scalars().all():
            if relationship.target_type == keep_target_type and relationship.target_id == keep_target_id:
                continue
            await self._deactivate_relationship(relationship, operation)

    async def _deactivate_target_relationships(
        self,
        project_id: int,
        *,
        target_type: str | None,
        target_id: int | None,
        relation_type: str | None,
        operation: ProposalOperation,
        keep_source_type: str | None = None,
        keep_source_id: int | None = None,
    ) -> None:
        if not target_type or not target_id:
            return
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.target_type == target_type,
            EntityRelationship.target_id == target_id,
            EntityRelationship.status == "active",
        )
        if relation_type:
            stmt = stmt.where(EntityRelationship.relation_type == relation_type)
        result = await self.db.execute(stmt)
        for relationship in result.scalars().all():
            if relationship.source_type == keep_source_type and relationship.source_id == keep_source_id:
                continue
            await self._deactivate_relationship(relationship, operation)

    async def _deactivate_entity_relationships(
        self,
        project_id: int,
        *,
        entity_type: str | None,
        entity_id: int | None,
        operation: ProposalOperation,
    ) -> None:
        if not entity_type or not entity_id:
            return
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.status == "active",
            or_(
                (EntityRelationship.source_type == entity_type) & (EntityRelationship.source_id == entity_id),
                (EntityRelationship.target_type == entity_type) & (EntityRelationship.target_id == entity_id),
            ),
        )
        result = await self.db.execute(stmt)
        for relationship in result.scalars().all():
            await self._deactivate_relationship(relationship, operation)

    async def _deactivate_relationship(
        self,
        relationship: EntityRelationship,
        operation: ProposalOperation,
        *,
        sync_inverse: bool = True,
    ) -> None:
        original_operation_id = relationship.proposal_operation_id
        relationship.status = "inactive"
        relationship.proposal_operation_id = operation.id
        if sync_inverse:
            await self._deactivate_synced_inverse_relationships(
                relationship,
                operation,
                original_operation_id=original_operation_id,
            )

    async def _deactivate_synced_inverse_relationships(
        self,
        relationship: EntityRelationship,
        operation: ProposalOperation,
        *,
        original_operation_id: int | None,
    ) -> None:
        if not relationship.target_type or not relationship.target_id:
            return
        if not relationship.source_type or not relationship.source_id:
            return
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == relationship.project_id,
            EntityRelationship.source_type == relationship.target_type,
            EntityRelationship.source_id == relationship.target_id,
            EntityRelationship.target_type == relationship.source_type,
            EntityRelationship.target_id == relationship.source_id,
            EntityRelationship.status == "active",
        )
        result = await self.db.execute(stmt)
        legacy_candidates: list[EntityRelationship] = []
        matched: list[EntityRelationship] = []
        for inverse in result.scalars().all():
            properties = _load_json(inverse.properties) or {}
            if not isinstance(properties, dict) or properties.get("synced_from") != "inverse_relationship":
                continue
            source_relation_type = properties.get("source_relation_type")
            source_operation_id = properties.get("source_operation_id")
            if source_relation_type == relationship.relation_type or (
                original_operation_id is not None and source_operation_id == original_operation_id
            ):
                matched.append(inverse)
            elif source_relation_type is None and source_operation_id is None:
                legacy_candidates.append(inverse)

        if not matched and len(legacy_candidates) == 1:
            matched = legacy_candidates
        for inverse in matched:
            inverse.status = "inactive"
            inverse.proposal_operation_id = operation.id

    async def _sync_terminal_state_effects(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
    ) -> None:
        for effect in self._state_relationship_effects(operation):
            if effect.get("action") != "deactivate":
                continue
            scope = effect.get("scope")
            relation_type = effect.get("relation_type")
            if scope == "entity":
                await self._deactivate_entity_relationships(
                    proposal.project_id,
                    entity_type=operation.entity_type,
                    entity_id=operation.entity_id,
                    operation=operation,
                )
            elif scope == "source":
                await self._deactivate_source_relationships(
                    proposal.project_id,
                    source_type=operation.entity_type,
                    source_id=operation.entity_id,
                    relation_type=relation_type,
                    operation=operation,
                )
            elif scope == "target":
                await self._deactivate_target_relationships(
                    proposal.project_id,
                    target_type=operation.entity_type,
                    target_id=operation.entity_id,
                    relation_type=relation_type,
                    operation=operation,
                )

    @classmethod
    def _state_relationship_effects(cls, operation: ProposalOperation) -> list[dict[str, Any]]:
        payload = _load_json(operation.payload) or {}
        if not isinstance(payload, dict):
            payload = {}
        effects = []
        raw_effects = payload.get("relationship_effects")
        if isinstance(raw_effects, dict):
            effects.append(raw_effects)
        elif isinstance(raw_effects, list):
            effects.extend(effect for effect in raw_effects if isinstance(effect, dict))
        if effects:
            return effects
        default_action = cls._default_terminal_state_action(operation)
        return list(DEFAULT_TERMINAL_RELATIONSHIP_EFFECTS.get(default_action) or [])

    @classmethod
    def _default_terminal_state_action(cls, operation: ProposalOperation) -> str | None:
        if operation.operation_type != "entity_state_event" or operation.state_key not in TERMINAL_STATE_KEYS:
            return None
        value_text = cls._state_value_text(operation.new_value)
        if any(marker in value_text for marker in ASCENDED_STATE_MARKERS):
            return "ascended"
        if any(marker in value_text for marker in DESTROYED_STATE_MARKERS):
            return "destroyed"
        return None

    @staticmethod
    def _state_value_text(value: Any) -> str:
        parsed = _load_json(value) if isinstance(value, str) else value
        if isinstance(parsed, str):
            return parsed.casefold()
        if parsed is None:
            return ""
        return _dump_json(parsed).casefold()

    @staticmethod
    def _is_character_member_of_operation(operation: ProposalOperation) -> bool:
        return (
            operation.entity_type == "character"
            and operation.relation_type == "member_of"
            and operation.target_type == "organization"
        )

    async def _get_entity(self, project_id: int, entity_type: str | None, entity_id: int | None):
        if not entity_type or not entity_id or entity_type not in ENTITY_MODELS:
            raise ValidationError("实体引用无效")
        model = ENTITY_MODELS[entity_type]
        result = await self.db.execute(select(model).where(model.project_id == project_id, model.id == entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError("实体不存在或不属于当前项目")
        return entity

    async def _require_chapter(self, project_id: int, chapter_id: int | None) -> Chapter | None:
        if chapter_id is None:
            return None
        result = await self.db.execute(
            select(Chapter).where(Chapter.project_id == project_id, Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            raise NotFoundError("章节不存在或不属于当前项目")
        return chapter

    async def _chapter_order(self, project_id: int, chapter_id: int | None) -> int | None:
        """取章节叙事时序（order_index），用于状态事件按故事顺序排列。"""
        if chapter_id is None:
            return None
        result = await self.db.execute(
            select(Chapter.order_index).where(Chapter.project_id == project_id, Chapter.id == chapter_id)
        )
        return result.scalar_one_or_none()

    def _is_metadata_operation(self, draft: KnowledgeOperationDraft) -> bool:
        """判定 operation 是否为低风险元数据（可自动直写 extra_attributes 子键）。"""
        if draft.operation_type != "entity_field_update":
            return False
        if draft.field_name != "extra_attributes":
            return False
        if not isinstance(draft.new_value, dict):
            return False
        allowed_keys = {"last_seen_chapter", "mention_count", "candidate_tags"}
        return set(draft.new_value.keys()) <= allowed_keys

    async def _apply_metadata_update(
        self,
        project_id: int,
        entity_type: str | None,
        entity_id: int | None,
        metadata_dict: dict[str, Any],
        *,
        chapter_id: int | None,
        source: str,
    ) -> int:
        """自动直写元数据到实体 extra_attributes。仅对 character 生效。

        将 metadata_dict 合并进现有 extra_attributes（新覆盖旧，保留其他键）。
        每改一个子键写一条 EntityStateEvent 审计。

        Returns number of keys applied. 0 means should fall through to proposal.
        """
        if entity_type != "character" or entity_id is None:
            return 0

        entity = await self._get_entity(project_id, entity_type, entity_id)
        extra = _load_json(getattr(entity, "extra_attributes", None)) or {}
        if not isinstance(extra, dict):
            extra = {}

        chapter_order = await self._chapter_order(project_id, chapter_id)

        applied_count = 0
        for key, new_val in metadata_dict.items():
            old_val = extra.get(key)
            extra[key] = new_val
            applied_count += 1
            self.db.add(
                EntityStateEvent(
                    project_id=project_id,
                    chapter_id=chapter_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    state_key=f"extra_attributes.{key}",
                    old_value=_serialize_state_value(entity_type, "extra_attributes", old_val),
                    new_value=_dump_json(new_val),
                    summary=f"元数据更新：extra_attributes.{key}",
                    source=source,
                    proposal_id=None,
                    proposal_operation_id=None,
                    chapter_order=chapter_order,
                )
            )

        entity.extra_attributes = _dump_json(extra)
        return applied_count

    async def _get_proposal_for_user(self, proposal_id: int, user_id: int) -> EntityChangeProposal:
        stmt = (
            select(EntityChangeProposal)
            .join(Project)
            .where(EntityChangeProposal.id == proposal_id, Project.user_id == user_id)
            .options(selectinload(EntityChangeProposal.operations))
        )
        result = await self.db.execute(stmt)
        proposal = result.scalar_one_or_none()
        if proposal is None:
            raise NotFoundError("变更提案不存在或无权访问")
        return proposal

    @staticmethod
    def _is_allowed_model_field(entity_type: str | None, field_name: str | None) -> bool:
        if not entity_type or not field_name:
            return False
        if field_name not in ENTITY_ALLOWED_FIELDS.get(entity_type, set()):
            return False
        model = ENTITY_MODELS.get(entity_type)
        return model is not None and hasattr(model, field_name)

    @classmethod
    def _coerce_entity_create_payload(
        cls,
        entity_type: str | None,
        payload: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if not entity_type or entity_type not in ENTITY_MODELS or not isinstance(payload, dict):
            return None

        data: dict[str, Any] = {}
        for field_name, value in payload.items():
            if value is None or not cls._is_allowed_model_field(entity_type, field_name):
                continue
            if field_name == "name":
                name = str(value).strip()
                if name:
                    data[field_name] = name
                continue
            if (entity_type, field_name) in JSON_TEXT_FIELDS:
                data[field_name] = value if isinstance(value, str) else _dump_json(value)
                continue
            if entity_type == "character" and field_name == "organization_id":
                try:
                    data[field_name] = int(value)
                except (TypeError, ValueError):
                    return None
                continue
            data[field_name] = value if isinstance(value, str) else str(value)

        return data if data.get("name") else None

    async def _find_entity_by_name(self, project_id: int, entity_type: str | None, name: str | None):
        if not entity_type or entity_type not in ENTITY_MODELS or not name:
            return None
        model = ENTITY_MODELS[entity_type]
        result = await self.db.execute(
            select(model).where(
                model.project_id == project_id,
                func.lower(model.name) == name.strip().casefold(),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _ensure_allowed_field(entity_type: str | None, field_name: str) -> None:
        if not KnowledgeGraphService._is_allowed_model_field(entity_type, field_name):
            raise ValidationError("该实体字段不允许通过提案更新")

    def _read_field_value(self, entity, entity_type: str | None, field_name: str | None) -> Any:
        if not entity_type or not field_name:
            raise ValidationError("字段引用无效")
        self._ensure_allowed_field(entity_type, field_name)
        if not hasattr(type(entity), field_name):
            return None
        raw = getattr(entity, field_name)
        if (entity_type, field_name) in JSON_TEXT_FIELDS:
            return _load_json(raw)
        return raw

    @staticmethod
    def _coerce_field_value(entity_type: str | None, field_name: str | None, value: Any) -> Any:
        if value is None:
            return None
        if (entity_type, field_name) in JSON_TEXT_FIELDS:
            return _dump_json(value)
        if entity_type == "character" and field_name == "organization_id":
            return KnowledgeGraphService._coerce_optional_organization_id(value)
        return value if isinstance(value, str) else str(value)

    @staticmethod
    def _coerce_optional_organization_id(value: Any) -> int | None:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError("组织引用无效") from exc

    @staticmethod
    def _proposal_status_after_operations(operations: list[ProposalOperation]) -> str:
        statuses = {operation.status for operation in operations}
        if "conflicted" in statuses:
            return "conflicted"
        if statuses <= {"accepted", "rejected"}:
            return "accepted" if "accepted" in statuses else "rejected"
        return "pending"

    def _proposal_response(self, proposal: EntityChangeProposal) -> EntityChangeProposalResponse:
        return EntityChangeProposalResponse(
            id=proposal.id,
            project_id=proposal.project_id,
            chapter_id=proposal.chapter_id,
            title=proposal.title,
            summary=proposal.summary,
            evidence=proposal.evidence,
            confidence=proposal.confidence,
            status=proposal.status,
            source=proposal.source,
            raw_payload=_load_json(proposal.raw_payload),
            reviewed_at=proposal.reviewed_at,
            created_at=proposal.created_at,
            updated_at=proposal.updated_at,
            operations=[self._operation_response(operation) for operation in proposal.operations],
        )

    @staticmethod
    def _operation_response(operation: ProposalOperation) -> ProposalOperationResponse:
        return ProposalOperationResponse(
            id=operation.id,
            proposal_id=operation.proposal_id,
            sort_order=operation.sort_order,
            operation_type=operation.operation_type,
            status=operation.status,
            entity_type=operation.entity_type,
            entity_id=operation.entity_id,
            field_name=operation.field_name,
            relation_type=operation.relation_type,
            target_type=operation.target_type,
            target_id=operation.target_id,
            state_key=operation.state_key,
            expected_old_value=_load_json(operation.expected_old_value),
            new_value=_load_json(operation.new_value),
            payload=_load_json(operation.payload),
            conflict_reason=operation.conflict_reason,
            applied_at=operation.applied_at,
            created_at=operation.created_at,
            updated_at=operation.updated_at,
        )

    @staticmethod
    def _relationship_response(relationship: EntityRelationship) -> EntityRelationshipResponse:
        return EntityRelationshipResponse(
            id=relationship.id,
            project_id=relationship.project_id,
            source_type=relationship.source_type,
            source_id=relationship.source_id,
            relation_type=relationship.relation_type,
            target_type=relationship.target_type,
            target_id=relationship.target_id,
            status=relationship.status,
            description=relationship.description,
            evidence=relationship.evidence,
            confidence=relationship.confidence,
            properties=_load_json(relationship.properties),
            source=relationship.source,
            proposal_id=relationship.proposal_id,
            proposal_operation_id=relationship.proposal_operation_id,
            created_at=relationship.created_at,
            updated_at=relationship.updated_at,
        )

    @staticmethod
    def _state_event_response(state_event: EntityStateEvent) -> EntityStateEventResponse:
        return EntityStateEventResponse(
            id=state_event.id,
            project_id=state_event.project_id,
            chapter_id=state_event.chapter_id,
            entity_type=state_event.entity_type,
            entity_id=state_event.entity_id,
            state_key=state_event.state_key,
            old_value=_load_json(state_event.old_value),
            new_value=_load_json(state_event.new_value),
            summary=state_event.summary,
            evidence=state_event.evidence,
            confidence=state_event.confidence,
            source=state_event.source,
            metadata=_load_json(state_event.metadata_json),
            proposal_id=state_event.proposal_id,
            proposal_operation_id=state_event.proposal_operation_id,
            created_at=state_event.created_at,
            updated_at=state_event.updated_at,
        )


async def _run_chapter_analysis_background(
    run_id: int,
    project_id: int,
    chapter_id: int,
    user_id: int,
    model_config_id: int,
    *,
    _db_session: AsyncSession | None = None,
) -> None:
    """章节知识分析后台任务。支持注入 _db_session 供测试使用。"""
    if _db_session is not None:
        session = _db_session
        should_close = False
    else:
        from app.infrastructure.db.session import get_session_factory

        session_factory = get_session_factory()
        session = session_factory()
        should_close = True

    run: AIRun | None = None
    try:
        result = await session.execute(select(AIRun).where(AIRun.id == run_id))
        run = result.scalar_one_or_none()
        if run is None:
            logger.error("AIRun %s not found in background task", run_id)
            return

        run.status = RunStatus.RUNNING.value
        run.started_at = _now()
        await session.commit()

        async with _CHAPTER_ANALYSIS_SEMAPHORE:
            service = KnowledgeGraphService(session)
            await service.analyze_chapter(
                project_id,
                chapter_id,
                user_id,
                model_config_id=model_config_id,
            )

        run.status = RunStatus.SUCCEEDED.value
        run.finished_at = _now()
        await session.commit()
        logger.info(
            "Chapter analysis background task succeeded run=%s chapter=%s",
            run_id,
            chapter_id,
        )
    except asyncio.CancelledError:
        # BackgroundTaskRunner 的 wait_for 超时会取消本协程并抛 CancelledError。
        # 此前直接 raise 会留下 AIRun=running（悬空状态），需在此标记 failed。
        if run is not None:
            try:
                run.status = RunStatus.FAILED.value
                run.error_message = "分析超时或被取消"
                run.finished_at = _now()
                await session.commit()
            except Exception:
                logger.exception("Failed to update AIRun to failed state on cancel run=%s", run_id)
        raise
    except Exception as exc:
        logger.exception(
            "Chapter analysis background task failed run=%s chapter=%s",
            run_id,
            chapter_id,
        )
        if run is not None:
            try:
                run.status = RunStatus.FAILED.value
                run.error_message = str(exc)[:500]
                run.finished_at = _now()
                await session.commit()
            except Exception:
                logger.exception("Failed to update AIRun to failed state run=%s", run_id)
    finally:
        if should_close:
            await session.close()
