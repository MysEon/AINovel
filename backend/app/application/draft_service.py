"""草稿 Application Service

职责：
- CRUD + word_count 计算
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.project_service import ProjectService
from app.core.exceptions import NotFoundError
from app.domain.word_count import calculate_word_count
from app.infrastructure.db.models.manuscript import Draft
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.base import ProjectScopedRepository
from app.schemas.drafts import DraftCreate, DraftUpdate


class DraftRepository(ProjectScopedRepository[Draft]):
    model = Draft


class DraftService:
    """草稿业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DraftRepository(db)
        self.proj_service = ProjectService(db)

    async def _get_draft_with_owner_check(self, draft_id: int, user_id: int) -> Draft:
        """获取草稿并校验所有权"""
        stmt = select(Draft).join(Project).where(Draft.id == draft_id, Project.user_id == user_id)
        result = await self.db.execute(stmt)
        draft = result.scalar_one_or_none()
        if not draft:
            raise NotFoundError("草稿不存在或无权访问")
        return draft

    async def create_draft(self, project_id: int, user_id: int, body: DraftCreate) -> Draft:
        """创建草稿"""
        await self.proj_service.require_user_project(project_id, user_id)

        word_count = calculate_word_count(body.content) if body.content else 0
        draft = Draft(
            **body.model_dump(),
            project_id=project_id,
            word_count=word_count,
        )
        await self.repo.create(draft)
        await self.db.commit()
        await self.db.refresh(draft)
        return draft

    async def list_drafts(self, project_id: int, user_id: int) -> list[Draft]:
        """列出项目下的所有草稿"""
        await self.proj_service.require_user_project(project_id, user_id)
        return await self.repo.get_by_project(project_id)

    async def get_draft(self, draft_id: int, user_id: int) -> Draft:
        """获取单个草稿"""
        return await self._get_draft_with_owner_check(draft_id, user_id)

    async def update_draft(self, draft_id: int, user_id: int, body: DraftUpdate) -> Draft:
        """更新草稿并重新计算字数"""
        draft = await self._get_draft_with_owner_check(draft_id, user_id)

        data = body.model_dump(exclude_unset=True)
        if "content" in data and data["content"] is not None:
            data["word_count"] = calculate_word_count(data["content"])

        for key, value in data.items():
            setattr(draft, key, value)

        await self.db.commit()
        await self.db.refresh(draft)
        return draft

    async def delete_draft(self, draft_id: int, user_id: int) -> dict:
        """删除草稿"""
        draft = await self._get_draft_with_owner_check(draft_id, user_id)
        await self.db.delete(draft)
        await self.db.commit()
        return {"message": f"草稿 '{draft.title}' 已成功删除"}
