"""DraftService 单元测试"""

import pytest

from app.application.draft_service import DraftService
from app.application.project_service import ProjectService
from app.core.exceptions import NotFoundError
from app.schemas.drafts import DraftCreate, DraftUpdate
from app.schemas.projects import ProjectCreate


class TestDraftService:
    async def _create_project(self, db_session, user_id, name="测试项目"):
        proj_service = ProjectService(db_session)
        return await proj_service.create(ProjectCreate(name=name), user_id)

    async def test_create_draft(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = DraftService(db_session)
        body = DraftCreate(title="草稿", content="草稿内容")
        draft = await service.create_draft(project.id, test_user.id, body)
        assert draft.title == "草稿"
        assert draft.word_count > 0

    async def test_update_draft(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = DraftService(db_session)
        draft = await service.create_draft(project.id, test_user.id, DraftCreate(title="旧", content="旧内容"))
        updated = await service.update_draft(draft.id, test_user.id, DraftUpdate(title="新", content="新内容更长一些"))
        assert updated.title == "新"
        assert updated.word_count > 0

    async def test_delete_draft(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = DraftService(db_session)
        draft = await service.create_draft(project.id, test_user.id, DraftCreate(title="待删"))
        result = await service.delete_draft(draft.id, test_user.id)
        assert "待删" in result["message"]
        with pytest.raises(NotFoundError):
            await service.get_draft(draft.id, test_user.id)

    async def test_list_drafts(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = DraftService(db_session)
        await service.create_draft(project.id, test_user.id, DraftCreate(title="草稿1"))
        drafts = await service.list_drafts(project.id, test_user.id)
        assert len(drafts) >= 1

    async def test_get_draft_not_found(self, db_session, test_user):
        service = DraftService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_draft(99999, test_user.id)
