"""项目 Repository"""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project

    async def get_by_user(
        self,
        user_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Project]:
        stmt = (
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(Project.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_user_project(
        self,
        project_id: int,
        user_id: int,
    ) -> Project | None:
        """获取用户拥有的项目（所有权校验），默认预加载 chapters"""
        stmt = (
            select(Project)
            .where(Project.id == project_id, Project.user_id == user_id)
            .options(selectinload(Project.chapters))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_project_by_name(
        self,
        name: str,
        user_id: int,
    ) -> Project | None:
        """按名称查找用户项目（用于重名检测）"""
        stmt = select(Project).where(Project.name == name, Project.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_stats(self, user_id: int) -> list:
        """获取用户项目列表，附带章节统计"""
        stats_sq = (
            select(
                Chapter.project_id,
                func.sum(Chapter.word_count).label("total_words"),
                func.count(Chapter.id).label("total_chapters"),
            )
            .group_by(Chapter.project_id)
            .subquery()
        )
        stmt = (
            select(
                Project,
                stats_sq.c.total_words,
                stats_sq.c.total_chapters,
            )
            .outerjoin(stats_sq, Project.id == stats_sq.c.project_id)
            .where(Project.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.all()
