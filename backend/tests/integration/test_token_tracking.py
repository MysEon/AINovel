"""Token 跟踪集成测试"""

from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import select

from app.infrastructure.db.models.ai_runtime import (
    LangGraphWorkflow, LangGraphSession, AIRun,
)
from app.infrastructure.graph.runner import GraphRunner
from app.infrastructure.graph.registry import graph_registry
from app.domain.ai_runtime.enums import RunStatus


class MockGraphWithUsage:
    """模拟 LangGraph 图，携带 usage_metadata"""

    async def ainvoke(self, state, **kwargs):
        return {"outline": {"title": "test"}}

    async def astream_events(self, state, version, **kwargs):
        # 模拟两个 chat_model 调用，每个都有 usage
        for i in range(2):
            chunk = MagicMock(content=f"token{i}")
            yield {"event": "on_chat_model_stream", "name": f"llm_{i}", "data": {"chunk": chunk}}
            msg = MagicMock()
            msg.usage_metadata = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}
            yield {"event": "on_chat_model_end", "name": f"llm_{i}", "data": {"output": msg}}


def mock_graph_builder_with_usage(model, **kwargs):
    return MockGraphWithUsage()


class TestTokenTracking:
    async def test_token_usage_recorded(self, db_session):
        """on_chat_model_end 携带 usage_metadata → run.tokens_used > 0"""
        workflow = LangGraphWorkflow(
            name="token-test", workflow_type="chapter_outline",
            project_id=1, model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(workflow_id=workflow.id, thread_id="token-thread-001")
        db_session.add(session)
        await db_session.flush()

        runner = GraphRunner(db_session)
        run = await runner.create_run(session, "chapter_outline", {"project_name": "test"})

        with patch.object(graph_registry, "get", return_value=mock_graph_builder_with_usage):
            async for _ in runner.execute_stream(run, None, {"project_name": "test"}):
                pass

        await db_session.refresh(run)
        assert run.tokens_used == 30
        assert run.status == RunStatus.SUCCEEDED.value

    async def test_token_usage_accumulated_across_rounds(self, db_session):
        """多轮 chat 累加 token"""
        workflow = LangGraphWorkflow(
            name="token-test2", workflow_type="chapter_outline",
            project_id=1, model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(workflow_id=workflow.id, thread_id="token-thread-002")
        db_session.add(session)
        await db_session.flush()

        runner = GraphRunner(db_session)
        run = await runner.create_run(session, "chapter_outline", {"project_name": "test"})

        with patch.object(graph_registry, "get", return_value=mock_graph_builder_with_usage):
            result = await runner.execute(run, None, {"project_name": "test"})

        await db_session.refresh(run)
        # execute 路径也会遇到 astream_events 吗？不会，execute 用 ainvoke
        # 本测试验证 execute_stream 的累加，因此重新跑一次 stream
        run2 = await runner.create_run(session, "chapter_outline", {"project_name": "test"})
        with patch.object(graph_registry, "get", return_value=mock_graph_builder_with_usage):
            async for _ in runner.execute_stream(run2, None, {"project_name": "test"}):
                pass

        await db_session.refresh(run2)
        # 两轮 chat，每轮 15 tokens，共 30
        assert run2.tokens_used == 30
