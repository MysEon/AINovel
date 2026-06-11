"""AI 辅助 API v1 — 工作流运行入口 + 标准化 Run/Session/Event/Artifact API"""

import asyncio
import json
import uuid
from datetime import UTC

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps.auth import require_active_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.middleware import limiter
from app.domain.ai_runtime.enums import RunStatus
from app.infrastructure.db.models.ai_runtime import (
    AIGeneratedContent,
    AIRun,
    AIRunEvent,
    LangGraphSession,
    LangGraphWorkflow,
)
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.project import ProjectRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.secrets import get_encryption_service
from app.infrastructure.task.runner import background_runner
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

# 内存中的 run -> queue 注册表（running run 的实时 SSE 订阅）
RUN_QUEUES: dict[int, asyncio.Queue] = {}

_encryption_service = get_encryption_service()


def _user_rate_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth:
        return f"user:{auth}"
    from slowapi.util import get_remote_address

    return f"ip:{get_remote_address(request)}"


async def _get_user_model_config(
    config_id: int,
    user_id: int,
    db: AsyncSession,
) -> ModelConfig:
    """获取用户的模型配置并解密 API Key"""
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id,
            ModelConfig.user_id == user_id,
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
    from app.infrastructure.llm.provider_adapters import ProviderConfig, get_provider

    provider = get_provider(model_cfg.model_type)
    decrypted_key = _encryption_service.decrypt(model_cfg.api_key)
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
    run_id: int,
    user_id: int,
    db: AsyncSession,
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
@limiter.limit("10/minute", key_func=_user_rate_key)
async def generate_chapter_outline(
    request: Request,
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
        session,
        "chapter_outline",
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
    run = await _get_run_with_access(run_id, user.id, db)
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

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(base.order_by(desc(AIRun.id)).offset(skip).limit(limit))
    runs = result.scalars().all()
    return RunListResponse(
        items=[RunResponse.model_validate(r) for r in runs],
        total=total,
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
    run = await _get_run_with_access(run_id, user.id, db)
    if run.status not in ("pending", "running"):
        raise ForbiddenError(f"当前状态 '{run.status}' 不可取消")

    from datetime import datetime

    # 1. 尝试真正取消后台 task（如果是通过 start-stream 启动的）
    task_status = background_runner.get_status(run_id)
    if task_status and task_status.get("running"):
        background_runner.cancel(run_id)

    # 2. 更新 DB 状态
    run.status = RunStatus.CANCELLED.value
    run.finished_at = datetime.now(UTC)
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
    result = await db.execute(select(AIRunEvent).where(AIRunEvent.run_id == run_id).order_by(AIRunEvent.sequence))
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
@limiter.limit("30/minute", key_func=_user_rate_key)
async def stream_run_events(
    request: Request,
    run_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """SSE 事件流 — 流式获取运行过程中的实时事件"""
    run = await _get_run_with_access(run_id, user.id, db)

    # 如果 run 已完成，直接 replay 历史事件
    if run.status in (RunStatus.SUCCEEDED.value, RunStatus.FAILED.value, RunStatus.CANCELLED.value):

        async def replay_events():
            result = await db.execute(
                select(AIRunEvent).where(AIRunEvent.run_id == run_id).order_by(AIRunEvent.sequence)
            )
            for evt in result.scalars().all():
                payload = {
                    "type": evt.event_type,
                    "node": evt.node_name,
                    "sequence": evt.sequence,
                }
                if evt.data:
                    try:
                        payload["data"] = json.loads(evt.data)
                    except json.JSONDecodeError:
                        payload["data"] = evt.data
                yield {
                    "event": payload.get("type", "message"),
                    "data": json.dumps(payload, ensure_ascii=False),
                }
            yield {
                "event": "done",
                "data": json.dumps({"type": "done", "status": run.status}, ensure_ascii=False),
            }

        return EventSourceResponse(
            replay_events(),
            ping=15,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # run 仍在进行中 — 从注册表拉取实时事件
    queue = RUN_QUEUES.get(run_id)
    if queue is None:
        # 没有活跃的 queue，返回静态提示
        async def pending_stream():
            yield {
                "event": "info",
                "data": json.dumps(
                    {"type": "info", "message": "Run is still in progress", "status": run.status}, ensure_ascii=False
                ),
            }

        return EventSourceResponse(
            pending_stream(),
            ping=15,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # 实时消费 queue 中的事件
    async def live_stream():
        try:
            while True:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event, ensure_ascii=False),
                }
                if event.get("type") in ("done", "error", "cancelled"):
                    break
        except TimeoutError:
            yield {
                "event": "heartbeat",
                "data": json.dumps({"type": "heartbeat"}, ensure_ascii=False),
            }
        except asyncio.CancelledError:
            raise

    return EventSourceResponse(
        live_stream(),
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
    run = await _get_run_with_access(run_id, user.id, db)
    if run.status not in (RunStatus.PENDING.value,):
        raise ForbiddenError(f"当前状态 '{run.status}' 不可启动流式运行")

    from app.infrastructure.graph.runner import GraphRunner

    # 创建 queue 并注册
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    RUN_QUEUES[run_id] = queue

    # 重建 runner（需要与当前 db session 解耦，后台任务使用新 session）
    async def _background_task():
        from app.infrastructure.db.session import get_session_factory

        async with get_session_factory()() as session:
            try:
                # 重新加载 run 对象（在新 session 中）
                result = await session.execute(select(AIRun).where(AIRun.id == run_id))
                run_obj = result.scalar_one()

                GraphRunner(session, event_queue=queue)
                # 这里需要一个模型和 input_state；实际场景由调用方在创建 run 时保留
                # 为保持简单，consume_events 需要 model/input_state；
                # 但 start-stream 作为通用端点，目前只做 queue 注册和状态变更。
                # 真正的后台执行应由具体业务端点触发。本端点仅作示范：
                # 如果 run 有 input_data，可解析后调用 runner.consume_events。
                # 为兼容性，这里仅把 run 状态推进到 running。
                run_obj.status = RunStatus.RUNNING.value
                run_obj.started_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                await session.commit()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger = __import__("logging").getLogger(__name__)
                logger.exception("start-stream background task failed for run %s", run_id)
            finally:
                RUN_QUEUES.pop(run_id, None)

    background_runner.submit(run_id, _background_task())
    return RunResponse.model_validate(run)
