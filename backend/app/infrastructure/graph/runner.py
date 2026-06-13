"""
Graph Runner — 执行图、采集事件、管理运行生命周期

职责:
1. 创建/恢复会话
2. 启动 run（调用图）
3. 事件采集（node_start/end, token, error）
4. Token 回填（usage_metadata）
5. 结果落库
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from langchain_core.language_models import BaseChatModel
from langchain_core.messages.ai import add_usage
from langgraph.checkpoint.base import BaseCheckpointSaver
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import metrics
from app.domain.ai_runtime.enums import EventType, RunStatus
from app.infrastructure.db.models.ai_runtime import (
    AIRun,
    AIRunEvent,
    LangGraphSession,
)

from .registry import graph_registry

logger = logging.getLogger(__name__)


class GraphRunner:
    """图运行器：封装 LangGraph 图的执行生命周期"""

    def __init__(
        self,
        db: AsyncSession,
        checkpointer: BaseCheckpointSaver | None = None,
        event_queue: asyncio.Queue | None = None,
    ):
        self.db = db
        self.checkpointer = checkpointer
        self.event_queue = event_queue

    async def get_or_create_session(
        self,
        workflow_id: int,
        thread_id: str,
    ) -> LangGraphSession:
        """获取或创建会话"""
        from sqlalchemy import select

        result = await self.db.execute(select(LangGraphSession).where(LangGraphSession.thread_id == thread_id))
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

    async def create_run(
        self,
        session: LangGraphSession,
        workflow_type: str,
        input_data: dict | None = None,
    ) -> AIRun:
        """创建一次运行记录"""
        run = AIRun(
            session_id=session.id,
            workflow_type=workflow_type,
            status=RunStatus.PENDING,
            input_data=json.dumps(input_data, ensure_ascii=False) if input_data else None,
        )
        self.db.add(run)
        await self.db.flush()
        return run

    def _make_event_payload(
        self,
        event_type: str,
        node: str | None = None,
        sequence: int = 0,
        data: dict | None = None,
        run_id: int | None = None,
    ) -> dict:
        """构造统一的事件 payload"""
        payload = {
            "type": event_type,
            "node": node,
            "sequence": sequence,
            "data": data,
            "run_id": run_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        return payload

    async def _push_event(self, payload: dict) -> None:
        """推送事件到 queue（如果已注册）"""
        if self.event_queue is not None:
            try:
                self.event_queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("Event queue full, dropping event: %s", payload.get("type"))

    async def execute(
        self,
        run: AIRun,
        model: BaseChatModel,
        input_state: dict,
        **graph_kwargs,
    ) -> dict:
        """同步执行图并返回最终状态（非流式）"""
        now = datetime.now(UTC)
        run.status = RunStatus.RUNNING
        run.started_at = now
        await self.db.flush()

        seq = 0
        total_usage = None
        started_at = datetime.now(UTC)

        try:
            builder = graph_registry.get(run.workflow_type)
            graph = builder(model, checkpointer=self.checkpointer, **graph_kwargs)

            # 记录开始事件
            seq = await self._record_event(
                run.id,
                EventType.NODE_START,
                "graph",
                seq,
            )
            payload = self._make_event_payload("node_start", "graph", seq, run_id=run.id)
            await self._push_event(payload)

            config = graph_kwargs.get("config")
            context = graph_kwargs.get("context")
            invoke_kwargs = {}
            if self.checkpointer is not None and config is not None:
                invoke_kwargs["config"] = config
            if context is not None:
                invoke_kwargs["context"] = context
            result = await graph.ainvoke(input_state, **invoke_kwargs)

            # 记录完成事件
            seq = await self._record_event(
                run.id,
                EventType.NODE_END,
                "graph",
                seq,
                data={"keys": list(result.keys()) if isinstance(result, dict) else None},
            )
            payload = self._make_event_payload(
                "node_end",
                "graph",
                seq,
                data={"keys": list(result.keys()) if isinstance(result, dict) else None},
                run_id=run.id,
            )
            await self._push_event(payload)

            # Token 回填
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)

            run.status = RunStatus.SUCCEEDED
            run.output_data = (
                json.dumps(
                    result,
                    ensure_ascii=False,
                    default=str,
                )
                if isinstance(result, dict)
                else str(result)
            )
            run.finished_at = datetime.now(UTC)
            await self.db.flush()

            # 记录 metrics
            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=True, duration_s=duration, tokens=run.tokens_used or 0)

            # 推送 done 事件
            await self._push_event(
                self._make_event_payload(
                    "done",
                    sequence=seq + 1,
                    data={"status": "succeeded", "tokens_used": run.tokens_used},
                    run_id=run.id,
                )
            )

            return result

        except asyncio.CancelledError:
            logger.info("Graph run %s was cancelled", run.id)
            run.status = RunStatus.CANCELLED
            run.finished_at = datetime.now(UTC)
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)
            await self.db.flush()
            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=False, duration_s=duration, tokens=run.tokens_used or 0)
            await self._push_event(
                self._make_event_payload(
                    "cancelled",
                    sequence=seq + 1,
                    run_id=run.id,
                )
            )
            raise

        except Exception as exc:
            logger.exception("Graph run %s failed", run.id)
            await self._record_event(
                run.id,
                EventType.ERROR,
                None,
                seq + 1,
                data={"error": str(exc)},
            )
            run.status = RunStatus.FAILED
            run.error_message = str(exc)
            run.finished_at = datetime.now(UTC)
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)
            await self.db.flush()
            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=False, duration_s=duration, tokens=run.tokens_used or 0)
            await self._push_event(
                self._make_event_payload(
                    "error",
                    sequence=seq + 1,
                    data={"message": str(exc)},
                    run_id=run.id,
                )
            )
            raise

    async def execute_stream(
        self,
        run: AIRun,
        model: BaseChatModel,
        input_state: dict,
        **graph_kwargs,
    ) -> AsyncIterator[dict]:
        """流式执行图，逐步 yield 事件（供 SSE 使用）"""
        now = datetime.now(UTC)
        run.status = RunStatus.RUNNING
        run.started_at = now
        await self.db.flush()

        seq = 0
        total_usage = None
        started_at = datetime.now(UTC)

        try:
            builder = graph_registry.get(run.workflow_type)
            graph = builder(model, checkpointer=self.checkpointer, **graph_kwargs)

            config = graph_kwargs.get("config")
            context = graph_kwargs.get("context")
            stream_kwargs = {"version": "v2"}
            if self.checkpointer is not None and config is not None:
                stream_kwargs["config"] = config
            if context is not None:
                stream_kwargs["context"] = context
            stream_iter = graph.astream_events(input_state, **stream_kwargs)
            async for event in stream_iter:
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_chain_start":
                    seq = await self._record_event(
                        run.id,
                        EventType.NODE_START,
                        name,
                        seq,
                    )
                    payload = self._make_event_payload("node_start", name, seq, run_id=run.id)
                    await self._push_event(payload)
                    yield payload

                elif kind == "on_chain_end":
                    seq = await self._record_event(
                        run.id,
                        EventType.NODE_END,
                        name,
                        seq,
                    )
                    payload = self._make_event_payload("node_end", name, seq, run_id=run.id)
                    await self._push_event(payload)
                    yield payload

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        payload = self._make_event_payload(
                            "token",
                            name,
                            seq,
                            data={"content": chunk.content},
                            run_id=run.id,
                        )
                        await self._push_event(payload)
                        yield payload

                elif kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output")
                    if output and hasattr(output, "usage_metadata") and output.usage_metadata:
                        usage = output.usage_metadata
                        total_usage = add_usage(total_usage, usage)
                        payload = self._make_event_payload(
                            "usage",
                            name,
                            seq,
                            data={
                                "input_tokens": usage.get("input_tokens", 0),
                                "output_tokens": usage.get("output_tokens", 0),
                                "total_tokens": usage.get("total_tokens", 0),
                            },
                            run_id=run.id,
                        )
                        await self._push_event(payload)
                        yield payload

            run.status = RunStatus.SUCCEEDED
            run.finished_at = datetime.now(UTC)
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)
            await self.db.flush()

            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=True, duration_s=duration, tokens=run.tokens_used or 0)

            done_payload = self._make_event_payload(
                "done",
                sequence=seq + 1,
                data={"status": "succeeded", "tokens_used": run.tokens_used},
                run_id=run.id,
            )
            await self._push_event(done_payload)
            yield done_payload

        except asyncio.CancelledError:
            logger.info("Graph stream run %s was cancelled", run.id)
            run.status = RunStatus.CANCELLED
            run.finished_at = datetime.now(UTC)
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)
            await self.db.flush()
            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=False, duration_s=duration, tokens=run.tokens_used or 0)
            payload = self._make_event_payload("cancelled", sequence=seq + 1, run_id=run.id)
            await self._push_event(payload)
            yield payload
            raise

        except Exception as exc:
            logger.exception("Graph stream run %s failed", run.id)
            await self._record_event(
                run.id,
                EventType.ERROR,
                None,
                seq + 1,
                data={"error": str(exc)},
            )
            run.status = RunStatus.FAILED
            run.error_message = str(exc)
            run.finished_at = datetime.now(UTC)
            if total_usage:
                run.tokens_used = total_usage.get("total_tokens", 0)
            await self.db.flush()
            duration = (run.finished_at - started_at).total_seconds()
            metrics.record_ai_run(succeeded=False, duration_s=duration, tokens=run.tokens_used or 0)
            payload = self._make_event_payload(
                "error",
                sequence=seq + 1,
                data={"message": str(exc)},
                run_id=run.id,
            )
            await self._push_event(payload)
            yield payload

    async def consume_events(
        self,
        run: AIRun,
        model: BaseChatModel,
        input_state: dict,
        **graph_kwargs,
    ) -> AsyncIterator[dict]:
        """
        异步生成器：内部启动 event_queue，驱动 execute_stream 并将事件 yield 给 SSE。
        这是 execute_stream 的 queue-based 包装，用于 SSE 实时流。
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self.event_queue = queue

        async def _worker():
            try:
                # 迭代 consume 掉 execute_stream 的所有 yield
                async for _ in self.execute_stream(run, model, input_state, **graph_kwargs):
                    pass
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                # 将异常包装为 error 事件 push 到 queue
                try:
                    queue.put_nowait(
                        self._make_event_payload(
                            "error",
                            sequence=-1,
                            data={"message": str(exc)},
                            run_id=run.id,
                        )
                    )
                except asyncio.QueueFull:
                    pass

        task = asyncio.create_task(_worker(), name=f"graph-worker-{run.id}")
        try:
            while True:
                event = await queue.get()
                yield event
                if event.get("type") in ("done", "error", "cancelled"):
                    break
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    async def _record_event(
        self,
        run_id: int,
        event_type: EventType,
        node_name: str | None,
        seq: int,
        data: dict | None = None,
    ) -> int:
        """记录事件并返回下一个序列号"""
        evt = AIRunEvent(
            run_id=run_id,
            event_type=event_type.value,
            node_name=node_name,
            sequence=seq,
            data=json.dumps(data, ensure_ascii=False) if data else None,
        )
        self.db.add(evt)
        await self.db.flush()
        return seq + 1
