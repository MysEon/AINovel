"""
知识库 API v1 — 项目知识查询 + AI 上下文

提供项目维度的知识聚合查询，供前端展示和 AI 工作流使用。
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.repositories.project import ProjectRepository
from app.api.deps.auth import require_active_user
from app.application.ai_context_builder import AIContextBuilder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/knowledge", tags=["知识库"])


@router.get("/projects/{project_id}/context")
async def get_project_context(
    project_id: int,
    mode: str = Query("full", regex="^(full|outline|chat)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取项目 AI 上下文（供前端预览或工作流注入）"""
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    builder = AIContextBuilder(db)
    ctx = await builder.get_project_context(project_id, mode=mode)
    return {"success": True, "context": ctx}


@router.get("/projects/{project_id}/context/text")
async def get_project_context_text(
    project_id: int,
    mode: str = Query("full", regex="^(full|outline|chat)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取项目上下文的纯文本格式（供 prompt 直接注入）"""
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    builder = AIContextBuilder(db)
    ctx = await builder.get_project_context(project_id, mode=mode)
    text = builder.format_as_text(ctx)
    return {"success": True, "text": text, "char_count": len(text)}
