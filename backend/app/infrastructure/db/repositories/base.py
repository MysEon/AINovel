"""
通用 Repository 基类
封装常见 CRUD 操作，子类只需声明 model 即可复用
"""

from typing import TypeVar, Generic, Type, Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """通用 CRUD Repository"""

    model: Type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, id: int) -> Optional[ModelT]:
        return await self.session.get(self.model, id)

    async def get_all(
        self, *, skip: int = 0, limit: int = 100, load_options: Optional[list] = None,
    ) -> Sequence[ModelT]:
        stmt = select(self.model).offset(skip).limit(limit)
        if load_options:
            for opt in load_options:
                stmt = stmt.options(opt)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def update(self, obj: ModelT, **kwargs) -> ModelT:
        for k, v in kwargs.items():
            setattr(obj, k, v)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model)
        result = await self.session.execute(stmt)
        return result.scalar_one()


class ProjectScopedRepository(BaseRepository[ModelT]):
    """带项目所有权过滤的 Repository，适用于 Character/Chapter/Location 等"""

    async def get_by_project(
        self, project_id: int, *, skip: int = 0, limit: int = 100, load_options: Optional[list] = None,
    ) -> Sequence[ModelT]:
        stmt = (
            select(self.model)
            .where(self.model.project_id == project_id)
            .offset(skip).limit(limit)
        )
        if load_options:
            for opt in load_options:
                stmt = stmt.options(opt)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_one_in_project(
        self, id: int, project_id: int,
    ) -> Optional[ModelT]:
        stmt = select(self.model).where(
            self.model.id == id,
            self.model.project_id == project_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
