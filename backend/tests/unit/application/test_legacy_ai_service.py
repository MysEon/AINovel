"""LegacyAIService 单元测试"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.application.legacy_ai_service import LegacyAIService
from app.application.project_service import ProjectService
from app.application.prompt_template_service import PromptTemplateService
from app.core.exceptions import NotFoundError
from app.schemas.projects import ProjectCreate
from app.schemas.prompts import PromptTemplateCreate


class TestLegacyAIService:
    async def _create_project(self, db_session, user_id, name="测试项目"):
        proj_service = ProjectService(db_session)
        return await proj_service.create(ProjectCreate(name=name), user_id)

    async def test_get_project_context(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id, name="上下文项目")
        service = LegacyAIService(db_session)
        result = await service.get_project_context(project.id, test_user.id)
        assert result["success"] is True
        assert result["context"]["project_name"] == "上下文项目"

    async def test_available_models(self, db_session):
        service = LegacyAIService(db_session)
        result = service.available_models()
        assert result["success"] is True
        assert len(result["models"]) > 0

    async def test_get_project_context_not_found(self, db_session, test_user):
        service = LegacyAIService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_project_context(99999, test_user.id)

    async def test_simple_generate_no_config(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = LegacyAIService(db_session)
        with pytest.raises(NotFoundError):
            await service.simple_generate(project.id, 99999, test_user.id, "system", "user")

    async def test_chat_without_prompt_template(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="默认项目")
        service = LegacyAIService(db_session)
        model = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content="默认回复")))
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=model))

        result = await service.chat(
            project_id=project.id,
            model_config_id=1,
            message="继续写",
            history=None,
            user_id=test_user.id,
        )

        assert result["success"] is True
        messages = model.ainvoke.call_args.args[0]
        assert messages[0].content == "你是一个专业的小说写作助手。当前项目：默认项目"

    async def test_chat_with_prompt_template(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="模板项目")
        service = LegacyAIService(db_session)
        prompt_service = PromptTemplateService(db_session)
        template = await prompt_service.create_template(
            PromptTemplateCreate(
                name="对话模板",
                category="chat",
                template="项目：{{project_info}}\n历史：{{history}}\n消息：{{message}}",
            ),
            test_user.id,
        )
        model = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content="模板回复")))
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=model))

        result = await service.chat(
            project_id=project.id,
            model_config_id=1,
            message="用户原文",
            history=[
                {"role": "user", "content": "你好"},
                {"role": "assistant", "content": "您好"},
            ],
            user_id=test_user.id,
            prompt_template_id=template.id,
        )

        assert result["success"] is True
        messages = model.ainvoke.call_args.args[0]
        assert "模板项目" in messages[0].content
        assert "用户原文" in messages[0].content
        assert "用户: 你好" in messages[0].content
        assert "助手: 您好" in messages[0].content
        assert messages[-1].content == "用户原文"
        refreshed = await prompt_service.get_template(template.id, test_user.id)
        assert refreshed.usage_count == 1

    async def test_chat_with_invalid_prompt_template(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id, name="异常项目")
        service = LegacyAIService(db_session)
        model = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content="不应调用")))
        monkeypatch.setattr(service, "_get_config_and_model", AsyncMock(return_value=model))

        with pytest.raises(NotFoundError):
            await service.chat(
                project_id=project.id,
                model_config_id=1,
                message="继续写",
                history=None,
                user_id=test_user.id,
                prompt_template_id=99999,
            )
        model.ainvoke.assert_not_called()
