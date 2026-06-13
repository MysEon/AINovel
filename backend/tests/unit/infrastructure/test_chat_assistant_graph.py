"""Chat assistant graph workflow tests."""

from contextlib import asynccontextmanager

import pytest
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import PrivateAttr

import app.infrastructure.graph.workflows  # noqa: F401
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext
from app.infrastructure.graph.registry import graph_registry
from app.infrastructure.graph.workflows.chat_assistant import _load_project_context


class EchoMockModel(BaseChatModel):
    _last_messages: list = PrivateAttr(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "echo-mock"

    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        self._last_messages = list(messages)
        system_text = "\n".join(str(getattr(m, "content", "")) for m in messages if getattr(m, "type", "") == "system")
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content=f"系统包含外貌={'外貌' in system_text}"))]
        )


@asynccontextmanager
async def _same_session_factory(db_session):
    yield db_session


async def _seed_project(db_session, user_id: int):
    project = Project(name="图测试项目", description="图测试简介", user_id=user_id)
    db_session.add(project)
    await db_session.flush()
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
    return project


@pytest.mark.asyncio
async def test_load_project_context_uses_ai_context_builder_chat_budget(db_session, test_user):
    project = await _seed_project(db_session, test_user.id)

    text = await _load_project_context(project.id, lambda: _same_session_factory(db_session))

    assert "图测试项目" in text
    assert "阿宁" in text
    assert "外貌：银发蓝眼" in text
    assert "世界观" not in text
    assert len(text) <= 4000


def test_chat_assistant_registered():
    assert "chat_assistant" in graph_registry.registered_types


@pytest.mark.asyncio
async def test_chat_assistant_graph_injects_project_context_and_template(db_session, test_user):
    project = await _seed_project(db_session, test_user.id)
    model = EchoMockModel()
    graph = graph_registry.get("chat_assistant")(model=model)
    context = ChatAssistantContext(
        project_id=project.id,
        session_factory=lambda: _same_session_factory(db_session),
        injected_system_prompt="模板要求：保持悬疑语气",
    )

    result = await graph.ainvoke({"messages": [HumanMessage(content="介绍阿宁")]}, context=context)

    assert result["messages"][-1].content == "系统包含外貌=True"
    system_text = "\n".join(str(m.content) for m in model._last_messages if getattr(m, "type", "") == "system")
    assert "# 项目上下文" in system_text
    assert "外貌：银发蓝眼" in system_text
    assert "# 用户提示词模板" in system_text
    assert "保持悬疑语气" in system_text
