"""Structured SSE event helpers for LangGraph agent streams."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

EVENT_NODE_START = "node_start"
EVENT_NODE_END = "node_end"
EVENT_TOOL_START = "tool_start"
EVENT_TOOL_END = "tool_end"
EVENT_TEXT = "text"
EVENT_ERROR = "error"
EVENT_DONE = "done"

NODE_LABELS = {
    "inject_context": "加载项目上下文",
    "agent": "推理回复",
    "tools": "调用工具",
}


def serialize_event(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, 'payload': payload}, ensure_ascii=False)}\n\n"


def truncate_tool_result(result: str, max_len: int = 200) -> tuple[str, bool]:
    if len(result) <= max_len:
        return result, False
    if max_len <= 0:
        return "", True
    return result[: max_len - 1] + "…", True


def _chunk_text(chunk) -> str:
    """Extract only human-visible text from an AIMessageChunk-like object."""
    if getattr(chunk, "tool_call_chunks", None):
        return ""

    content = getattr(chunk, "content", None)
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") in {"text", "text_delta"}:
                parts.append(str(item.get("text") or item.get("content") or ""))
        return "".join(parts)
    return ""


def _tool_result_to_text(output: Any) -> str:
    content = getattr(output, "content", None)
    if content is not None:
        return str(content)
    if isinstance(output, str):
        return output
    return str(output)


async def stream_agent_events(graph, input_state, *, context, config=None) -> AsyncIterator[str]:
    kwargs: dict[str, Any] = {"version": "v2", "context": context}
    if config is not None:
        kwargs["config"] = config

    try:
        async for event in graph.astream_events(input_state, **kwargs):
            kind = event.get("event")
            name = event.get("name", "")
            data = event.get("data") or {}

            if kind == "on_chain_start" and name in NODE_LABELS:
                yield serialize_event(EVENT_NODE_START, {"name": name, "label": NODE_LABELS[name]})
            elif kind == "on_chain_end" and name in NODE_LABELS:
                yield serialize_event(EVENT_NODE_END, {"name": name})
            elif kind == "on_tool_start":
                yield serialize_event(EVENT_TOOL_START, {"name": name, "args": data.get("input", {})})
            elif kind == "on_tool_end":
                result, truncated = truncate_tool_result(_tool_result_to_text(data.get("output", "")))
                yield serialize_event(
                    EVENT_TOOL_END,
                    {"name": name, "result": result, "truncated": truncated},
                )
            elif kind == "on_chat_model_stream":
                text = _chunk_text(data.get("chunk"))
                if text:
                    yield serialize_event(EVENT_TEXT, {"chunk": text})
        yield serialize_event(EVENT_DONE, {})
    except Exception as exc:
        yield serialize_event(EVENT_ERROR, {"message": str(exc)})
        yield serialize_event(EVENT_DONE, {})
