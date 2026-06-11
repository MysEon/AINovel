"""
章节大纲生成工作流 — 第一条垂直切片

节点:
  load_context → build_prompt → generate_outline → format_output
"""

from typing import Any, Optional
from typing_extensions import TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END

from app.infrastructure.graph.registry import graph_registry


# ---------- 状态定义 ----------


class ChapterOutlineState(TypedDict):
    """章节大纲工作流状态"""
    # 输入
    project_name: str
    project_description: str
    chapter_number: int
    user_requirements: Optional[str]
    characters_info: Optional[str]
    worldview_info: Optional[str]
    previous_chapters: Optional[str]
    # 中间
    system_prompt: str
    user_prompt: str
    # 输出
    raw_output: str
    outline: Optional[dict]


# ---------- 节点函数 ----------

SYSTEM_PROMPT = (
    "你是一个专业的小说写作助手。根据项目信息和上下文，为指定章节创建详细的写作大纲。\n\n"
    "你的任务：\n"
    "1. 分析项目背景、角色、世界观等信息\n"
    "2. 根据章节位置和前文内容，规划本章节的发展\n"
    "3. 创建包含开头、发展、高潮、结尾的结构化大纲\n"
    "4. 确保情节连贯性和角色发展\n\n"
    "请返回JSON格式的大纲，包含：\n"
    "- chapter_title: 章节标题\n"
    "- summary: 章节概要\n"
    "- key_events: 关键事件列表\n"
    "- character_development: 角色发展要点\n"
    "- word_count_estimate: 预估字数\n"
    "- writing_tips: 写作建议"
)


def build_prompt(state: ChapterOutlineState) -> dict:
    """组装用户提示词"""
    parts = [f"项目名称：{state['project_name']}"]
    if state.get("project_description"):
        parts.append(f"项目描述：{state['project_description']}")
    parts.append(f"章节号：第{state['chapter_number']}章")
    if state.get("characters_info"):
        parts.append(f"主要角色：\n{state['characters_info']}")
    if state.get("worldview_info"):
        parts.append(f"世界观设定：\n{state['worldview_info']}")
    if state.get("previous_chapters"):
        parts.append(f"前文摘要：\n{state['previous_chapters']}")
    if state.get("user_requirements"):
        parts.append(f"用户需求：{state['user_requirements']}")

    return {
        "system_prompt": SYSTEM_PROMPT,
        "user_prompt": "\n\n".join(parts),
    }


def _make_generate_outline(model: BaseChatModel):
    """闭包：将 model 注入到节点函数中"""

    async def generate_outline(state: ChapterOutlineState) -> dict:
        messages = [
            SystemMessage(content=state["system_prompt"]),
            HumanMessage(content=state["user_prompt"]),
        ]
        response = await model.ainvoke(messages)
        return {"raw_output": response.content}

    return generate_outline


def format_output(state: ChapterOutlineState) -> dict:
    """尝试将 raw_output 解析为结构化 JSON"""
    import json as _json

    raw = state.get("raw_output", "")
    # 尝试提取 JSON 块
    text = raw.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()

    try:
        parsed = _json.loads(text)
        return {"outline": parsed}
    except (_json.JSONDecodeError, ValueError):
        return {"outline": {"raw_text": raw}}


# ---------- 图构建 & 注册 ----------


@graph_registry.register("chapter_outline")
def build_chapter_outline_graph(model: BaseChatModel, checkpointer=None, **kwargs):
    """构建章节大纲生成图"""
    graph = StateGraph(ChapterOutlineState)

    graph.add_node("build_prompt", build_prompt)
    graph.add_node("generate_outline", _make_generate_outline(model))
    graph.add_node("format_output", format_output)

    graph.add_edge(START, "build_prompt")
    graph.add_edge("build_prompt", "generate_outline")
    graph.add_edge("generate_outline", "format_output")
    graph.add_edge("format_output", END)

    return graph.compile(checkpointer=checkpointer)
