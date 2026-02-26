"""
旧 AI 接口兼容层 — /api/ai/* → 新 Provider Adapter 基础设施

过渡期保留旧路径和响应格式，内部使用新架构执行。
所有响应头标记 X-Deprecated: true。
"""

import base64
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.project import ProjectRepository
from app.api.deps.auth import require_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI辅助：兼容层（deprecated）"])


# ---------- 旧格式 Schema（仅兼容层使用） ----------

class _LegacyChatRequest(BaseModel):
    project_id: int
    model_config_id: int
    message: str
    history: Optional[list] = None
    prompt_template_id: Optional[int] = None


class _LegacyGenerateRequest(BaseModel):
    project_id: int
    model_config_id: int
    chapter_number: Optional[int] = None
    chapter_outline: Optional[str] = None
    character_names: Optional[list[str]] = None
    situation: Optional[str] = None
    content: Optional[str] = None
    optimization_type: Optional[str] = None
    prompt: Optional[str] = None
    category: Optional[str] = None
    user_requirements: Optional[str] = None


# ---------- 辅助函数 ----------

async def _get_config_and_model(
    config_id: int, user_id: int, db: AsyncSession,
):
    """获取模型配置并构建 ChatModel"""
    from app.infrastructure.llm.provider_adapters import get_provider, ProviderConfig

    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id, ModelConfig.user_id == user_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise NotFoundError("模型配置不存在或无权访问")
    if not cfg.api_key:
        raise ForbiddenError("该模型配置没有保存 API 密钥")

    provider = get_provider(cfg.model_type)
    decrypted_key = base64.b64decode(cfg.api_key.encode()).decode()
    pcfg = ProviderConfig(
        api_key=decrypted_key,
        model_name=cfg.model_name or "",
        temperature=float(cfg.temperature) if cfg.temperature else 0.7,
        max_tokens=cfg.max_tokens or 2000,
        api_url=cfg.api_url,
        proxy_url=cfg.proxy_url if cfg.enable_proxy else None,
    )
    return provider.build_chat_model(pcfg)


def _deprecated_headers() -> dict:
    return {"X-Deprecated": "true", "X-Migrate-To": "/api/v1/ai/*"}


# ---------- 兼容端点 ----------


@router.post("/chat")
async def legacy_chat(
    body: _LegacyChatRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chat — 非流式对话"""
    logger.info("deprecated endpoint called: POST /api/ai/chat")
    response.headers.update(_deprecated_headers())

    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(body.project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    model = await _get_config_and_model(body.model_config_id, user.id, db)

    from langchain_core.messages import HumanMessage, SystemMessage
    messages = [
        SystemMessage(content=f"你是一个专业的小说写作助手。当前项目：{project.name}"),
    ]
    if body.history:
        for msg in body.history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "assistant":
                from langchain_core.messages import AIMessage
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))
    messages.append(HumanMessage(content=body.message))

    resp = await model.ainvoke(messages)
    return {
        "success": True,
        "response": resp.content,
        "message": "AI对话成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/chat-stream")
async def legacy_chat_stream(
    body: _LegacyChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chat-stream — SSE 流式对话"""
    logger.info("deprecated endpoint called: POST /api/ai/chat-stream")

    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(body.project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    model = await _get_config_and_model(body.model_config_id, user.id, db)

    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    messages = [
        SystemMessage(content=f"你是一个专业的小说写作助手。当前项目：{project.name}"),
    ]
    if body.history:
        for msg in body.history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))
    messages.append(HumanMessage(content=body.message))

    async def generate():
        try:
            async for chunk in model.astream(messages):
                if chunk.content:
                    yield f"data: {chunk.content}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("legacy chat-stream error")
            yield f"data: 抱歉，AI服务暂时不可用: {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Deprecated": "true",
            "X-Migrate-To": "/api/v1/ai/*",
        },
    )


# ---------- 通用生成辅助 ----------

