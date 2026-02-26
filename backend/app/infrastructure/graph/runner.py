"""
Graph Runner — 执行图、采集事件、管理运行生命周期

职责:
1. 创建/恢复会话
2. 启动 run（调用图）
3. 事件采集（node_start/end, token, error）
4. 结果落库
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

from langchain_core.language_models import BaseChatModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.ai_runtime.enums import RunStatus, EventType
from app.infrastructure.db.models.ai_runtime import (
    LangGraphSession, AIRun, AIRunEvent, AIGeneratedContent,
)
from .registry import graph_registry

logger = logging.getLogger(__name__)


class GraphRunner:
    """图运行器：封装 LangGraph 图的执行生命周期"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_session(
        self, workflow_id: int, thread_id: str,
    ) -> LangGraphSession:
        """获取或创建会话"""
        from sqlalchemy import select

        result = await self.db.execute(
            select(LangGraphSession).where(LangGraphSession.thread_id == thread_id)
        )
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
        self, session: LangGraphSession, workflow_type: str,
        input_data: Optional[dict] = None,
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

    async def execute(
        self, run: AIRun, model: BaseChatModel,
        input_state: dict, **graph_kwargs,
    ) -> dict:
        """同步执行图并返回最终状态（非流式）"""
        now = datetime.now(timezone.utc)
        run.status = RunStatus.RUNNING
        run.started_at = now
        await self.db.flush()

        seq = 0
        try:
            builder = graph_registry.get(run.workflow_type)
            graph = builder(model, **graph_kwargs)

            # 记录开始事件
            seq = await self._record_event(
                run.id, EventType.NODE_START, "graph", seq,
            )

            result = await graph.ainvoke(input_state)

            # 记录完成事件
            seq = await self._record_event(
                run.id, EventType.NODE_END, "graph", seq,
                data={"keys": list(result.keys()) if isinstance(result, dict) else None},
            )

            run.status = RunStatus.SUCCEEDED
            run.output_data = json.dumps(
                result, ensure_ascii=False, default=str,
            ) if isinstance(result, dict) else str(result)
            run.finished_at = datetime.now(timezone.utc)
            await self.db.flush()
            return result

        except Exception as exc:
            logger.exception("Graph run %s failed", run.id)
            await self._record_event(
                run.id, EventType.ERROR, None, seq + 1,
                data={"error": str(exc)},
            )
            run.status = RunStatus.FAILED
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            await self.db.flush()
            raise

    async def execute_stream(
        self, run: AIRun, model: BaseChatModel,
        input_state: dict, **graph_kwargs,
    ) -> AsyncIterator[dict]:
        """流式执行图，逐步 yield 事件（供 SSE 使用）"""
        now = datetime.now(timezone.utc)
        run.status = RunStatus.RUNNING
        run.started_at = now
        await self.db.flush()

        seq = 0
        try:
            builder = graph_registry.get(run.workflow_type)
            graph = builder(model, **graph_kwargs)

            async for event in graph.astream_events(input_state, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_chain_start":
                    seq = await self._record_event(
                        run.id, EventType.NODE_START, name, seq,
                    )
                    yield {"type": "node_start", "node": name}

                elif kind == "on_chain_end":
                    seq = await self._record_event(
                        run.id, EventType.NODE_END, name, seq,
                    )
                    yield {"type": "node_end", "node": name}

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        yield {"type": "token", "content": chunk.content}

            run.status = RunStatus.SUCCEEDED
            run.finished_at = datetime.now(timezone.utc)
            await self.db.flush()
            yield {"type": "done"}

        except Exception as exc:
            logger.exception("Graph stream run %s failed", run.id)
            await self._record_event(
                run.id, EventType.ERROR, None, seq + 1,
                data={"error": str(exc)},
            )
            run.status = RunStatus.FAILED
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            await self.db.flush()
            yield {"type": "error", "message": str(exc)}

    async def _record_event(
        self, run_id: int, event_type: EventType,
        node_name: Optional[str], seq: int,
        data: Optional[dict] = None,
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
