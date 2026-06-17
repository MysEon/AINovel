"""Tests for chat assistant worldbuilding tools."""

from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select

from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext
from app.infrastructure.graph.tools.character_tools import get_character_detail, list_characters
from app.infrastructure.graph.tools.worldbuilding_tools import (
    get_location_detail,
    get_organization_detail,
    get_worldview_detail,
    list_locations,
    list_organizations,
    list_worldviews,
)


def _make_runtime(project_id: int, session_factory):
    """Build a minimal ToolRuntime-like object for direct tool calls."""
    from types import SimpleNamespace

    ctx = ChatAssistantContext(project_id=project_id, session_factory=session_factory)
    return SimpleNamespace(context=ctx)


@asynccontextmanager
async def _same_session_factory(db_session):
    yield db_session


async def _seed_project(db_session, user_id: int):
    project = Project(name="工具测试项目", description="测试简介", user_id=user_id)
    db_session.add(project)
    await db_session.flush()

    db_session.add_all(
        [
            Character(
                project_id=project.id,
                name="阿宁",
                description="潜入专家",
                personality="谨慎",
                alignment="中立善良",
            ),
            Character(
                project_id=project.id,
                name="老李",
                description="老兵",
                personality="豪放",
                alignment="守序中立",
            ),
            Location(
                project_id=project.id,
                name="旧城",
                description="被遗忘的古城",
                geography="山谷之中",
            ),
            Organization(
                project_id=project.id,
                name="灰烬公会",
                description="地下势力",
                purpose="控制港口",
            ),
            Worldview(
                project_id=project.id,
                name="灵能纪元",
                description="万物皆有灵",
                rules="灵能者受约束",
            ),
        ]
    )
    await db_session.commit()
    return project


@pytest.fixture
async def tool_runtime(db_session, test_user):
    project = await _seed_project(db_session, test_user.id)
    return _make_runtime(project.id, lambda: _same_session_factory(db_session))


class TestListTools:
    @pytest.mark.asyncio
    async def test_list_characters(self, tool_runtime):
        result = await list_characters.coroutine(tool_runtime)
        import json

        data = json.loads(result)
        assert len(data) == 2
        assert data[0]["name"] == "阿宁"
        assert "description" in data[0]
        assert "alignment" in data[0]

    @pytest.mark.asyncio
    async def test_list_locations(self, tool_runtime):
        result = await list_locations.coroutine(tool_runtime)
        import json

        data = json.loads(result)
        assert len(data) == 1
        assert data[0]["name"] == "旧城"
        assert "description" in data[0]

    @pytest.mark.asyncio
    async def test_list_organizations(self, tool_runtime):
        result = await list_organizations.coroutine(tool_runtime)
        import json

        data = json.loads(result)
        assert len(data) == 1
        assert data[0]["name"] == "灰烬公会"

    @pytest.mark.asyncio
    async def test_list_worldviews(self, tool_runtime):
        result = await list_worldviews.coroutine(tool_runtime)
        import json

        data = json.loads(result)
        assert len(data) == 1
        assert data[0]["name"] == "灵能纪元"


class TestDetailTools:
    @pytest.mark.asyncio
    async def test_get_character_detail_by_name(self, tool_runtime):
        result = await get_character_detail.coroutine("阿宁", tool_runtime)
        import json

        data = json.loads(result)
        assert data["name"] == "阿宁"
        assert data["personality"] == "谨慎"

    @pytest.mark.asyncio
    async def test_get_character_detail_by_id(self, tool_runtime, db_session):
        project_id = tool_runtime.context.project_id
        char = (
            await db_session.execute(
                select(Character).where(Character.project_id == project_id, Character.name == "阿宁")
            )
        ).scalar_one()
        result = await get_character_detail.coroutine("", tool_runtime, character_id=char.id)
        import json

        data = json.loads(result)
        assert data["name"] == "阿宁"

    @pytest.mark.asyncio
    async def test_get_character_detail_fallback_ilike(self, tool_runtime):
        result = await get_character_detail.coroutine("宁", tool_runtime)
        import json

        data = json.loads(result)
        assert data["name"] == "阿宁"

    @pytest.mark.asyncio
    async def test_get_location_detail(self, tool_runtime):
        result = await get_location_detail.coroutine("旧城", tool_runtime)
        import json

        data = json.loads(result)
        assert data["name"] == "旧城"
        assert data["geography"] == "山谷之中"

    @pytest.mark.asyncio
    async def test_get_organization_detail(self, tool_runtime):
        result = await get_organization_detail.coroutine("灰烬公会", tool_runtime)
        import json

        data = json.loads(result)
        assert data["name"] == "灰烬公会"
        assert data["purpose"] == "控制港口"

    @pytest.mark.asyncio
    async def test_get_worldview_detail(self, tool_runtime):
        result = await get_worldview_detail.coroutine("灵能纪元", tool_runtime)
        import json

        data = json.loads(result)
        assert data["name"] == "灵能纪元"
        assert data["rules"] == "灵能者受约束"
