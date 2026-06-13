"""Chat assistant workflow: LangChain v1 create_agent + LangGraph StateGraph."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, dynamic_prompt
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ai_context_builder import AIContextBuilder
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext, ChatAssistantState
from app.infrastructure.graph.registry import graph_registry
from app.infrastructure.graph.tools import CHAT_TOOLS

BASE_SYSTEM_PROMPT = """你是 AINovel 的小说写作助手。
你必须基于当前项目设定回答；信息不足时先调用工具查询，不要编造项目内事实。"""


async def _load_project_context(
    project_id: int, session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]]
) -> str:
    async with session_factory() as db:
        builder = AIContextBuilder(db)
        ctx = await builder.get_project_context(project_id, mode="chat")
        return builder.format_for_chat_with_budget(ctx)


async def inject_context(state: ChatAssistantState, runtime) -> dict[str, str]:
    """Load lightweight project context before the agent runs."""
    ctx: ChatAssistantContext = runtime.context
    project_context = await _load_project_context(ctx.project_id, ctx.session_factory)
    return {"project_context": project_context}


@dynamic_prompt
async def project_prompt(request: ModelRequest[ChatAssistantContext]) -> SystemMessage:
    """Build the per-request system prompt from injected state and context."""
    ctx = request.runtime.context
    parts = [
        BASE_SYSTEM_PROMPT,
        "# 项目上下文\n" + (request.state.get("project_context") or ""),
    ]
    if ctx.injected_system_prompt:
        parts.append("# 用户提示词模板\n" + ctx.injected_system_prompt)
    return SystemMessage(content="\n\n".join(parts))


@graph_registry.register("chat_assistant")
def build_chat_assistant_graph(
    model: BaseChatModel,
    checkpointer=None,
    store=None,
    **kwargs: Any,
) -> CompiledStateGraph:
    """Build the chat assistant graph."""
    agent = create_agent(
        model=model,
        tools=CHAT_TOOLS,
        system_prompt=BASE_SYSTEM_PROMPT,
        middleware=[project_prompt],
        state_schema=ChatAssistantState,
        context_schema=ChatAssistantContext,
        name="chat_assistant_agent",
    )

    graph = StateGraph(ChatAssistantState, context_schema=ChatAssistantContext)
    graph.add_node("inject_context", inject_context)
    graph.add_node("agent", agent)
    graph.add_edge(START, "inject_context")
    graph.add_edge("inject_context", "agent")
    graph.add_edge("agent", END)
    return graph.compile(checkpointer=checkpointer, store=store)
