"""AIContextBuilder chat formatting tests."""

import pytest
from sqlalchemy import select

from app.application.ai_context_builder import AIContextBuilder, count_tokens_estimate
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.story_knowledge import EntityRelationship, EntityStateEvent
from app.infrastructure.db.models.worldbuilding import (
    Character,
    Location,
    Organization,
    Worldview,
)


async def _create_project_with_characters(db_session, user_id: int, count: int):
    project = Project(name=f"聊天上下文项目{count}", description="项目简介", user_id=user_id)
    db_session.add(project)
    await db_session.flush()
    for idx in range(count):
        db_session.add(
            Character(
                project_id=project.id,
                name=f"角色{idx}",
                description="描述" + "甲" * 260,
                personality="性格" + "乙" * 260,
                background="背景" + "丙" * 260,
                appearance="外貌" + "丁" * 260,
            )
        )
    await db_session.commit()
    return project


async def _create_project_with_worldbuilding(db_session, user_id: int):
    project = Project(name="世界building项目", description="项目简介", user_id=user_id)
    db_session.add(project)
    await db_session.flush()
    db_session.add(
        Character(
            project_id=project.id,
            name="主角",
            description="主角描述",
            personality="主角性格",
        )
    )
    db_session.add(
        Worldview(
            project_id=project.id,
            name="灵能纪元",
            description="万物皆有灵",
            rules="灵能者受约束",
        )
    )
    db_session.add(
        Location(
            project_id=project.id,
            name="旧城",
            description="被遗忘的古城",
            geography="山谷之中",
        )
    )
    db_session.add(
        Organization(
            project_id=project.id,
            name="灰烬公会",
            description="地下势力",
            purpose="控制港口",
        )
    )
    await db_session.commit()
    return project


@pytest.mark.asyncio
@pytest.mark.parametrize("count", [0, 1, 3, 10, 25])
async def test_format_for_chat_with_character_counts(db_session, test_user, count):
    project = await _create_project_with_characters(db_session, test_user.id, count)
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")
    text = builder.format_for_chat_with_budget(ctx, max_chars=4000)

    assert "项目：" in text
    assert "【角色基础列表】" in text
    assert len(text) <= 4000
    assert count_tokens_estimate(text) >= 1
    if count == 0:
        assert "暂无角色" in text
    if count == 1:
        assert "外貌" in text
        assert "丁" in text
    if count == 3:
        assert "角色0" in text
        assert "角色2" in text
        assert "背景" in text
    if count == 10:
        assert "角色9" in text
        assert "性格：" not in text
    if count == 25:
        assert "角色24" in text
        assert "性格：" not in text


@pytest.mark.asyncio
async def test_format_for_chat_includes_appearance_from_query(db_session, test_user):
    project = await _create_project_with_characters(db_session, test_user.id, 1)
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")

    assert ctx["characters"][0]["appearance"].startswith("外貌")
    assert len(ctx["characters"][0]["appearance"]) <= 201
    text = builder.format_for_chat(ctx)
    assert "外貌：外貌" in text


@pytest.mark.asyncio
async def test_truncation_keeps_valid_unicode_text(db_session, test_user):
    project = Project(name="Unicode项目", description="简介", user_id=test_user.id)
    db_session.add(project)
    await db_session.flush()
    db_session.add(
        Character(
            project_id=project.id,
            name="阿宁",
            description="😀汉字" * 200,
            personality="温柔" * 200,
            background="旧事" * 200,
            appearance="银发蓝眼" * 200,
        )
    )
    await db_session.commit()
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")
    text = builder.format_for_chat_with_budget(ctx, max_chars=500)

    encoded = text.encode("utf-8")
    assert encoded.decode("utf-8") == text
    assert "阿宁" in text
    assert len(text) <= 500


@pytest.mark.asyncio
async def test_chat_context_includes_worldbuilding(db_session, test_user):
    project = await _create_project_with_worldbuilding(db_session, test_user.id)
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")

    assert "characters" in ctx
    assert "worldviews" in ctx
    assert "locations" in ctx
    assert "organizations" in ctx
    assert len(ctx["worldviews"]) == 1
    assert len(ctx["locations"]) == 1
    assert len(ctx["organizations"]) == 1


@pytest.mark.asyncio
async def test_format_for_chat_with_budget_includes_worldbuilding(db_session, test_user):
    project = await _create_project_with_worldbuilding(db_session, test_user.id)
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")
    text = builder.format_for_chat_with_budget(ctx, max_chars=4000)

    assert "【世界观】" in text
    assert "灵能纪元" in text
    assert "【地点】" in text
    assert "旧城" in text
    assert "【组织】" in text
    assert "灰烬公会" in text
    assert len(text) <= 4000


@pytest.mark.asyncio
async def test_project_context_includes_entity_ids_graph_and_state_text(db_session, test_user):
    project = await _create_project_with_worldbuilding(db_session, test_user.id)
    character = (
        await db_session.execute(select(Character).where(Character.project_id == project.id))
    ).scalar_one()
    organization = (
        await db_session.execute(select(Organization).where(Organization.project_id == project.id))
    ).scalar_one()
    db_session.add(
        EntityRelationship(
            project_id=project.id,
            source_type="character",
            source_id=character.id,
            relation_type="member_of",
            target_type="organization",
            target_id=organization.id,
            status="active",
            description="serves the guild",
            source="test",
        )
    )
    db_session.add(
        EntityStateEvent(
            project_id=project.id,
            entity_type="character",
            entity_id=character.id,
            state_key="condition",
            old_value="unknown",
            new_value="injured",
            summary="hurt during chapter events",
            source="test",
        )
    )
    await db_session.commit()
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")

    assert ctx["characters"][0]["id"] == character.id
    assert ctx["organizations"][0]["id"] == organization.id
    assert ctx["relationships"][0]["source_name"] == character.name
    assert ctx["relationships"][0]["target_name"] == organization.name
    assert ctx["state_events"][0]["entity_name"] == character.name

    chat_text = builder.format_for_chat_with_budget(ctx, max_chars=4000)
    plain_text = builder.format_as_text(ctx)
    for rendered in (chat_text, plain_text):
        assert "member_of" in rendered
        assert "serves the guild" in rendered
        assert "injured" in rendered
        assert organization.name in rendered


@pytest.mark.asyncio
async def test_format_for_chat_budget_omits_worldbuilding_when_tight(db_session, test_user):
    """当预算极紧时，应优先保留角色，可丢弃 worldbuilding。"""
    project = await _create_project_with_worldbuilding(db_session, test_user.id)
    builder = AIContextBuilder(db_session)

    ctx = await builder.get_project_context(project.id, mode="chat")
    # 给一个极小的预算迫使降级到丢弃 worldbuilding
    text = builder.format_for_chat_with_budget(ctx, max_chars=100)

    assert "项目：" in text
    assert "【角色基础列表】" in text
    assert len(text) <= 100
