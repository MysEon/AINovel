"""Character tools for the chat assistant graph."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy import select

from app.application.ai_context_builder import _truncate
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
async def list_characters(
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """List characters in current project. Use when the user asks about characters, cast, or roles."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Character).where(Character.project_id == ctx.project_id).order_by(Character.id)
        )
        characters = result.scalars().all()
    payload = [
        {
            "id": c.id,
            "name": c.name,
            "description": _truncate(c.description, 100),
            "alignment": c.alignment,
            "organization_id": c.organization_id,
        }
        for c in characters
    ]
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def get_character_detail(
    name: str = "",
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState] = None,  # type: ignore[assignment]
    character_id: int | None = None,
) -> str:
    """Get detail for one character in current project.

    - If character_id is provided, lookup by ID first.
    - Otherwise lookup by exact name; falls back to case-insensitive partial match.
    Use when basic injected character info is insufficient.
    """
    ctx = runtime.context
    async with ctx.session_factory() as db:
        character = None
        if character_id is not None:
            result = await db.execute(
                select(Character)
                .where(Character.project_id == ctx.project_id)
                .where(Character.id == character_id)
                .limit(1)
            )
            character = result.scalar_one_or_none()

        if character is None and name:
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
        lookup = f"ID={character_id}" if character_id is not None else f"名称={name}"
        return f"未找到角色：{lookup}"

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
