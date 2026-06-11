"""AI 工作流 Application Service

职责：
- generate_chapter_outline：项目校验 → 模型构建 → workflow 查询/创建 → session/run 创建 → 图执行
- cancel_run：状态机检查 → 后台取消 → 状态更新
- list_runs：多表过滤聚合
- start_stream_run：queue 注册 → 后台任务提交
- stream_events：返回 AsyncIterator（SSE 包装留在 API 层）
"""

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.domain.ai_runtime.enums import RunStatus
from app.infrastructure.db.models.ai_runtime import (
    AIGeneratedContent,
    AIRun,
    AIRunEvent,
    LangGraphSession,
    LangGraphWorkflow,
)
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.projects import Project
from app.infrastructure.secrets import get_encryption_service
from app.infrastructure.task.runner import background_runner
from app.schemas.ai import ChapterOutlineRequest, ChapterOutlineResponse, RunListResponse, RunResponse

from .project_service import ProjectService

logger = logging.getLogger(__name__)

# 内存中的 run -> queue 注册表（running run 的实时 SSE 订阅）
RUN_QUEUES: dict[int, asyncio.Queue] = {}

_encryption_service = get_encryption_service()


class AIWorkflowService:
    """AI 工作流业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.proj_service = ProjectService(db)

    # ---------- 内部辅助 ----------

    async def _get_user_model_config(self, config_id: int, user_id: int) -> ModelConfig:
        """获取用户的模型配置并校验存在性"""
        result = await self.db.execute(
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

    def _build_model_from_config(self, model_cfg: ModelConfig):
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

    async def _get_run_with_access(self, run_id: int, user_id: int) -> AIRun:
        """获取 Run 并校验用户权限（通过 session → workflow → project 链路）"""
        result = await self.db.execute(
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

    # ---------- 章节大纲 ----------

    async def generate_chapter_outline(
        self,
        body: ChapterOutlineRequest,
        user_id: int,
    ) -> ChapterOutlineResponse:
        """生成章节大纲（同步执行，返回结果）"""
        # 1. 校验项目权限
        project = await self.proj_service.require_user_project(body.project_id, user_id)

        # 2. 获取模型配置 & 构建 Provider
        model_cfg = await self._get_user_model_config(body.model_config_id, user_id)
        model = self._build_model_from_config(model_cfg)

        # 3. 确保工作流注册已加载
        import app.infrastructure.graph.workflows  # noqa: F401

        # 4. 获取或创建 workflow + session + run
        from app.infrastructure.graph.runner import GraphRunner

        result = await self.db.execute(
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
            self.db.add(workflow)
            await self.db.flush()

        runner = GraphRunner(self.db)
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

        graph_result = await runner.execute(run, model, input_state)
        await self.db.commit()

        return ChapterOutlineResponse(
            run_id=run.id,
            status=run.status,
            outline=graph_result.get("outline"),
            raw_output=graph_result.get("raw_output"),
        )

    # ---------- Run API ----------

    async def get_run(self, run_id: int, user_id: int) -> AIRun:
        """查询单次运行状态"""
        return await self._get_run_with_access(run_id, user_id)

    async def list_runs(
        self,
        user_id: int,
        project_id: int | None,
        workflow_type: str | None,
        status: str | None,
        skip: int,
        limit: int,
    ) -> RunListResponse:
        """列出用户的运行记录（支持按项目/类型/状态筛选）"""
        base = (
            select(AIRun)
            .join(LangGraphSession, AIRun.session_id == LangGraphSession.id)
            .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
            .join(Project, LangGraphWorkflow.project_id == Project.id)
            .where(Project.user_id == user_id)
        )
        if project_id is not None:
            base = base.where(LangGraphWorkflow.project_id == project_id)
        if workflow_type is not None:
            base = base.where(AIRun.workflow_type == workflow_type)
        if status is not None:
            base = base.where(AIRun.status == status)

        count_result = await self.db.execute(select(func.count()).select_from(base.subquery()))
        total = count_result.scalar() or 0

        result = await self.db.execute(base.order_by(desc(AIRun.id)).offset(skip).limit(limit))
        runs = result.scalars().all()
        return RunListResponse(
            items=[RunResponse.model_validate(r) for r in runs],
            total=total,
        )

    async def cancel_run(self, run_id: int, user_id: int) -> AIRun:
        """取消运行（仅 pending/running 状态可取消）"""
        run = await self._get_run_with_access(run_id, user_id)
        if run.status not in (RunStatus.PENDING.value, RunStatus.RUNNING.value):
            raise ForbiddenError(f"当前状态 '{run.status}' 不可取消")

        # 1. 尝试真正取消后台 task（如果是通过 start-stream 启动的）
        task_status = background_runner.get_status(run_id)
        if task_status and task_status.get("running"):
            background_runner.cancel(run_id)

        # 2. 更新 DB 状态
        run.status = RunStatus.CANCELLED.value
        run.finished_at = datetime.now(UTC)
        await self.db.commit()
        return run

    async def get_run_events(self, run_id: int, user_id: int) -> list[AIRunEvent]:
        """获取运行的事件列表"""
        await self._get_run_with_access(run_id, user_id)
        result = await self.db.execute(
            select(AIRunEvent).where(AIRunEvent.run_id == run_id).order_by(AIRunEvent.sequence)
        )
        return list(result.scalars().all())

    # ---------- Session / Artifact ----------

    async def get_session(self, session_id: int, user_id: int) -> LangGraphSession:
        """查看会话详情"""
        result = await self.db.execute(
            select(LangGraphSession)
            .join(LangGraphWorkflow, LangGraphSession.workflow_id == LangGraphWorkflow.id)
            .join(Project, LangGraphWorkflow.project_id == Project.id)
            .where(LangGraphSession.id == session_id, Project.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundError("会话不存在或无权访问")
        return session

    async def get_artifact(self, artifact_id: int, user_id: int) -> AIGeneratedContent:
        """获取 AI 生成产物"""
        result = await self.db.execute(
            select(AIGeneratedContent)
            .join(Project, AIGeneratedContent.project_id == Project.id)
            .where(AIGeneratedContent.id == artifact_id, Project.user_id == user_id)
        )
        artifact = result.scalar_one_or_none()
        if not artifact:
            raise NotFoundError("生成内容不存在或无权访问")
        return artifact

    # ---------- SSE 流式 ----------

    async def start_stream_run(self, run_id: int, user_id: int) -> tuple[AIRun, asyncio.Queue]:
        """启动后台流式运行，并注册 event_queue 供 /stream 实时消费"""
        run = await self._get_run_with_access(run_id, user_id)
        if run.status != RunStatus.PENDING.value:
            raise ForbiddenError(f"当前状态 '{run.status}' 不可启动流式运行")

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

                    from app.infrastructure.graph.runner import GraphRunner

                    GraphRunner(session, event_queue=queue)
                    # 这里需要一个模型和 input_state；实际场景由调用方在创建 run 时保留
                    # 为保持简单，consume_events 需要 model/input_state；
                    # 但 start-stream 作为通用端点，目前只做 queue 注册和状态变更。
                    # 真正的后台执行应由具体业务端点触发。本端点仅作示范：
                    # 如果 run 有 input_data，可解析后调用 runner.consume_events。
                    # 为兼容性，这里仅把 run 状态推进到 running。
                    run_obj.status = RunStatus.RUNNING.value
                    run_obj.started_at = datetime.now(UTC)
                    await session.commit()
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("start-stream background task failed for run %s", run_id)
                finally:
                    RUN_QUEUES.pop(run_id, None)

        background_runner.submit(run_id, _background_task())
        return run, queue

    async def stream_events(self, run_id: int, user_id: int) -> AsyncIterator[dict]:
        """SSE 事件流 — 流式获取运行过程中的实时事件"""
        run = await self._get_run_with_access(run_id, user_id)

        # 如果 run 已完成，直接 replay 历史事件
        if run.status in (RunStatus.SUCCEEDED.value, RunStatus.FAILED.value, RunStatus.CANCELLED.value):
            async for item in self._replay_events(run_id, run.status):
                yield item
            return

        # run 仍在进行中 — 从注册表拉取实时事件
        queue = RUN_QUEUES.get(run_id)
        if queue is None:
            # 没有活跃的 queue，返回静态提示
            yield {
                "event": "info",
                "data": json.dumps(
                    {"type": "info", "message": "Run is still in progress", "status": run.status},
                    ensure_ascii=False,
                ),
            }
            return

        # 实时消费 queue 中的事件
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

    async def _replay_events(self, run_id: int, run_status: str) -> AsyncIterator[dict]:
        """回放已落库的历史事件"""
        result = await self.db.execute(
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
            "data": json.dumps({"type": "done", "status": run_status}, ensure_ascii=False),
        }
