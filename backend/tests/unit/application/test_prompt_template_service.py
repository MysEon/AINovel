"""PromptTemplateService 单元测试"""

import pytest

from app.application.prompt_template_service import PromptTemplateService
from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.prompts import PromptTemplateCreate, PromptTemplateUpdate


class TestPromptTemplateService:
    async def test_create_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        body = PromptTemplateCreate(name="测试模板", template="你好 {{name}}", category="chat")
        tpl = await service.create_template(body, test_user.id)
        assert tpl.name == "测试模板"
        assert tpl.user_id == test_user.id

    async def test_get_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="获取", template="内容", category="chat"), test_user.id
        )
        tpl = await service.get_template(created.id, test_user.id)
        assert tpl.id == created.id

    async def test_get_template_not_found(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_template(99999, test_user.id)

    async def test_update_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="旧", template="旧", category="chat"), test_user.id
        )
        updated = await service.update_template(created.id, test_user.id, PromptTemplateUpdate(name="新"))
        assert updated.name == "新"

    async def test_delete_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="待删", template="内容", category="chat"), test_user.id
        )
        result = await service.delete_template(created.id, test_user.id)
        assert "待删" in result["message"]
        with pytest.raises(NotFoundError):
            await service.get_template(created.id, test_user.id)

    async def test_list_templates(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        await service.create_template(PromptTemplateCreate(name="列表A", template="A", category="chat"), test_user.id)
        tpls = await service.list_templates(test_user.id)
        assert any(t.name == "列表A" for t in tpls)

    async def test_copy_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="原文", template="内容", category="chat"), test_user.id
        )
        copied = await service.copy_template(created.id, test_user.id)
        assert copied.name == "原文 (副本)"

    async def test_record_usage(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="使用", template="内容", category="chat"), test_user.id
        )
        result = await service.record_usage(created.id, test_user.id)
        assert result["usage_count"] == 1

    async def test_preview_template(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="预览", template="你好 {{name}}", category="chat"), test_user.id
        )
        result = await service.preview_template(created.id, test_user.id, '{"name": "世界"}')
        assert result["rendered"] == "你好 世界"
        assert result["missing_variables"] == []

    async def test_preview_template_missing_variable(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="预览3", template="你好 {{name}}", category="chat", variables='["name"]'),
            test_user.id,
        )
        result = await service.preview_template(created.id, test_user.id, None)
        assert result["missing_variables"] == ["name"]

    async def test_preview_template_bad_json(self, db_session, test_user):
        service = PromptTemplateService(db_session)
        created = await service.create_template(
            PromptTemplateCreate(name="预览2", template="你好", category="chat"), test_user.id
        )
        with pytest.raises(ValidationError):
            await service.preview_template(created.id, test_user.id, "not json")

    async def test_initialize_system_templates(self, db_session):
        service = PromptTemplateService(db_session)
        result = await service.initialize_system_templates()
        assert result["count"] >= 0
