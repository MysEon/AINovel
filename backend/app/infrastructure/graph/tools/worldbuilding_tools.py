"""Worldbuilding tools for the chat assistant graph."""

from __future__ import annotations

import json

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime
from sqlalchemy import select

from app.application.ai_context_builder import _truncate
from app.infrastructure.db.models.worldbuilding import Location, Organization
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
    payload = [{"name": loc.name, "description": _truncate(loc.description, 100)} for loc in locations]
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
    payload = [{"name": org.name, "description": _truncate(org.description, 100)} for org in organizations]
    return json.dumps(payload, ensure_ascii=False, default=str)
