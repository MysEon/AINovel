"""Tests for chat assistant entity write tools."""

from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select

from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.story_knowledge import EntityRelationship
from app.infrastructure.db.models.worldbuilding import Character, Location
from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext
from app.infrastructure.graph.tools.entity_write_tools import (
    create_character,
    create_location,
    create_organization,
    create_worldview,
    delete_character,
    delete_location,
    update_character,
)


def _make_runtime(project_id: int, session_factory):
    from types import SimpleNamespace

    ctx = ChatAssistantContext(project_id=project_id, session_factory=session_factory)
    return SimpleNamespace(context=ctx)


@asynccontextmanager
async def _same_session_factory(db_session):
    yield db_session


async def _seed_project(db_session, user_id: int):
    project = Project(name="写入测试项目", description="测试简介", user_id=user_id)
    db_session.add(project)
    await db_session.flush()
    await db_session.commit()
    return project


@pytest.fixture
async def tool_runtime(db_session, test_user):
    project = await _seed_project(db_session, test_user.id)
    return _make_runtime(project.id, lambda: _same_session_factory(db_session))


class TestCreateTools:
    @pytest.mark.asyncio
    async def test_create_character(self, tool_runtime, db_session):
        result = await create_character.coroutine(
            name="新角色",
            runtime=tool_runtime,
            description="描述",
            alignment="邪恶",
        )
        import json

        data = json.loads(result)
        assert data["success"] is True
        assert data["name"] == "新角色"
        assert data["entity_type"] == "character"

        project_id = tool_runtime.context.project_id
        char = (
            await db_session.execute(
                select(Character).where(Character.project_id == project_id, Character.name == "新角色")
            )
        ).scalar_one()
        assert char.description == "描述"
        assert char.alignment == "邪恶"

    @pytest.mark.asyncio
    async def test_create_location(self, tool_runtime, db_session):
        result = await create_location.coroutine(name="新城", runtime=tool_runtime, geography="平原")
        import json

        data = json.loads(result)
        assert data["success"] is True

        project_id = tool_runtime.context.project_id
        loc = (
            await db_session.execute(
                select(Location).where(Location.project_id == project_id, Location.name == "新城")
            )
        ).scalar_one()
        assert loc.geography == "平原"

    @pytest.mark.asyncio
    async def test_create_organization(self, tool_runtime, db_session):
        result = await create_organization.coroutine(name="新组织", runtime=tool_runtime, purpose="测试")
        import json

        data = json.loads(result)
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_create_worldview(self, tool_runtime, db_session):
        result = await create_worldview.coroutine(name="新世界观", runtime=tool_runtime, rules="规则")
        import json

        data = json.loads(result)
        assert data["success"] is True


class TestUpdateTools:
    @pytest.mark.asyncio
    async def test_update_character_by_name(self, tool_runtime, db_session):
        await create_character.coroutine(name="可更新角色", runtime=tool_runtime, description="旧描述")
        result = await update_character.coroutine(
            identifier="可更新角色",
            updates_json='{"description": "新描述", "alignment": "善良"}',
            runtime=tool_runtime,
        )
        import json

        data = json.loads(result)
        assert data["success"] is True

        project_id = tool_runtime.context.project_id
        char = (
            await db_session.execute(
                select(Character).where(Character.project_id == project_id, Character.name == "可更新角色")
            )
        ).scalar_one()
        assert char.description == "新描述"
        assert char.alignment == "善良"

    @pytest.mark.asyncio
    async def test_update_character_by_id(self, tool_runtime, db_session):
        created = await create_character.coroutine(name="按ID更新", runtime=tool_runtime)
        import json

        created_data = json.loads(created)
        result = await update_character.coroutine(
            identifier=str(created_data["id"]),
            updates_json='{"description": "按ID改"}',
            runtime=tool_runtime,
        )
        data = json.loads(result)
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_update_invalid_json(self, tool_runtime):
        result = await update_character.coroutine(
            identifier="foo",
            updates_json="not json",
            runtime=tool_runtime,
        )
        import json

        data = json.loads(result)
        assert data["success"] is False
        assert "解析失败" in data["error"]


class TestDeleteTools:
    @pytest.mark.asyncio
    async def test_delete_character_confirm_false(self, tool_runtime, db_session):
        await create_character.coroutine(name="待删角色", runtime=tool_runtime, description="即将被删")
        result = await delete_character.coroutine(identifier="待删角色", runtime=tool_runtime, confirm=False)
        import json

        data = json.loads(result)
        assert data.get("confirm_required") is True
        assert "待删角色" in data["message"]

        # 确认实体仍在
        project_id = tool_runtime.context.project_id
        char = (
            await db_session.execute(
                select(Character).where(Character.project_id == project_id, Character.name == "待删角色")
            )
        ).scalar_one_or_none()
        assert char is not None

    @pytest.mark.asyncio
    async def test_delete_character_confirm_true(self, tool_runtime, db_session):
        await create_character.coroutine(name="真删角色", runtime=tool_runtime)
        result = await delete_character.coroutine(identifier="真删角色", runtime=tool_runtime, confirm=True)
        import json

        data = json.loads(result)
        assert data["success"] is True

        project_id = tool_runtime.context.project_id
        char = (
            await db_session.execute(
                select(Character).where(Character.project_id == project_id, Character.name == "真删角色")
            )
        ).scalar_one_or_none()
        assert char is None

    @pytest.mark.asyncio
    async def test_delete_cleans_orphan_relationships(self, tool_runtime, db_session):
        # 创建一个角色和一条指向它的关系边
        created = await create_character.coroutine(name="带关系角色", runtime=tool_runtime)
        import json

        char_id = json.loads(created)["id"]
        project_id = tool_runtime.context.project_id

        rel = EntityRelationship(
            project_id=project_id,
            source_type="character",
            source_id=char_id,
            target_type="character",
            target_id=char_id,
            relation_type="self",
        )
        db_session.add(rel)
        await db_session.commit()

        result = await delete_character.coroutine(identifier=str(char_id), runtime=tool_runtime, confirm=True)
        data = json.loads(result)
        assert data["success"] is True

        # 关系边应被清理
        rel_after = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.source_type == "character",
                    EntityRelationship.source_id == char_id,
                )
            )
        ).scalar_one_or_none()
        assert rel_after is None

    @pytest.mark.asyncio
    async def test_delete_not_found(self, tool_runtime):
        result = await delete_character.coroutine(identifier="不存在的", runtime=tool_runtime, confirm=False)
        import json

        data = json.loads(result)
        assert data["success"] is False
        assert "未找到" in data["error"]

    @pytest.mark.asyncio
    async def test_delete_location_two_step(self, tool_runtime, db_session):
        await create_location.coroutine(name="删地点", runtime=tool_runtime)
        step1 = await delete_location.coroutine(identifier="删地点", runtime=tool_runtime, confirm=False)
        import json

        assert json.loads(step1).get("confirm_required") is True
        step2 = await delete_location.coroutine(identifier="删地点", runtime=tool_runtime, confirm=True)
        assert json.loads(step2)["success"] is True
        project_id = tool_runtime.context.project_id
        loc = (
            await db_session.execute(
                select(Location).where(Location.project_id == project_id, Location.name == "删地点")
            )
        ).scalar_one_or_none()
        assert loc is None
