"""AI 辅助 API v1 — 工作流运行入口"""

import base64
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.ai_runtime import LangGraphWorkflow
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.repositories.project import ProjectRepository
from app.schemas.ai import ChapterOutlineRequest, ChapterOutlineResponse
from app.api.deps.auth import require_active_user

router = APIRouter(prefix="/api/v1/ai", tags=["AI辅助：工作流"])


async def _get_user_model_config(
    config_id: int, user_id: int, db: AsyncSession,
) -> ModelConfig:
    """获取用户的模型配置并解密 API Key"""
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
    return cfg


@router.post("/chapter-outline", response_model=ChapterOutlineResponse)
async def generate_chapter_outline(
    body: ChapterOutlineRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """生成章节大纲（同步执行，返回结果）"""
    # 1. 校验项目权限
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(body.project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    # 2. 获取模型配置 & 构建 Provider
    model_cfg = await _get_user_model_config(body.model_config_id, user.id, db)

    from app.infrastructure.llm.provider_adapters import get_provider, ProviderConfig
    provider = get_provider(model_cfg.model_type)
    decrypted_key = base64.b64decode(model_cfg.api_key.encode()).decode()
    pcfg = ProviderConfig(
        api_key=decrypted_key,
        model_name=model_cfg.model_name or "",
        temperature=float(model_cfg.temperature) if model_cfg.temperature else 0.7,
        max_tokens=model_cfg.max_tokens or 2000,
        api_url=model_cfg.api_url,
        proxy_url=model_cfg.proxy_url if model_cfg.enable_proxy else None,
    )
    model = provider.build_chat_model(pcfg)

    # 3. 确保工作流注册已加载
    import app.infrastructure.graph.workflows  # noqa: F401

    # 4. 获取或创建 workflow + session + run
    from app.infrastructure.graph.runner import GraphRunner

    result = await db.execute(
        select(LangGraphWorkflow).where(
            LangGraphWorkflow.project_id == body.project_id,
            LangGraphWorkflow.workflow_type == "chapter_outline",
            LangGraphWorkflow.model_config_id == body.model_config_id,
        )
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        workflow = LangGraphWorkflow(
            name=f"章节大纲 - {project.name}",
            workflow_type="chapter_outline",
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            status="active",
        )
        db.add(workflow)
        await db.flush()

    runner = GraphRunner(db)
    thread_id = f"outline-{body.project_id}-{body.chapter_number}-{uuid.uuid4().hex[:8]}"
    session = await runner.get_or_create_session(workflow.id, thread_id)
    run = await runner.create_run(
        session, "chapter_outline",
        input_data={
            "project_id": body.project_id,
            "chapter_number": body.chapter_number,
            "user_requirements": body.user_requirements,
        },
    )

    # 5. 构建输入状态并执行图
    input_state = {
        "project_name": project.name,
        "project_description": project.description or "",
        "chapter_number": body.chapter_number,
        "user_requirements": body.user_requirements,
        "characters_info": None,
        "worldview_info": None,
        "previous_chapters": None,
    }

    result = await runner.execute(run, model, input_state)
    await db.commit()

    return ChapterOutlineResponse(
        run_id=run.id,
        status=run.status,
        outline=result.get("outline"),
        raw_output=result.get("raw_output"),
    )


@router.get("/workflow-types")
async def list_workflow_types(
    user: User = Depends(require_active_user),
):
    """列出已注册的工作流类型"""
    from app.infrastructure.graph import graph_registry
    import app.infrastructure.graph.workflows  # noqa: F401

    return [
        {"value": t, "label": t.replace("_", " ").title()}
        for t in graph_registry.registered_types
    ]
