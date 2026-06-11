"""AI 辅助 API v1 — 工作流运行入口 + 标准化 Run/Session/Event/Artifact API"""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps.auth import require_active_user
from app.application.ai_workflow_service import AIWorkflowService
from app.core.middleware import limiter
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.ai import (
    ArtifactResponse,
    ChapterOutlineRequest,
    ChapterOutlineResponse,
    EventResponse,
    RunListResponse,
    RunResponse,
    SessionResponse,
)

router = APIRouter(prefix="/api/v1/ai", tags=["AI辅助：工作流"])


def _user_rate_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth:
        return f"user:{auth}"
    from slowapi.util import get_remote_address

    return f"ip:{get_remote_address(request)}"


@router.post("/chapter-outline", response_model=ChapterOutlineResponse)
@limiter.limit("10/minute", key_func=_user_rate_key)
async def generate_chapter_outline(
    request: Request,
    body: ChapterOutlineRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """生成章节大纲（同步执行，返回结果）"""
    service = AIWorkflowService(db)
    return await service.generate_chapter_outline(body, user.id)


@router.get("/workflow-types")
async def list_workflow_types(
    user: User = Depends(require_active_user),
):
    """列出已注册的工作流类型"""
    import app.infrastructure.graph.workflows  # noqa: F401
    from app.infrastructure.graph import graph_registry

    return [{"value": t, "label": t.replace("_", " ").title()} for t in graph_registry.registered_types]


# ==================== 标准化 Run API ====================


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """查询单次运行状态"""
    service = AIWorkflowService(db)
    run = await service.get_run(run_id, user.id)
    return RunResponse.model_validate(run)


@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    project_id: int | None = Query(None),
    workflow_type: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """列出用户的运行记录（支持按项目/类型/状态筛选）"""
    service = AIWorkflowService(db)
    return await service.list_runs(
        user_id=user.id,
        project_id=project_id,
        workflow_type=workflow_type,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.post("/runs/{run_id}/cancel", response_model=RunResponse)
@limiter.limit("10/minute", key_func=_user_rate_key)
async def cancel_run(
    request: Request,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """取消运行（仅 pending/running 状态可取消）

    已知限制：
    - generate_chapter_outline 等同步执行端点不走后台 task，因此 cancel_run 对它们
      只能修改 DB 状态，无法真正中断正在进行的 LLM 调用。
    - 只有先通过 /start-stream 启动的后台流式运行，cancel_run 才会真正调用
      background_runner.cancel(run_id) 来中断 asyncio.Task。
    """
    service = AIWorkflowService(db)
    run = await service.cancel_run(run_id, user.id)
    return RunResponse.model_validate(run)


@router.get("/runs/{run_id}/events", response_model=list[EventResponse])
async def get_run_events(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取运行的事件列表"""
    service = AIWorkflowService(db)
    events = await service.get_run_events(run_id, user.id)
    return [EventResponse.model_validate(e) for e in events]


# ==================== Session API ====================


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """查看会话详情"""
    service = AIWorkflowService(db)
    session = await service.get_session(session_id, user.id)
    return SessionResponse.model_validate(session)


# ==================== Artifact API ====================


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """获取 AI 生成产物"""
    service = AIWorkflowService(db)
    artifact = await service.get_artifact(artifact_id, user.id)
    return ArtifactResponse.model_validate(artifact)


# ==================== SSE 事件流 ====================


@router.get("/runs/{run_id}/stream")
@limiter.limit("30/minute", key_func=_user_rate_key)
async def stream_run_events(
    request: Request,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """SSE 事件流 — 流式获取运行过程中的实时事件"""
    service = AIWorkflowService(db)
    return EventSourceResponse(
        service.stream_events(run_id, user.id),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/start-stream", response_model=RunResponse)
@limiter.limit("10/minute", key_func=_user_rate_key)
async def start_stream_run(
    request: Request,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """启动后台流式运行，并注册 event_queue 供 /stream 实时消费"""
    service = AIWorkflowService(db)
    run, _queue = await service.start_stream_run(run_id, user.id)
    return RunResponse.model_validate(run)
