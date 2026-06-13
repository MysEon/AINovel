"""Structured SSE event dispatch tests."""

import json
from types import SimpleNamespace

import pytest

from app.infrastructure.graph.sse_events import serialize_event, stream_agent_events, truncate_tool_result


class MockGraph:
    async def astream_events(self, input_state, **kwargs):
        assert kwargs["version"] == "v2"
        assert kwargs["context"] == "ctx"
        events = [
            {"event": "on_chain_start", "name": "internal_noise", "data": {}},
            {"event": "on_chain_start", "name": "inject_context", "data": {}},
            {"event": "on_chain_end", "name": "inject_context", "data": {}},
            {"event": "on_tool_start", "name": "get_character_detail", "data": {"input": {"name": "阿宁"}}},
            {"event": "on_tool_end", "name": "get_character_detail", "data": {"output": "查到" + "很长" * 200}},
            {"event": "on_chat_model_stream", "name": "model", "data": {"chunk": SimpleNamespace(content="你好")}},
            {
                "event": "on_chat_model_stream",
                "name": "model",
                "data": {"chunk": SimpleNamespace(content="", tool_call_chunks=[{"x": 1}])},
            },
            {"event": "on_chain_end", "name": "agent", "data": {}},
        ]
        for event in events:
            yield event


class ErrorGraph:
    async def astream_events(self, input_state, **kwargs):
        yield {"event": "on_chain_start", "name": "agent", "data": {}}
        raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_stream_agent_events_filters_and_serializes_whitelist():
    rows = [line async for line in stream_agent_events(MockGraph(), {"messages": []}, context="ctx")]
    parsed = [json.loads(row.removeprefix("data: ")) for row in rows]

    assert [item["type"] for item in parsed] == [
        "node_start",
        "node_end",
        "tool_start",
        "tool_end",
        "text",
        "node_end",
        "done",
    ]
    assert parsed[0]["payload"] == {"name": "inject_context", "label": "加载项目上下文"}
    assert parsed[2]["payload"] == {"name": "get_character_detail", "args": {"name": "阿宁"}}
    assert parsed[3]["payload"]["truncated"] is True
    assert parsed[4]["payload"] == {"chunk": "你好"}
    assert parsed[-1]["payload"] == {}
    assert all("internal_noise" not in row for row in rows)


def test_serialize_event_outputs_sse_json():
    row = serialize_event("text", {"chunk": "汉字"})
    assert row.startswith("data: ")
    assert row.endswith("\n\n")
    payload = json.loads(row.removeprefix("data: "))
    assert payload == {"type": "text", "payload": {"chunk": "汉字"}}


def test_truncate_tool_result():
    short, is_short_truncated = truncate_tool_result("abc", max_len=5)
    long, is_long_truncated = truncate_tool_result("abcdef", max_len=5)

    assert short == "abc"
    assert is_short_truncated is False
    assert long == "abcd…"
    assert len(long) == 5
    assert is_long_truncated is True


@pytest.mark.asyncio
async def test_stream_agent_events_emits_error_then_done():
    rows = [line async for line in stream_agent_events(ErrorGraph(), {}, context="ctx")]
    parsed = [json.loads(row.removeprefix("data: ")) for row in rows]

    assert [item["type"] for item in parsed] == ["node_start", "error", "done"]
    assert parsed[1]["payload"]["message"] == "boom"
