"""Worldbuilding tools for the chat assistant graph."""

from __future__ import annotations

import json

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy import select

from app.application.ai_context_builder import _truncate
from app.infrastructure.db.models.worldbuilding import Location, Organization, Worldview
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext, ChatAssistantState


@tool
async def list_locations(
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """List locations in current project. Use when the user asks about places, geography, or scene settings."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(select(Location).where(Location.project_id == ctx.project_id).order_by(Location.id))
        locations = result.scalars().all()
    payload = [{"id": loc.id, "name": loc.name, "description": _truncate(loc.description, 100)} for loc in locations]
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def get_location_detail(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Get full detail for a location by name in current project.

    Falls back to case-insensitive partial match if exact name not found.
    Use when basic injected location info is insufficient.
    """
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Location).where(Location.project_id == ctx.project_id).where(Location.name == name).limit(1)
        )
        loc = result.scalar_one_or_none()
        if loc is None:
            result = await db.execute(
                select(Location)
                .where(Location.project_id == ctx.project_id)
                .where(Location.name.ilike(f"%{name}%"))
                .limit(1)
            )
            loc = result.scalar_one_or_none()

    if loc is None:
        return f"未找到地点：{name}"

    payload = {
        "id": loc.id,
        "name": loc.name,
        "description": loc.description,
        "geography": loc.geography,
        "culture": loc.culture,
        "history": loc.history,
    }
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def list_organizations(
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """List organizations in current project. Use when the user asks about factions, groups, or institutions."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Organization).where(Organization.project_id == ctx.project_id).order_by(Organization.id)
        )
        organizations = result.scalars().all()
    payload = [
        {"id": org.id, "name": org.name, "description": _truncate(org.description, 100)} for org in organizations
    ]
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def get_organization_detail(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Get full detail for an organization by name in current project.

    Falls back to case-insensitive partial match if exact name not found.
    Use when basic injected organization info is insufficient.
    """
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Organization).where(Organization.project_id == ctx.project_id).where(Organization.name == name).limit(1)
        )
        org = result.scalar_one_or_none()
        if org is None:
            result = await db.execute(
                select(Organization)
                .where(Organization.project_id == ctx.project_id)
                .where(Organization.name.ilike(f"%{name}%"))
                .limit(1)
            )
            org = result.scalar_one_or_none()

    if org is None:
        return f"未找到组织：{name}"

    payload = {
        "id": org.id,
        "name": org.name,
        "description": org.description,
        "structure": org.structure,
        "purpose": org.purpose,
        "influence": org.influence,
    }
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def list_worldviews(
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """List worldviews in current project. Use when the user asks about world rules, magic systems, or setting lore."""
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Worldview).where(Worldview.project_id == ctx.project_id).order_by(Worldview.id)
        )
        worldviews = result.scalars().all()
    payload = [
        {"id": wv.id, "name": wv.name, "description": _truncate(wv.description, 100)} for wv in worldviews
    ]
    return json.dumps(payload, ensure_ascii=False, default=str)


@tool
async def get_worldview_detail(
    name: str,
    runtime: ToolRuntime[ChatAssistantContext, ChatAssistantState],
) -> str:
    """Get full detail for a worldview by name in current project.

    Falls back to case-insensitive partial match if exact name not found.
    Use when basic injected worldview info is insufficient.
    """
    ctx = runtime.context
    async with ctx.session_factory() as db:
        result = await db.execute(
            select(Worldview).where(Worldview.project_id == ctx.project_id).where(Worldview.name == name).limit(1)
        )
        wv = result.scalar_one_or_none()
        if wv is None:
            result = await db.execute(
                select(Worldview)
                .where(Worldview.project_id == ctx.project_id)
                .where(Worldview.name.ilike(f"%{name}%"))
                .limit(1)
            )
            wv = result.scalar_one_or_none()

    if wv is None:
        return f"未找到世界观：{name}"

    payload = {
        "id": wv.id,
        "name": wv.name,
        "description": wv.description,
        "rules": wv.rules,
        "magic_system": wv.magic_system,
        "technology": wv.technology,
        "timeline": wv.timeline,
    }
    return json.dumps(payload, ensure_ascii=False, default=str)
