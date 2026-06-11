"""Cancel 集成测试"""

from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import select

from app.infrastructure.db.models.ai_runtime import (
    LangGraphWorkflow, LangGraphSession, AIRun,
)
from app.infrastructure.graph.runner import GraphRunner
from app.infrastructure.graph.registry import graph_registry
from app.infrastructure.task.runner import background_runner
from app.domain.ai_runtime.enums import RunStatus


class SlowMockGraph:
    """模拟一个慢速图，可被取消"""

    async def ainvoke(self, state, **kwargs):
        import asyncio
        await asyncio.sleep(100)
        return {"outline": {"title": "slow"}}

    async def astream_events(self, state, version, **kwargs):
        import asyncio
        yield {"event": "on_chain_start", "name": "node1"}
        await asyncio.sleep(100)
        yield {"event": "on_chain_end", "name": "node1"}


def mock_slow_graph_builder(model, **kwargs):
    return SlowMockGraph()


class TestCancel:
    async def _create_project_and_run(self, db_session, client, auth_headers):
        """辅助：通过 API 创建项目，然后在 DB 中构造 workflow/session/run"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "cancel-test-project",
        })
        assert proj_resp.status_code == 201
        project_id = proj_resp.json()["id"]

        workflow = LangGraphWorkflow(
            name="cancel-test", workflow_type="chapter_outline",
            project_id=project_id, model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(workflow_id=workflow.id, thread_id=f"cancel-thread-{workflow.id}")
        db_session.add(session)
        await db_session.flush()

        run = AIRun(
            session_id=session.id, workflow_type="chapter_outline",
            status=RunStatus.RUNNING.value,
        )
        db_session.add(run)
        await db_session.commit()
        return run

    async def test_cancel_run_calls_background_runner_cancel(self, db_session, client, auth_headers):
        """cancel_run API 调 background_runner.cancel()（用 monkeypatch 验证）"""
        run = await self._create_project_and_run(db_session, client, auth_headers)

        # 先 submit 一个假后台任务，使 get_status 返回 running
        async def _dummy():
            import asyncio
            await asyncio.sleep(100)
        background_runner.submit(run.id, _dummy())

        # monkeypatch background_runner.cancel 以记录调用
        called = []

        def fake_cancel(run_id):
            called.append(run_id)
            return True

        with patch.object(background_runner, "cancel", side_effect=fake_cancel):
            resp = await client.post(
                f"/api/v1/ai/runs/{run.id}/cancel",
                headers=auth_headers,
            )

        # 清理假任务
        background_runner.cancel(run.id)
        background_runner.cleanup_done()

        assert resp.status_code == 200
        assert called == [run.id]

    async def test_cancelled_status_written_to_db(self, db_session, client, auth_headers):
        """cancelled 状态写回 DB"""
        run = await self._create_project_and_run(db_session, client, auth_headers)

        resp = await client.post(
            f"/api/v1/ai/runs/{run.id}/cancel",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == RunStatus.CANCELLED.value
        assert data["finished_at"] is not None
