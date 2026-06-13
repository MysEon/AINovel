"""LegacyAIService 单元测试"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from langchain_core.messages import AIMessage

from app.application.legacy_ai_service import LegacyAIService
from app.application.project_service import ProjectService
from app.application.prompt_template_service import PromptTemplateService
from app.core.exceptions import NotFoundError
from app.infrastructure.db.models.worldbuilding import Character
from app.infrastructure.graph.registry import graph_registry
from app.schemas.projects import ProjectCreate
from app.schemas.prompts import PromptTemplateCreate


class MockChatGraph:
    def __init__(self, response: str = "图回复"):
        self.response = response
        self.ainvoke_calls = []
        self.astream_calls = []

    async def ainvoke(self, input_state, **kwargs):
        self.ainvoke_calls.append((input_state, kwargs))
        return {"messages": [*input_state["messages"], AIMessage(content=self.response)]}

    async def astream_events(self, input_state, **kwargs):
        self.astream_calls.append((input_state, kwargs))
        yield {"event": "on_chain_start", "name": "agent", "data": {}}
        yield {"event": "on_chat_model_stream", "name": "model", "data": {"chunk": SimpleNamespace(content="流式回复")}}
        yield {"event": "on_chain_end", "name": "agent", "data": {}}


class TestLegacyAIService:
    async def _create_project(self, db_session, user_id, name="测试项目"):
        proj_service = ProjectService(db_session)
        return await proj_service.create(ProjectCreate(name=name), user_id)

    def _patch_graph(self, monkeypatch, graph: MockChatGraph):
        builder_calls = []

        def builder(**kwargs):
            builder_calls.append(kwargs)
            return graph

        monkeypatch.setattr(graph_registry, "get", lambda workflow_type: builder)
        return builder_calls

    async def test_get_project_context(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id, name="上下文项目")
        service = LegacyAIService(db_session)
        result = await service.get_project_context(project.id, test_user.id)
        assert result["success"] is True
        assert result["context"]["project_name"] == "上下文项目"

    async def test_available_models(self, db_session):
        service = LegacyAIService(db_session)
        result = service.available_models()
        assert result["success"] is True
        assert len(result["models"]) > 0

    async def test_get_project_context_not_found(self, db_session, test_user):
        service = LegacyAIService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_project_context(99999, test_user.id)

    async def test_simple_generate_no_config(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = LegacyAIService(db_session)
        with pytest.raises(NotFoundError):
            await service.simple_generate(project.id, 99999, test_user.id, "system", "user")

    async def test_chat_without_prompt_template_uses_graph_context(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="默认项目")
        service = LegacyAIService(db_session)
        model = SimpleNamespace()
        graph = MockChatGraph(response="默认回复")
        builder_calls = self._patch_graph(monkeypatch, graph)
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=model))
        monkeypatch.setattr(service, "_get_session_factory", lambda: "session_factory")

        result = await service.chat(
            project_id=project.id,
            model_config_id=1,
            message="继续写",
            history=None,
            user_id=test_user.id,
        )

        assert result["success"] is True
        assert result["response"] == "默认回复"
        assert builder_calls == [{"model": model}]
        input_state, kwargs = graph.ainvoke_calls[0]
        assert input_state["messages"][-1].content == "继续写"
        assert kwargs["context"].project_id == project.id
        assert kwargs["context"].session_factory == "session_factory"
        assert kwargs["context"].injected_system_prompt is None

    async def test_chat_with_prompt_template_passes_rendered_prompt_to_context(
        self, db_session, test_user, monkeypatch
    ):
        project = await self._create_project(db_session, test_user.id, name="模板项目")
        db_session.add(
            Character(
                project_id=project.id,
                name="阿宁",
                description="潜入专家",
                personality="谨慎",
                background="旧城出身",
                appearance="银发蓝眼",
            )
        )
        await db_session.commit()
        service = LegacyAIService(db_session)
        prompt_service = PromptTemplateService(db_session)
        template = await prompt_service.create_template(
            PromptTemplateCreate(
                name="对话模板",
                category="chat",
                template="项目：{{project_info}}\n上下文：{{project_context}}\n历史：{{history}}\n消息：{{message}}",
            ),
            test_user.id,
        )
        graph = MockChatGraph(response="模板回复")
        self._patch_graph(monkeypatch, graph)
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=SimpleNamespace()))
        monkeypatch.setattr(service, "_get_session_factory", lambda: "session_factory")

        result = await service.chat(
            project_id=project.id,
            model_config_id=1,
            message="用户原文",
            history=[
                {"role": "user", "content": "你好"},
                {"role": "assistant", "content": "您好"},
            ],
            user_id=test_user.id,
            prompt_template_id=template.id,
        )

        assert result["success"] is True
        input_state, kwargs = graph.ainvoke_calls[0]
        assert [msg.content for msg in input_state["messages"]] == ["你好", "您好", "用户原文"]
        injected = kwargs["context"].injected_system_prompt
        assert "模板项目" in injected
        assert "阿宁" in injected
        assert "外貌：银发蓝眼" in injected
        assert "用户原文" in injected
        assert "用户: 你好" in injected
        assert "助手: 您好" in injected
        refreshed = await prompt_service.get_template(template.id, test_user.id)
        assert refreshed.usage_count == 1

    async def test_chat_with_invalid_prompt_template(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="异常项目")
        service = LegacyAIService(db_session)
        graph = MockChatGraph(response="不应调用")
        self._patch_graph(monkeypatch, graph)
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=SimpleNamespace()))

        with pytest.raises(NotFoundError):
            await service.chat(
                project_id=project.id,
                model_config_id=1,
                message="继续写",
                history=None,
                user_id=test_user.id,
                prompt_template_id=99999,
            )
        assert graph.ainvoke_calls == []

    async def test_chat_stream_yields_text_and_done_events(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="流式项目")
        service = LegacyAIService(db_session)
        graph = MockChatGraph()
        self._patch_graph(monkeypatch, graph)
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=SimpleNamespace()))
        monkeypatch.setattr(service, "_get_session_factory", lambda: "session_factory")

        stream = await service.chat_stream(
            project_id=project.id,
            model_config_id=1,
            message="继续写",
            history=None,
            user_id=test_user.id,
        )
        rows = [row async for row in stream]
        parsed = [json.loads(row.removeprefix("data: ")) for row in rows]

        assert any(item["type"] == "text" and item["payload"]["chunk"] == "流式回复" for item in parsed)
        assert parsed[-1] == {"type": "done", "payload": {}}
        assert graph.astream_calls[0][1]["context"].project_id == project.id
