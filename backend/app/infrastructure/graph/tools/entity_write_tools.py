"""Entity write tools for the chat assistant graph.

Direct-write CRUD for Character/Location/Organization/Worldview.
Delete uses a two-step confirmation flow.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.worldbuilding_service import WorldbuildingService
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext, ChatAssistantState


def _try_id(identifier: str) -> int | str:
    try:
        return int(identifier)
    except ValueError:
        return identifier


async def _resolve_entity_id(
    db: AsyncSession,
    project_id: int,
    entity_type: str,
    identifier: str,
) -> int | None:
    """Resolve identifier (numeric id or name) to entity id."""
    parsed = _try_id(identifier)
    service = WorldbuildingService(db)
    if isinstance(parsed, int):
        entity = await service.get_entity_by_id(project_id, entity_type, parsed)
        return entity.id if entity else None
    entity = await service.get_entity_by_name(project_id, entity_type, parsed)
    return entity.id if entity else None


async def _create_entity(
    db: AsyncSession,
    project_id: int,
    entity_type: str,
    data: dict[str, Any],
) -> str:
    service = WorldbuildingService(db)
    entity = await service.create_entity(project_id, entity_type, data)
    return json.dumps(
        {"success": True, "id": entity.id, "name": entity.name, "entity_type": entity_type},
        ensure_ascii=False,
        default=str,
    )


async def _update_entity(
    db: AsyncSession,
    project_id: int,
    entity_type: str,
    identifier: str,
    data: dict[str, Any],
) -> str:
    service = WorldbuildingService(db)
    entity_id = await _resolve_entity_id(db, project_id, entity_type, identifier)
    if entity_id is None:
        return json.dumps(
            {"success": False, "error": f"未找到 {entity_type}：{identifier}"},
            ensure_ascii=False,
        )
    entity = await service.update_entity(project_id, entity_type, entity_id, data)
    return json.dumps(
        {"success": True, "id": entity.id, "name": entity.name, "entity_type": entity_type},
        ensure_ascii=False,
        default=str,
    )


async def _delete_entity(
    db: AsyncSession,
    project_id: int,
    entity_type: str,
    identifier: str,
    confirm: bool,
) -> str:
    service = WorldbuildingService(db)
    entity_id = await _resolve_entity_id(db, project_id, entity_type, identifier)
    if entity_id is None:
        return json.dumps(
            {"success": False, "error": f"未找到 {entity_type}：{identifier}"},
            ensure_ascii=False,
        )

    if not confirm:
        entity = await service.get_entity_by_id(project_id, entity_type, entity_id)
        summary = getattr(entity, "description", None) or getattr(entity, "name", "")
        return json.dumps(
            {
                "confirm_required": True,
                "message": f"即将删除 {entity_type}「{entity.name}」（ID={entity.id}）。"
                f"摘要：{summary[:80] if summary else '无描述'}...。"
                f"请再次调用本工具并将 confirm 设为 true 以确认删除。",
                "entity_id": entity.id,
                "name": entity.name,
                "entity_type": entity_type,
            },
            ensure_ascii=False,
            default=str,
        )

    await service.delete_entity(project_id, entity_type, entity_id)
    return json.dumps(
        {"success": True, "deleted_id": entity_id, "entity_type": entity_type},
        ensure_ascii=False,
        default=str,
    )


# ── Character write tools ──────────────────────────────────────────────


@tool
async def create_character(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    description: str | None = None,
    personality: str | None = None,
    background: str | None = None,
    appearance: str | None = None,
    gender: str | None = None,
    age: str | None = None,
    height: str | None = None,
    weight: str | None = None,
    birthday: str | None = None,
    blood_type: str | None = None,
    species: str | None = None,
    alignment: str | None = None,
    organization_id: int | None = None,
    dimensions: str | None = None,
    abilities: str | None = None,
    weaknesses: str | None = None,
    extra_attributes: str | None = None,
) -> str:
    """Create a new character in the current project.

    Use when the user asks to add a character or when you need to create
    a character that does not yet exist.
    """
    ctx = runtime.context
    data = {
        k: v
        for k, v in {
            "name": name,
            "description": description,
            "personality": personality,
            "background": background,
            "appearance": appearance,
            "gender": gender,
            "age": age,
            "height": height,
            "weight": weight,
            "birthday": birthday,
            "blood_type": blood_type,
            "species": species,
            "alignment": alignment,
            "organization_id": organization_id,
            "dimensions": dimensions,
            "abilities": abilities,
            "weaknesses": weaknesses,
            "extra_attributes": extra_attributes,
        }.items()
        if v is not None
    }
    async with ctx.session_factory() as db:
        return await _create_entity(db, ctx.project_id, "character", data)


@tool
async def update_character(
    identifier: str,
    updates_json: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Update an existing character by name or numeric ID.

    - identifier: character name or ID.
    - updates_json: JSON object string with fields to change, e.g.
      {"description": "new desc", "alignment": "evil"}
    """
    ctx = runtime.context
    try:
        data = json.loads(updates_json)
    except json.JSONDecodeError as exc:
        return json.dumps(
            {"success": False, "error": f"updates_json 解析失败：{exc}"},
            ensure_ascii=False,
        )
    if not isinstance(data, dict):
        return json.dumps(
            {"success": False, "error": "updates_json 必须是对象"},
            ensure_ascii=False,
        )
    async with ctx.session_factory() as db:
        return await _update_entity(db, ctx.project_id, "character", identifier, data)


