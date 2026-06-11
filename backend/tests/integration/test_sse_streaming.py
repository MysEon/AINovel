"""SSE 实时流集成测试"""

import asyncio
from unittest.mock import MagicMock

from app.application.ai_workflow_service import RUN_QUEUES
from app.domain.ai_runtime.enums import EventType, RunStatus
from app.infrastructure.db.models.ai_runtime import (
    AIRun,
    AIRunEvent,
    LangGraphSession,
    LangGraphWorkflow,
)


class MockSSEGraph:
    """模拟 LangGraph 图，产生 SSE 可用事件"""

    async def ainvoke(self, state, **kwargs):
        return {"outline": {"title": "test"}}

    async def astream_events(self, state, version, **kwargs):
        yield {"event": "on_chain_start", "name": "build_prompt"}
        yield {"event": "on_chain_end", "name": "build_prompt"}
        yield {"event": "on_chat_model_stream", "data": {"chunk": MagicMock(content="hello")}}
        yield {
            "event": "on_chat_model_end",
            "name": "generate_outline",
            "data": {"output": MagicMock(usage_metadata=None)},
        }
        yield {"event": "on_chain_end", "name": "generate_outline"}


def mock_sse_graph_builder(model, **kwargs):
    return MockSSEGraph()


class TestSSEStreaming:
    async def _create_project_and_run(self, db_session, client, auth_headers, status):
        """辅助：通过 API 创建项目，然后在 DB 中构造 workflow/session/run"""
        proj_resp = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={
                "name": "sse-test-project",
            },
        )
        assert proj_resp.status_code == 201
        project_id = proj_resp.json()["id"]

        workflow = LangGraphWorkflow(
            name="sse-test",
            workflow_type="chapter_outline",
            project_id=project_id,
            model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(workflow_id=workflow.id, thread_id=f"sse-thread-{workflow.id}")
        db_session.add(session)
        await db_session.flush()

        run = AIRun(
            session_id=session.id,
            workflow_type="chapter_outline",
            status=status,
        )
        db_session.add(run)
        await db_session.commit()
        return run

    async def test_sse_completed_run_replay(self, db_session, client, auth_headers):
        """SSE 端点对 completed run 返回历史事件（replay 路径）"""
        run = await self._create_project_and_run(db_session, client, auth_headers, RunStatus.SUCCEEDED.value)

        # 插入两条历史事件
        for seq, (etype, node) in enumerate([(EventType.NODE_START, "node_a"), (EventType.NODE_END, "node_a")]):
            evt = AIRunEvent(
                run_id=run.id,
                event_type=etype.value,
                node_name=node,
                sequence=seq,
            )
            db_session.add(evt)
        await db_session.commit()

        resp = await client.get(
            f"/api/v1/ai/runs/{run.id}/stream",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.text
        assert "node_a" in body
        assert "done" in body

    async def test_sse_running_run_live_events(self, db_session, client, auth_headers):
        """SSE 端点对 running run 推送实时事件（mock queue + GraphRunner）"""
        run = await self._create_project_and_run(db_session, client, auth_headers, RunStatus.RUNNING.value)

        # 注册一个 mock queue，预置事件
        queue = asyncio.Queue()
        await queue.put({"type": "token", "content": "hello", "run_id": run.id})
        await queue.put({"type": "done", "status": "succeeded", "run_id": run.id})
        RUN_QUEUES[run.id] = queue

        try:
            resp = await client.get(
                f"/api/v1/ai/runs/{run.id}/stream",
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.text
            assert "hello" in body
            assert "done" in body
        finally:
            RUN_QUEUES.pop(run.id, None)

    async def test_sse_content_type_is_event_stream(self, db_session, client, auth_headers):
        """EventSourceResponse content-type 是 text/event-stream"""
        run = await self._create_project_and_run(db_session, client, auth_headers, RunStatus.SUCCEEDED.value)

        resp = await client.get(
            f"/api/v1/ai/runs/{run.id}/stream",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        ct = resp.headers.get("content-type", "")
        assert "text/event-stream" in ct
