"""AI Runtime 集成测试"""

import json
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import select

from app.infrastructure.db.models.ai_runtime import (
    LangGraphWorkflow, LangGraphSession, AIRun, AIRunEvent, AIGeneratedContent,
)
from app.infrastructure.graph.runner import GraphRunner
from app.infrastructure.graph.registry import graph_registry
from app.domain.ai_runtime.enums import RunStatus, EventType


class MockGraph:
    """模拟 LangGraph 图，用于测试 runner"""

    async def ainvoke(self, state, **kwargs):
        return {
            "outline": {
                "chapter_title": "测试章节",
                "summary": "这是一个测试大纲",
            }
        }

    async def astream_events(self, state, version, **kwargs):
        # 模拟节点事件流
        yield {"event": "on_chain_start", "name": "build_prompt"}
        yield {"event": "on_chain_end", "name": "build_prompt"}
        yield {"event": "on_chain_start", "name": "generate_outline"}
        yield {"event": "on_chat_model_stream", "data": {"chunk": MagicMock(content="测试token")}}
        yield {"event": "on_chain_end", "name": "generate_outline"}
        yield {"event": "on_chain_start", "name": "format_output"}
        yield {"event": "on_chain_end", "name": "format_output"}


def mock_graph_builder(model, **kwargs):
    return MockGraph()


class TestAIRun:
    async def test_create_and_query_airun(self, db_session):
        """AIRun 创建与查询"""
        # 先创建 workflow 和 session
        workflow = LangGraphWorkflow(
            name="测试工作流",
            workflow_type="chapter_outline",
            project_id=1,
            model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(
            workflow_id=workflow.id,
            thread_id="test-thread-001",
        )
        db_session.add(session)
        await db_session.flush()

        run = AIRun(
            session_id=session.id,
            workflow_type="chapter_outline",
            status=RunStatus.PENDING.value,
            input_data=json.dumps({"project_name": "测试"}),
        )
        db_session.add(run)
        await db_session.commit()
        await db_session.refresh(run)

        assert run.id is not None
        assert run.status == RunStatus.PENDING.value
        assert run.session_id == session.id

        # 查询验证
        result = await db_session.execute(select(AIRun).where(AIRun.id == run.id))
        fetched = result.scalar_one()
        assert fetched.workflow_type == "chapter_outline"

    async def test_chapter_outline_workflow(self, db_session):
        """chapter_outline 工作流在 mock LLM 下能跑通"""
        # 准备前置数据
        from app.infrastructure.db.models.projects import Project
        from app.infrastructure.db.models.model_configs import ModelConfig

        project = Project(name="测试项目", user_id=1)
        db_session.add(project)
        await db_session.flush()

        model_config = ModelConfig(name="测试模型", model_type="openai", user_id=1)
        db_session.add(model_config)
        await db_session.flush()

        workflow = LangGraphWorkflow(
            name="大纲工作流",
            workflow_type="chapter_outline",
            project_id=project.id,
            model_config_id=model_config.id,
        )
        db_session.add(workflow)
        await db_session.flush()

        runner = GraphRunner(db_session)
        session = await runner.get_or_create_session(workflow.id, "thread-outline-001")
        run = await runner.create_run(session, "chapter_outline", {"project_name": "测试项目"})

        with patch.object(graph_registry, "get", return_value=mock_graph_builder):
            result = await runner.execute(run, None, {
                "project_name": "测试项目",
                "chapter_number": 1,
            })

        assert result is not None
        assert "outline" in result
        assert result["outline"]["chapter_title"] == "测试章节"

        # 验证 run 状态已更新
        await db_session.refresh(run)
        assert run.status == RunStatus.SUCCEEDED.value
        assert run.output_data is not None
        assert run.finished_at is not None

    async def test_airun_event_sequence(self, db_session):
        """AIRunEvent 落库顺序正确"""
        workflow = LangGraphWorkflow(
            name="事件测试工作流",
            workflow_type="chapter_outline",
            project_id=1,
            model_config_id=1,
        )
        db_session.add(workflow)
        await db_session.flush()

        session = LangGraphSession(
            workflow_id=workflow.id,
            thread_id="thread-event-001",
        )
        db_session.add(session)
        await db_session.flush()

        runner = GraphRunner(db_session)
        run = await runner.create_run(session, "chapter_outline")

        # 模拟记录若干事件
        seq = await runner._record_event(run.id, EventType.NODE_START, "node_a", 0)
        seq = await runner._record_event(run.id, EventType.NODE_END, "node_a", seq)
        seq = await runner._record_event(run.id, EventType.NODE_START, "node_b", seq)
        seq = await runner._record_event(run.id, EventType.NODE_END, "node_b", seq)
        await db_session.commit()

        result = await db_session.execute(
            select(AIRunEvent).where(AIRunEvent.run_id == run.id).order_by(AIRunEvent.sequence)
        )
        events = result.scalars().all()

        assert len(events) == 4
        assert events[0].sequence == 0
        assert events[0].event_type == EventType.NODE_START.value
        assert events[0].node_name == "node_a"
        assert events[1].sequence == 1
        assert events[1].event_type == EventType.NODE_END.value
        assert events[2].sequence == 2
        assert events[3].sequence == 3
