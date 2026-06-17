"""Application service for story knowledge graph proposals."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import nullslast, or_, select
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
        for proposal_draft in draft.proposals:
            body = self._proposal_body_from_draft(chapter.id, proposal_draft, entities)
            if body is None:
                skipped += 1
                continue
            proposals.append(await self.create_proposal(project_id, user_id, body))

        logger.info(
            "Chapter analysis completed project=%s chapter=%s proposals=%s skipped=%s",
            project_id, chapter.id, len(proposals), skipped,
        )
        return ChapterKnowledgeAnalysisResponse(
            success=True,
            project_id=project_id,
            chapter_id=chapter.id,
            proposal_count=len(proposals),
            skipped_proposal_count=skipped,
            proposals=proposals,
            message="章节知识影响分析完成" if proposals else "未发现可写入的知识变更",
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
            await self.db.commit()
            raise ConflictError("提案存在冲突，请重新分析或明确强制应用", detail={"conflicts": conflicts})

        for operation in rejected_ops:
            operation.status = "rejected"
            operation.conflict_reason = None

        for operation in accepted_ops:
            await self._apply_operation(proposal, operation)
            operation.status = "accepted"
            operation.conflict_reason = None
            operation.applied_at = _now()

        proposal.status = self._proposal_status_after_operations(proposal.operations)
        if proposal.status in {"accepted", "rejected"}:
            proposal.reviewed_at = _now()

        await self.db.commit()
        proposal = await self._get_proposal_for_user(proposal.id, user_id)
        return self._proposal_response(proposal)

    async def reject_proposal(
        self,
        proposal_id: int,
        user_id: int,
        *,
        reason: str | None = None,
    ) -> EntityChangeProposalResponse:
        proposal = await self._get_proposal_for_user(proposal_id, user_id)
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
                EntityChangeProposal.status.in_(ACTIVE_PROPOSAL_STATUSES),
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
        return entities

    @staticmethod
    def _chapter_analysis_system_prompt() -> str:
        return (
            "你是 AINovel 的小说知识库维护助手。"
            "你的任务是从稳定章节正文中提取会影响正史知识库的事件级变更提案。"
            "只基于章节内容和已知实体，不要编造不存在的实体。"
            "如果没有明确变化，返回空 proposals。"
            "所有输出必须符合结构化 schema。"
        )

    def _build_chapter_analysis_prompt(self, chapter: Chapter, entities: dict[str, list[dict[str, Any]]]) -> str:
        return "\n\n".join(
            [
                "请分析本章是否造成角色、组织、地点、世界观的状态或关系变化。",
                "可用 operation_type：entity_field_update、relationship_upsert、relationship_delete、entity_state_event。",
                "字段更新只能使用下面 allowed_fields 中的英文字段名；不确定时优先生成 entity_state_event。",
                "关系建议使用英文 relation_type，例如 ally_of、enemy_of、member_of、controls、located_in、believes_in、affected_by。",
                "每个 proposal 应是一个故事事件，operations 是这个事件造成的具体影响。",
                f"章节：第 {chapter.chapter_number} 章《{chapter.title}》",
                f"章节正文：\n{chapter.content or ''}",
                "allowed_fields：\n" + _dump_json({key: sorted(value) for key, value in ENTITY_ALLOWED_FIELDS.items()}),
                "已知实体：\n" + _dump_json(entities),
            ]
        )

    def _proposal_body_from_draft(
        self,
        chapter_id: int,
        draft: KnowledgeProposalDraft,
        entities: dict[str, list[dict[str, Any]]],
    ) -> EntityChangeProposalCreate | None:
        operations: list[ProposalOperationCreate] = []
        for operation_draft in draft.operations:
            operation = self._operation_body_from_draft(operation_draft, entities)
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
    ) -> ProposalOperationCreate | None:
        entity_id = self._resolve_entity_id(entities, draft.entity_type, draft.entity_name)
        target_id = self._resolve_entity_id(entities, draft.target_type, draft.target_name)

        if draft.operation_type in {"entity_field_update", "entity_state_event"} and not entity_id:
            return None
        if draft.operation_type in {"relationship_upsert", "relationship_delete"} and (not entity_id or not target_id):
            return None
        if draft.operation_type == "entity_field_update":
            if not draft.entity_type or not draft.field_name:
                return None
            if draft.field_name not in ENTITY_ALLOWED_FIELDS.get(draft.entity_type, set()):
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
            "payload": draft.payload,
        }
        if "expected_old_value" in draft.model_fields_set:
            operation_data["expected_old_value"] = draft.expected_old_value
        return ProposalOperationCreate(**operation_data)

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

    async def _build_operation(
        self,
        project_id: int,
        body: ProposalOperationCreate,
        index: int,
    ) -> ProposalOperation:
        await self._validate_operation_refs(project_id, body)
        expected_old_value = body.expected_old_value
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
            payload=_dump_json(body.payload or {}),
        )

    async def _validate_operation_refs(self, project_id: int, body: ProposalOperationCreate) -> None:
        if body.operation_type in {"entity_field_update", "entity_state_event"}:
            if not body.entity_type or not body.entity_id:
                raise ValidationError("子操作缺少实体引用")
            await self._get_entity(project_id, body.entity_type, body.entity_id)

        if body.operation_type == "entity_field_update":
            if not body.field_name:
                raise ValidationError("字段更新操作缺少 field_name")
            self._ensure_allowed_field(body.entity_type, body.field_name)

        if body.operation_type == "entity_state_event" and not body.state_key:
            raise ValidationError("状态事件操作缺少 state_key")

        if body.operation_type in {"relationship_upsert", "relationship_delete"}:
            if not all([body.entity_type, body.entity_id, body.relation_type, body.target_type, body.target_id]):
                raise ValidationError("关系操作缺少 source/target/relation_type")
            await self._get_entity(project_id, body.entity_type, body.entity_id)
            await self._get_entity(project_id, body.target_type, body.target_id)

    async def _detect_conflict(self, project_id: int, operation: ProposalOperation) -> str | None:
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
        else:
            return None

        result = await self.db.execute(stmt)
        return "存在另一个待处理提案修改同一目标" if result.scalar_one_or_none() is not None else None

    async def _apply_operation(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> None:
        if operation.operation_type == "entity_field_update":
            await self._apply_field_update(proposal, operation)
            return
        if operation.operation_type == "relationship_upsert":
            await self._apply_relationship_upsert(proposal, operation)
            return
        if operation.operation_type == "relationship_delete":
            await self._apply_relationship_delete(proposal.project_id, operation)
            return
        if operation.operation_type == "entity_state_event":
            await self._apply_state_event(proposal, operation)
            return
        raise ValidationError(f"不支持的子操作类型：{operation.operation_type}")

    async def _apply_field_update(self, proposal: EntityChangeProposal, operation: ProposalOperation) -> None:
        entity = await self._get_entity(proposal.project_id, operation.entity_type, operation.entity_id)
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

    async def _apply_relationship_upsert(
        self,
        proposal: EntityChangeProposal,
        operation: ProposalOperation,
    ) -> None:
        payload = _load_json(operation.payload) or {}
        relationship = await self._find_relationship(proposal.project_id, operation)
        if relationship is None:
            relationship = EntityRelationship(
                project_id=proposal.project_id,
                source_type=operation.entity_type,
                source_id=operation.entity_id,
                relation_type=operation.relation_type,
                target_type=operation.target_type,
                target_id=operation.target_id,
            )
            self.db.add(relationship)

        relationship.status = payload.get("status") or "active"
        relationship.description = payload.get("description")
        relationship.evidence = payload.get("evidence") or proposal.evidence
        relationship.confidence = payload.get("confidence", proposal.confidence)
        relationship.properties = _dump_json(payload.get("properties") or {})
        relationship.source = proposal.source
        relationship.proposal_id = proposal.id
        relationship.proposal_operation_id = operation.id

    async def _apply_relationship_delete(self, project_id: int, operation: ProposalOperation) -> None:
        relationship = await self._find_relationship(project_id, operation)
        if relationship is not None:
            relationship.status = "inactive"
            relationship.proposal_operation_id = operation.id

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

    async def _find_relationship(self, project_id: int, operation: ProposalOperation) -> EntityRelationship | None:
        stmt = select(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            EntityRelationship.source_type == operation.entity_type,
            EntityRelationship.source_id == operation.entity_id,
            EntityRelationship.relation_type == operation.relation_type,
            EntityRelationship.target_type == operation.target_type,
            EntityRelationship.target_id == operation.target_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

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
    def _ensure_allowed_field(entity_type: str | None, field_name: str) -> None:
        if not entity_type or field_name not in ENTITY_ALLOWED_FIELDS.get(entity_type, set()):
            raise ValidationError("该实体字段不允许通过提案更新")

    def _read_field_value(self, entity, entity_type: str | None, field_name: str | None) -> Any:
        if not entity_type or not field_name:
            raise ValidationError("字段引用无效")
        self._ensure_allowed_field(entity_type, field_name)
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
            return int(value)
        return value if isinstance(value, str) else str(value)

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
