"""
Graph Registry — 按 workflow_type 注册和查找图构造函数

用法:
    from app.infrastructure.graph import graph_registry

    @graph_registry.register("chapter_outline")
    def build_chapter_outline_graph(model, **kwargs):
        ...
        return compiled_graph

    graph = graph_registry.get("chapter_outline")
"""

from typing import Any, Protocol

from langchain_core.language_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph


class GraphBuilder(Protocol):
    """图构造函数签名"""

    def __call__(self, model: BaseChatModel, **kwargs: Any) -> CompiledStateGraph: ...


class GraphRegistry:
    """工作流图注册表"""

    def __init__(self):
        self._builders: dict[str, GraphBuilder] = {}

    def register(self, workflow_type: str):
        """装饰器：注册图构造函数"""

        def decorator(fn: GraphBuilder) -> GraphBuilder:
            self._builders[workflow_type] = fn
            return fn

        return decorator

    def get(self, workflow_type: str) -> GraphBuilder:
        builder = self._builders.get(workflow_type)
        if not builder:
            available = ", ".join(sorted(self._builders.keys())) or "(none)"
            raise ValueError(f"未注册的工作流类型: {workflow_type}（可用: {available}）")
        return builder

    @property
    def registered_types(self) -> list[str]:
        return sorted(self._builders.keys())


# 全局单例
graph_registry = GraphRegistry()
