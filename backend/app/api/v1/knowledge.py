"""
知识库 API v1 — 项目知识查询 + AI 上下文

提供项目维度的知识聚合查询，供前端展示和 AI 工作流使用。
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.ai_context_builder import AIContextBuilder
from app.application.knowledge_graph_service import KnowledgeGraphService
from app.application.project_service import ProjectService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.knowledge import (
    ChapterKnowledgeAnalysisResponse,
    ChapterKnowledgeAnalyzeRequest,
    EntityChangeProposalCreate,
    EntityChangeProposalResponse,
    EntityRelationshipResponse,
    EntityStateEventResponse,
    ProposalAcceptRequest,
    ProposalRejectRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/knowledge", tags=["知识库"])


@router.get("/projects/{project_id}/context")
async def get_project_context(
    project_id: int,
    mode: str = Query("full", pattern="^(full|outline|chat)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取项目 AI 上下文（供前端预览或工作流注入）"""
    proj_service = ProjectService(db)
    await proj_service.require_user_project(project_id, user.id)

    builder = AIContextBuilder(db)
    ctx = await builder.get_project_context(project_id, mode=mode)
    return {"success": True, "context": ctx}


@router.get("/projects/{project_id}/context/text")
async def get_project_context_text(
    project_id: int,
    mode: str = Query("full", pattern="^(full|outline|chat)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取项目上下文的纯文本格式（供 prompt 直接注入）"""
    proj_service = ProjectService(db)
    await proj_service.require_user_project(project_id, user.id)

    builder = AIContextBuilder(db)
    ctx = await builder.get_project_context(project_id, mode=mode)
    text = builder.format_as_text(ctx)
    return {"success": True, "text": text, "char_count": len(text)}


@router.post(
    "/projects/{project_id}/chapters/{chapter_id}/analyze",
    response_model=ChapterKnowledgeAnalysisResponse,
)
async def analyze_chapter_knowledge(
    project_id: int,
    chapter_id: int,
    body: ChapterKnowledgeAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """Analyze a saved chapter and create reviewable knowledge update proposals."""
    service = KnowledgeGraphService(db)
    return await service.analyze_chapter(
        project_id,
        chapter_id,
        user.id,
        model_config_id=body.model_config_id,
        force=body.force,
    )


@router.post(
    "/projects/{project_id}/proposals",
    response_model=EntityChangeProposalResponse,
    status_code=201,
)
async def create_change_proposal(
    project_id: int,
    body: EntityChangeProposalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """Create a reviewable story knowledge change proposal."""
    service = KnowledgeGraphService(db)
    return await service.create_proposal(project_id, user.id, body)


@router.get(
    "/projects/{project_id}/proposals",
    response_model=list[EntityChangeProposalResponse],
)
async def list_change_proposals(
    project_id: int,
    status: str | None = Query(None),
    chapter_id: int | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """List change proposals for a project, optionally scoped to chapter or entity."""
    service = KnowledgeGraphService(db)
    return await service.list_proposals(
        project_id,
        user.id,
        status=status,
        chapter_id=chapter_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )


@router.get(
    "/proposals/{proposal_id}",
    response_model=EntityChangeProposalResponse,
)
async def get_change_proposal(
    proposal_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """Get one change proposal."""
    service = KnowledgeGraphService(db)
    return await service.get_proposal(proposal_id, user.id)


@router.post(
    "/proposals/{proposal_id}/accept",
    response_model=EntityChangeProposalResponse,
)
async def accept_change_proposal(
    proposal_id: int,
    body: ProposalAcceptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """Accept all or selected child operations from a proposal."""
    service = KnowledgeGraphService(db)
    return await service.accept_proposal(proposal_id, user.id, body)


@router.post(
    "/proposals/{proposal_id}/reject",
    response_model=EntityChangeProposalResponse,
)
async def reject_change_proposal(
    proposal_id: int,
    body: ProposalRejectRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """Reject a change proposal and its pending child operations."""
    service = KnowledgeGraphService(db)
    return await service.reject_proposal(proposal_id, user.id, reason=body.reason if body else None)


@router.get(
    "/projects/{project_id}/relationships",
    response_model=list[EntityRelationshipResponse],
)
async def list_entity_relationships(
    project_id: int,
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """List current graph relationships for a project."""
    service = KnowledgeGraphService(db)
    return await service.list_relationships(project_id, user.id, entity_type=entity_type, entity_id=entity_id)


@router.get(
    "/projects/{project_id}/state-events",
    response_model=list[EntityStateEventResponse],
)
async def list_entity_state_events(
    project_id: int,
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    chapter_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """List accepted entity state timeline events for a project."""
    service = KnowledgeGraphService(db)
    return await service.list_state_events(
        project_id,
        user.id,
        entity_type=entity_type,
        entity_id=entity_id,
        chapter_id=chapter_id,
    )
