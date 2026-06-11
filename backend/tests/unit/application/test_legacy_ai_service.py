"""LegacyAIService 单元测试"""

import pytest

from app.application.legacy_ai_service import LegacyAIService
from app.application.project_service import ProjectService
from app.core.exceptions import NotFoundError
from app.schemas.projects import ProjectCreate


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