@tool
async def delete_character(
    identifier: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    confirm: bool = False,
) -> str:
    """Delete a character by name or numeric ID.

    Two-step flow:
    1. First call with confirm=false returns a summary and asks for confirmation.
    2. Call again with confirm=true to actually delete.
    """
    ctx = runtime.context
    async with ctx.session_factory() as db:
        return await _delete_entity(db, ctx.project_id, "character", identifier, confirm)


# ── Location write tools ───────────────────────────────────────────────


@tool
async def create_location(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    description: str | None = None,
    geography: str | None = None,
    culture: str | None = None,
    history: str | None = None,
) -> str:
    """Create a new location in the current project."""
    ctx = runtime.context
    data = {k: v for k, v in {
        "name": name,
        "description": description,
        "geography": geography,
        "culture": culture,
        "history": history,
    }.items() if v is not None}
    async with ctx.session_factory() as db:
        return await _create_entity(db, ctx.project_id, "location", data)


@tool
async def update_location(
    identifier: str,
    updates_json: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Update a location by name or numeric ID.

    - identifier: location name or ID.
    - updates_json: JSON object string with fields to change.
    """
    ctx = runtime.context
    try:
        data = json.loads(updates_json)
    except json.JSONDecodeError as exc:
        return json.dumps(
            {"success": False, "error": f"updates_json 解析失败：{exc}"},
            ensure_ascii=False,
        )
    if not isinstance(data, dict):
        return json.dumps(
            {"success": False, "error": "updates_json 必须是对象"},
            ensure_ascii=False,
        )
    async with ctx.session_factory() as db:
        return await _update_entity(db, ctx.project_id, "location", identifier, data)


@tool
async def delete_location(
    identifier: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    confirm: bool = False,
) -> str:
    """Delete a location by name or numeric ID (two-step confirmation)."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        return await _delete_entity(db, ctx.project_id, "location", identifier, confirm)


# ── Organization write tools ───────────────────────────────────────────


@tool
async def create_organization(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    description: str | None = None,
    structure: str | None = None,
    purpose: str | None = None,
    influence: str | None = None,
) -> str:
    """Create a new organization in the current project."""
    ctx = runtime.context
    data = {k: v for k, v in {
        "name": name,
        "description": description,
        "structure": structure,
        "purpose": purpose,
        "influence": influence,
    }.items() if v is not None}
    async with ctx.session_factory() as db:
        return await _create_entity(db, ctx.project_id, "organization", data)


@tool
async def update_organization(
    identifier: str,
    updates_json: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Update an organization by name or numeric ID.

    - identifier: organization name or ID.
    - updates_json: JSON object string with fields to change.
    """
    ctx = runtime.context
    try:
        data = json.loads(updates_json)
    except json.JSONDecodeError as exc:
        return json.dumps(
            {"success": False, "error": f"updates_json 解析失败：{exc}"},
            ensure_ascii=False,
        )
    if not isinstance(data, dict):
        return json.dumps(
            {"success": False, "error": "updates_json 必须是对象"},
            ensure_ascii=False,
        )
    async with ctx.session_factory() as db:
        return await _update_entity(db, ctx.project_id, "organization", identifier, data)


@tool
async def delete_organization(
    identifier: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    confirm: bool = False,
) -> str:
    """Delete an organization by name or numeric ID (two-step confirmation)."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        return await _delete_entity(db, ctx.project_id, "organization", identifier, confirm)


# ── Worldview write tools ──────────────────────────────────────────────


@tool
async def create_worldview(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    description: str | None = None,
    rules: str | None = None,
    magic_system: str | None = None,
    technology: str | None = None,
    timeline: str | None = None,
) -> str:
    """Create a new worldview in the current project."""
    ctx = runtime.context
    data = {k: v for k, v in {
        "name": name,
        "description": description,
        "rules": rules,
        "magic_system": magic_system,
        "technology": technology,
        "timeline": timeline,
    }.items() if v is not None}
    async with ctx.session_factory() as db:
        return await _create_entity(db, ctx.project_id, "worldview", data)


@tool
async def update_worldview(
    identifier: str,
    updates_json: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Update a worldview by name or numeric ID.

    - identifier: worldview name or ID.
    - updates_json: JSON object string with fields to change.
    """
    ctx = runtime.context
    try:
        data = json.loads(updates_json)
    except json.JSONDecodeError as exc:
        return json.dumps(
            {"success": False, "error": f"updates_json 解析失败：{exc}"},
            ensure_ascii=False,
        )
    if not isinstance(data, dict):
        return json.dumps(
            {"success": False, "error": "updates_json 必须是对象"},
            ensure_ascii=False,
        )
    async with ctx.session_factory() as db:
        return await _update_entity(db, ctx.project_id, "worldview", identifier, data)


@tool
async def delete_worldview(
    identifier: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
    confirm: bool = False,
) -> str:
    """Delete a worldview by name or numeric ID (two-step confirmation)."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        return await _delete_entity(db, ctx.project_id, "worldview", identifier, confirm)
