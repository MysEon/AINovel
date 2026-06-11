"""AIWorkflowService 单元测试"""

import pytest

from app.application.ai_workflow_service import AIWorkflowService
from app.application.project_service import ProjectService
from app.core.exceptions import NotFoundError
from app.schemas.ai import ChapterOutlineRequest
from app.schemas.projects import ProjectCreate


class TestAIWorkflowService:
    async def _create_project(self, db_session, user_id, name="测试项目"):
        proj_service = ProjectService(db_session)
        return await proj_service.create(ProjectCreate(name=name), user_id)

    async def test_get_run_not_found(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_run(99999, test_user.id)

    async def test_get_session_not_found(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_session(99999, test_user.id)

    async def test_get_artifact_not_found(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_artifact(99999, test_user.id)

    async def test_cancel_run_not_found(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        with pytest.raises(NotFoundError):
            await service.cancel_run(99999, test_user.id)

    async def test_list_runs_empty(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        result = await service.list_runs(test_user.id, None, None, None, 0, 20)
        assert result.total == 0
        assert result.items == []

    async def test_get_run_events_not_found(self, db_session, test_user):
        service = AIWorkflowService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_run_events(99999, test_user.id)

    async def test_generate_chapter_outline_no_config(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = AIWorkflowService(db_session)
        body = ChapterOutlineRequest(
            project_id=project.id,
            chapter_number=1,
            model_config_id=99999,
            user_requirements="",
        )
        with pytest.raises(NotFoundError):
            await service.generate_chapter_outline(body, test_user.id)
