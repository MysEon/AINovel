"""章节 Repository"""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.repositories.base import ProjectScopedRepository


class ChapterRepository(ProjectScopedRepository[Chapter]):
    model = Chapter

    async def get_by_project(
        self,
        project_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        load_options: list | None = None,
    ) -> Sequence[Chapter]:
        if load_options is None:
            load_options = [selectinload(Chapter.project)]
        return await super().get_by_project(project_id, skip=skip, limit=limit, load_options=load_options)

    async def get_next_numbers(self, project_id: int) -> tuple[int, int]:
        """获取下一个章节编号和排序索引"""
        max_num = await self.session.execute(
            select(func.max(Chapter.chapter_number)).where(Chapter.project_id == project_id)
        )
        max_ord = await self.session.execute(
            select(func.max(Chapter.order_index)).where(Chapter.project_id == project_id)
        )
        return (max_num.scalar_one_or_none() or 0) + 1, (max_ord.scalar_one_or_none() or 0) + 1

    async def get_unpublished(self, project_id: int) -> Sequence[Chapter]:
        stmt = (
            select(Chapter)
            .where(Chapter.project_id == project_id, Chapter.status == "draft")
            .order_by(Chapter.order_index)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_with_owner_check(self, chapter_id: int, user_id: int) -> Chapter | None:
        """获取章节并校验项目所有权"""
        from app.infrastructure.db.models.projects import Project

        stmt = select(Chapter).join(Project).where(Chapter.id == chapter_id, Project.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
