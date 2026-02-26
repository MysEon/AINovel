"""AI 辅助 API v1 — 工作流运行入口 + 标准化 Run/Session/Event/Artifact API"""

import base64
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.ai_runtime import (
    LangGraphWorkflow, LangGraphSession, AIRun, AIRunEvent, AIGeneratedContent,
)
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.project import ProjectRepository
from app.schemas.ai import (
    ChapterOutlineRequest, ChapterOutlineResponse,
    CreateRunRequest, RunResponse, RunListResponse,
    EventResponse, SessionResponse, ArtifactResponse,
)
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


def _build_model_from_config(model_cfg: ModelConfig):
    """从 ModelConfig 构建 LangChain ChatModel"""
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
    return provider.build_chat_model(pcfg)


async def _get_run_with_access(
    run_id: int, user_id: int, db: AsyncSession,
) -> AIRun:
    """获取 Run 并校验用户权限（通过 session → workflow → project 链路）"""
    result = await db.execute(
        select(AIRun)
        .join(LangGraphSession, AIRun.session_id == LangGraphSession.id)
        .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
        .join(Project, LangGraphWorkflow.project_id == Project.id)
        .where(AIRun.id == run_id, Project.user_id == user_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise NotFoundError("运行记录不存在或无权访问")
    return run


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
    model = _build_model_from_config(model_cfg)

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


# ==================== 标准化 Run API ====================


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """查询单次运行状态"""
    run = await _get_run_with_access(run_id, user.id, db)
    return RunResponse.model_validate(run)


@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    project_id: Optional[int] = Query(None),
    workflow_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """列出用户的运行记录（支持按项目/类型/状态筛选）"""
    base = (
        select(AIRun)
        .join(LangGraphSession, AIRun.session_id == LangGraphSession.id)
        .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
        .join(Project, LangGraphWorkflow.project_id == Project.id)
        .where(Project.user_id == user.id)
    )
    if project_id:
        base = base.where(LangGraphWorkflow.project_id == project_id)
    if workflow_type:
        base = base.where(AIRun.workflow_type == workflow_type)
    if status:
        base = base.where(AIRun.status == status)

    count_result = await db.execute(
        select(func.count()).select_from(base.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(desc(AIRun.id)).offset(skip).limit(limit)
    )
    runs = result.scalars().all()
    return RunListResponse(
        items=[RunResponse.model_validate(r) for r in runs],
        total=total,
    )


@router.post("/runs/{run_id}/cancel", response_model=RunResponse)
async def cancel_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """取消运行（仅 pending/running 状态可取消）"""
    run = await _get_run_with_access(run_id, user.id, db)
    if run.status not in ("pending", "running"):
        raise ForbiddenError(f"当前状态 '{run.status}' 不可取消")
    from datetime import datetime, timezone
    run.status = "cancelled"
    run.finished_at = datetime.now(timezone.utc)
    await db.commit()
    return RunResponse.model_validate(run)


@router.get("/runs/{run_id}/events", response_model=list[EventResponse])
async def get_run_events(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取运行的事件列表"""
    await _get_run_with_access(run_id, user.id, db)
    result = await db.execute(
        select(AIRunEvent)
        .where(AIRunEvent.run_id == run_id)
        .order_by(AIRunEvent.sequence)
    )
    events = result.scalars().all()
    return [EventResponse.model_validate(e) for e in events]


# ==================== Session API ====================


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """查看会话详情"""
    result = await db.execute(
        select(LangGraphSession)
        .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
        .join(Project, LangGraphWorkflow.project_id == Project.id)
        .where(LangGraphSession.id == session_id, Project.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("会话不存在或无权访问")
    return SessionResponse.model_validate(session)


# ==================== Artifact API ====================


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取 AI 生成产物"""
    result = await db.execute(
        select(AIGeneratedContent)
        .join(Project, AIGeneratedContent.project_id == Project.id)
        .where(AIGeneratedContent.id == artifact_id, Project.user_id == user.id)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise NotFoundError("生成内容不存在或无权访问")
    return ArtifactResponse.model_validate(artifact)


# ==================== SSE 事件流 ====================


@router.get("/runs/{run_id}/stream")
async def stream_run_events(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """SSE 事件流 — 流式获取运行过程中的实时事件"""
    import json as _json
    from fastapi.responses import StreamingResponse

    run = await _get_run_with_access(run_id, user.id, db)

    # 如果 run 已完成，直接返回历史事件
    if run.status in ("succeeded", "failed", "cancelled"):
        async def replay_events():
            result = await db.execute(
                select(AIRunEvent)
                .where(AIRunEvent.run_id == run_id)
                .order_by(AIRunEvent.sequence)
            )
            for evt in result.scalars().all():
                payload = {
                    "type": evt.event_type,
                    "node": evt.node_name,
                    "sequence": evt.sequence,
                }
                if evt.data:
                    try:
                        payload["data"] = _json.loads(evt.data)
                    except _json.JSONDecodeError:
                        payload["data"] = evt.data
                yield f"data: {_json.dumps(payload, ensure_ascii=False)}\n\n"
            yield f"data: {_json.dumps({'type': 'done', 'status': run.status}, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            replay_events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # run 仍在进行中 — 返回提示（实际流式需要 WebSocket 或长轮询）
    async def pending_stream():
        yield f"data: {_json.dumps({'type': 'info', 'message': 'Run is still in progress', 'status': run.status}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        pending_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
