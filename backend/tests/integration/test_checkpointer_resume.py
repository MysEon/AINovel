"""Checkpointer Resume 集成测试"""

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict


class DummyState(TypedDict):
    counter: int


def inc_node(state: DummyState):
    return {"counter": state["counter"] + 1}


def build_dummy_graph(checkpointer=None):
    graph = StateGraph(DummyState)
    graph.add_node("inc", inc_node)
    graph.add_edge(START, "inc")
    graph.add_edge("inc", END)
    return graph.compile(checkpointer=checkpointer)


class TestCheckpointerResume:
    async def test_inmemory_saver_resume_state(self):
        """用 InMemorySaver（同接口 AsyncSqliteSaver）跑 workflow，调两次 ainvoke 验 state 持久"""
        saver = InMemorySaver()
        graph = build_dummy_graph(checkpointer=saver)
        thread_id = "test-resume-001"
        config = {"configurable": {"thread_id": thread_id}}

        # 第一次调用
        result1 = await graph.ainvoke({"counter": 0}, config=config)
        assert result1["counter"] == 1

        # 第二次调用（同 thread_id），状态应从上次 checkpoint 恢复
        # 注意：ainvoke 传入的是增量/覆盖状态，这里再传 {"counter": 0} 会覆盖
        # 要验证 checkpoint 真的生效，可以查 state
        state = await graph.aget_state(config)
        # state.values 应包含上次结果
        assert state.values["counter"] == 1

        # 再次调用，传入接续状态
        result2 = await graph.ainvoke({"counter": state.values["counter"]}, config=config)
        assert result2["counter"] == 2