async def _simple_generate(
    project_id: int, model_config_id: int, user_id: int,
    system_prompt: str, user_prompt: str, db: AsyncSession,
) -> str:
    """通用单轮生成：构建消息 → 调用模型 → 返回文本"""
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user_id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    model = await _get_config_and_model(model_config_id, user_id, db)

    from langchain_core.messages import HumanMessage, SystemMessage
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    resp = await model.ainvoke(messages)
    return resp.content


@router.post("/chapter-outline")
async def legacy_chapter_outline(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chapter-outline"""
    logger.info("deprecated endpoint called: POST /api/ai/chapter-outline")
    response.headers.update(_deprecated_headers())

    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        "你是一个专业的小说写作助手。请为指定章节创建详细的写作大纲，返回JSON格式。",
        f"第{body.chapter_number or 1}章大纲。" + (f"要求：{body.user_requirements}" if body.user_requirements else ""),
        db,
    )
    return {
        "success": True,
        "outline": text,
        "message": "章节大纲生成成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/chapter-draft")
async def legacy_chapter_draft(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/chapter-draft"""
    logger.info("deprecated endpoint called: POST /api/ai/chapter-draft")
    response.headers.update(_deprecated_headers())

    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        "你是一个专业的小说写作助手。请根据大纲生成章节草稿内容。",
        f"大纲：{body.chapter_outline or '无'}",
        db,
    )
    return {
        "success": True,
        "content": text,
        "message": "章节草稿生成成功",
        "word_count": len(text),
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/character-dialogue")
async def legacy_character_dialogue(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/character-dialogue"""
    logger.info("deprecated endpoint called: POST /api/ai/character-dialogue")
    response.headers.update(_deprecated_headers())

    names = ", ".join(body.character_names) if body.character_names else "角色"
    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        "你是一个专业的小说写作助手。请根据角色和场景生成对话。",
        f"角色：{names}\n场景：{body.situation or '无'}",
        db,
    )
    return {
        "success": True,
        "dialogue": text,
        "message": "角色对话生成成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/plot-suggestions")
async def legacy_plot_suggestions(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/plot-suggestions"""
    logger.info("deprecated endpoint called: POST /api/ai/plot-suggestions")
    response.headers.update(_deprecated_headers())

    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        "你是一个专业的小说写作助手。请提供情节发展建议。",
        body.user_requirements or "请给出下一步情节建议",
        db,
    )
    return {
        "success": True,
        "suggestions": text,
        "message": "情节建议生成成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/optimize-content")
async def legacy_optimize_content(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/optimize-content"""
    logger.info("deprecated endpoint called: POST /api/ai/optimize-content")
    response.headers.update(_deprecated_headers())

    opt_type = body.optimization_type or "polish"
    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        f"你是一个专业的小说写作助手。请对以下内容进行{opt_type}优化。",
        body.content or "",
        db,
    )
    return {
        "success": True,
        "optimized_content": text,
        "message": "内容优化成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/creative-ideas")
async def legacy_creative_ideas(
    body: _LegacyGenerateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/creative-ideas"""
    logger.info("deprecated endpoint called: POST /api/ai/creative-ideas")
    response.headers.update(_deprecated_headers())

    category = body.category or "general"
    text = await _simple_generate(
        body.project_id, body.model_config_id, user.id,
        f"你是一个专业的小说写作助手。请围绕'{category}'类别生成创意想法。",
        body.prompt or "请给出创意想法",
        db,
    )
    return {
        "success": True,
        "ideas": text,
        "message": "创意想法生成成功",
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/models/available")
async def legacy_available_models(
    response: Response,
    user: User = Depends(require_active_user),
):
    """兼容旧 /api/ai/models/available"""
    logger.info("deprecated endpoint called: GET /api/ai/models/available")
    response.headers.update(_deprecated_headers())

    return {
        "success": True,
        "models": [
            {"provider": "openai", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]},
            {"provider": "anthropic", "models": ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"]},
            {"provider": "gemini", "models": ["gemini-2.0-flash", "gemini-1.5-pro"]},
        ],
        "message": "请使用 GET /api/v1/model-configs/list-models 获取实时模型列表",
    }


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

    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    return {
        "success": True,
        "context": {
            "project_name": project.name,
            "project_description": project.description or "",
        },
        "message": "项目上下文获取成功",
    }
