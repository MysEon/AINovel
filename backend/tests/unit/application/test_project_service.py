"""ProjectService 单元测试"""

import pytest

from app.application.project_service import ProjectService
from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.projects import ProjectCreate, ProjectUpdate


class TestProjectService:
    async def test_create_project(self, db_session, test_user):
        service = ProjectService(db_session)
        body = ProjectCreate(name="新建项目", description="描述")
        project = await service.create(body, test_user.id)
        assert project.name == "新建项目"
        assert project.user_id == test_user.id

    async def test_create_duplicate_name(self, db_session, test_user):
        service = ProjectService(db_session)
        body = ProjectCreate(name="重复项目")
        await service.create(body, test_user.id)
        with pytest.raises(ConflictError):
            await service.create(body, test_user.id)

    async def test_require_user_project_not_found(self, db_session, test_user):
        service = ProjectService(db_session)
        with pytest.raises(NotFoundError):
            await service.require_user_project(99999, test_user.id)

    async def test_list_with_stats(self, db_session, test_user):
        service = ProjectService(db_session)
        await service.create(ProjectCreate(name="项目A"), test_user.id)
        result = await service.list_with_stats(test_user.id)
        assert any(r.name == "项目A" for r in result)

    async def test_get_project(self, db_session, test_user):
        service = ProjectService(db_session)
        created = await service.create(ProjectCreate(name="获取项目"), test_user.id)
        project = await service.get_project(created.id, test_user.id)
        assert project.id == created.id

    async def test_update_project(self, db_session, test_user):
        service = ProjectService(db_session)
        created = await service.create(ProjectCreate(name="旧名称"), test_user.id)
        updated = await service.update_project(created.id, test_user.id, ProjectUpdate(name="新名称"))
        assert updated.name == "新名称"

    async def test_delete_project(self, db_session, test_user):
        service = ProjectService(db_session)
        created = await service.create(ProjectCreate(name="删除项目"), test_user.id)
        result = await service.delete_project(created.id, test_user.id)
        assert "删除项目" in result["message"]
        with pytest.raises(NotFoundError):
            await service.get_project(created.id, test_user.id)
