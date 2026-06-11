"""章节 Repository"""

import re
from typing import Optional, Sequence

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.repositories.base import ProjectScopedRepository
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project


def calculate_word_count(content: str) -> int:
    """计算字数（中英文混合）"""
    if not content:
        return 0
    content = re.sub(r'\s+', ' ', content.strip())
    chinese = len(re.findall(r'[一-鿿　-〿＀-￯]', content))
    english = len(re.findall(r'\b[a-zA-Z]+\b', content))
    return chinese + english


class ChapterRepository(ProjectScopedRepository[Chapter]):
    model = Chapter

    async def get_by_project(
        self, project_id: int, *, skip: int = 0, limit: int = 100, load_options: Optional[list] = None,
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

    async def get_with_owner_check(self, chapter_id: int, user_id: int) -> Optional[Chapter]:
        """获取章节并校验项目所有权"""
        stmt = (
            select(Chapter)
            .join(Project)
            .where(Chapter.id == chapter_id, Project.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_project_stats(self, project_id: int) -> None:
        """更新项目的字数和章节统计"""
        words = await self.session.execute(
            select(func.sum(Chapter.word_count)).where(
                Chapter.project_id == project_id, Chapter.status == "published",
            )
        )
        count = await self.session.execute(
            select(func.count(Chapter.id)).where(
                Chapter.project_id == project_id, Chapter.status == "published",
            )
        )
        project = await self.session.get(Project, project_id)
        if project:
            project.word_count = words.scalar_one_or_none() or 0
            project.chapter_count = count.scalar_one_or_none() or 0
