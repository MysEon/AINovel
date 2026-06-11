"""项目 Application Service

职责：
- 项目 CRUD 与权限校验
- 统一 require_user_project()，消除 API 层重复
- list_with_stats DTO 组装
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.project import ProjectRepository
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate


class ProjectService:
    """项目业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProjectRepository(db)

    async def require_user_project(self, project_id: int, user_id: int) -> Project:
        """校验项目归属，不存在则抛 NotFoundError"""
        project = await self.repo.get_user_project(project_id, user_id)
        if not project:
            raise NotFoundError("项目不存在或无权访问")
        return project

    async def create(self, body: ProjectCreate, user_id: int) -> Project:
        """创建项目，检查名称唯一性"""
        if await self.repo.get_user_project_by_name(body.name, user_id):
            raise ConflictError("项目名称已存在，请使用其他名称")

        project = Project(name=body.name, description=body.description, user_id=user_id)
        await self.repo.create(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def list_with_stats(self, user_id: int) -> list[ProjectResponse]:
        """列出用户项目并组装统计 DTO"""
        rows = await self.repo.get_with_stats(user_id)
        result: list[ProjectResponse] = []
        for project, word_count, chapter_count in rows:
            resp = ProjectResponse.model_validate(project)
            resp.word_count = word_count or 0
            resp.chapter_count = chapter_count or 0
            result.append(resp)
        return result

    async def get_project(self, project_id: int, user_id: int) -> Project:
        """获取项目详情"""
        return await self.require_user_project(project_id, user_id)

    async def update_project(self, project_id: int, user_id: int, body: ProjectUpdate) -> Project:
        """更新项目"""
        project = await self.require_user_project(project_id, user_id)
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(project, key, value)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete_project(self, project_id: int, user_id: int) -> dict:
        """删除项目"""
        project = await self.require_user_project(project_id, user_id)
        await self.db.delete(project)
        await self.db.commit()
        return {"message": f"项目 '{project.name}' 已成功删除"}
