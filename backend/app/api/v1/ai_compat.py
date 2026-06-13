"""
旧 AI 接口兼容层 — /api/ai/* → 新 Provider Adapter 基础设施

过渡期保留旧路径和响应格式，内部使用新架构执行。
所有响应头标记 X-Deprecated: true。
"""

import logging

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.legacy_ai_service import LegacyAIService
from app.core.middleware import limiter
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.legacy_ai import LegacyChatRequest, LegacyGenerateRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI辅助：兼容层（deprecated）"])


def _user_rate_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth:
        return f"user:{auth}"
    from slowapi.util import get_remote_address

    return f"ip:{get_remote_address(request)}"


def _deprecated_headers() -> dict:
    return {"X-Deprecated": "true", "X-Migrate-To": "/api/v1/ai/*"}


@router.post("/chat")
@limiter.limit("10/minute", key_func=_user_rate_key)
async def legacy_chat(
    request: Request,
    body: LegacyChatRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chat — 非流式对话"""
    logger.info("deprecated endpoint called: POST /api/ai/chat")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).chat(
        project_id=body.project_id,
        model_config_id=body.model_config_id,
        message=body.message,
        history=body.history,
        user_id=user.id,
        prompt_template_id=body.prompt_template_id,
    )


@router.post("/chat-stream")
@limiter.limit("10/minute", key_func=_user_rate_key)
async def legacy_chat_stream(
    request: Request,
    body: LegacyChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chat-stream — SSE 流式对话"""
    logger.info("deprecated endpoint called: POST /api/ai/chat-stream")
    stream = await LegacyAIService(db).chat_stream(
        project_id=body.project_id,
        model_config_id=body.model_config_id,
        message=body.message,
        history=body.history,
        user_id=user.id,
        prompt_template_id=body.prompt_template_id,
    )
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Deprecated": "true", "X-Migrate-To": "/api/v1/ai/*"},
    )


@router.post("/chapter-outline")
async def legacy_chapter_outline(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chapter-outline"""
    logger.info("deprecated endpoint called: POST /api/ai/chapter-outline")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).chapter_outline(body, user.id)


@router.post("/chapter-draft")
async def legacy_chapter_draft(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chapter-draft"""
    logger.info("deprecated endpoint called: POST /api/ai/chapter-draft")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).chapter_draft(body, user.id)


@router.post("/character-dialogue")
async def legacy_character_dialogue(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/character-dialogue"""
    logger.info("deprecated endpoint called: POST /api/ai/character-dialogue")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).character_dialogue(body, user.id)


@router.post("/plot-suggestions")
async def legacy_plot_suggestions(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/plot-suggestions"""
    logger.info("deprecated endpoint called: POST /api/ai/plot-suggestions")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).plot_suggestions(body, user.id)


@router.post("/optimize-content")
async def legacy_optimize_content(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/optimize-content"""
    logger.info("deprecated endpoint called: POST /api/ai/optimize-content")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).optimize_content(body, user.id)


@router.post("/creative-ideas")
async def legacy_creative_ideas(
    body: LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/creative-ideas"""
    logger.info("deprecated endpoint called: POST /api/ai/creative-ideas")
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).creative_ideas(body, user.id)


@router.get("/models/available")
async def legacy_available_models(
    response: Response,
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/models/available"""
    logger.info("deprecated endpoint called: GET /api/ai/models/available")
    response.headers.update(_deprecated_headers())
    return LegacyAIService(db=None).available_models()


@router.get("/project-context/{project_id}")
async def legacy_project_context(
    project_id: int,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/project-context/{project_id}"""
    logger.info("deprecated endpoint called: GET /api/ai/project-context/%s", project_id)
    response.headers.update(_deprecated_headers())
    return await LegacyAIService(db).get_project_context(project_id, user.id)
