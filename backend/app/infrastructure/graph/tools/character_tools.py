"""Character tools for the chat assistant graph."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy import select

from app.infrastructure.db.models.worldbuilding import Character
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext, ChatAssistantState


def _parse_extra_attributes(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


@tool
async def get_character_detail(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Get detail for one character by name in current project. Use when basic injected character info is insufficient."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Character).where(Character.project_id == ctx.project_id).where(Character.name == name).limit(1)
        )
        character = result.scalar_one_or_none()
        if character is None:
            result = await db.execute(
                select(Character)
                .where(Character.project_id == ctx.project_id)
                .where(Character.name.ilike(f"%{name}%"))
                .limit(1)
            )
            character = result.scalar_one_or_none()

    if character is None:
        return f"未找到角色：{name}"

    payload: dict[str, Any] = {
        "id": character.id,
        "name": character.name,
        "description": character.description,
        "personality": character.personality,
        "background": character.background,
        "appearance": character.appearance,
        "gender": character.gender,
        "age": character.age,
        "height": character.height,
        "weight": character.weight,
        "birthday": character.birthday,
        "blood_type": character.blood_type,
        "species": character.species,
        "alignment": character.alignment,
        "organization_id": character.organization_id,
        "dimensions": character.dimensions,
        "abilities": character.abilities,
        "weaknesses": character.weaknesses,
    }
    payload.update(_parse_extra_attributes(character.extra_attributes))
    return json.dumps(payload, ensure_ascii=False, default=str)
