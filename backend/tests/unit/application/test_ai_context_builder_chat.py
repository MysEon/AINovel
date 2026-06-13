"""AIContextBuilder chat formatting tests."""

import pytest

from app.application.ai_context_builder import AIContextBuilder, count_tokens_estimate
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character


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
