"""Worldbuilding service — shared CRUD for Character/Location/Organization/Worldview.

Used by API routes and chat assistant tools to avoid duplication.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.entity_integrity import cleanup_entity_references
from app.core.exceptions import NotFoundError
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization, Worldview

EntityModel = Character | Location | Organization | Worldview

MODEL_MAP: dict[str, type[EntityModel]] = {
    "character": Character,
    "location": Location,
    "organization": Organization,
    "worldview": Worldview,
}


def _get_model(entity_type: str) -> type[EntityModel]:
    try:
        return MODEL_MAP[entity_type.lower()]
    except KeyError as exc:
        raise ValueError(f"未知实体类型: {entity_type}") from exc


class WorldbuildingService:
    """四实体通用 CRUD service。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _require_entity(
        self,
        project_id: int,
        model: type[EntityModel],
        entity_id: int,
        user_id: int | None = None,
    ) -> EntityModel:
        """按 id 查询实体并校验归属。"""
        stmt = select(model).where(model.id == entity_id)
        if user_id is not None:
            stmt = stmt.join(Project).where(Project.user_id == user_id)
        result = await self.db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError(f"{model.__tablename__} 不存在或无权访问")
        if entity.project_id != project_id:
            raise NotFoundError(f"{model.__tablename__} 不属于当前项目")
        return entity

    async def create_entity(
        self,
        project_id: int,
        entity_type: str,
        data: dict,
        user_id: int | None = None,
    ) -> EntityModel:
        """创建实体。user_id 不为 None 时校验项目归属。"""
        if user_id is not None:
            from app.application.project_service import ProjectService

            await ProjectService(self.db).require_user_project(project_id, user_id)

        model = _get_model(entity_type)
        entity = model(**data, project_id=project_id)
        self.db.add(entity)
        await self.db.commit()
        await self.db.refresh(entity)
        return entity

    async def update_entity(
        self,
        project_id: int,
        entity_type: str,
        entity_id: int,
        data: dict,
        user_id: int | None = None,
    ) -> EntityModel:
        """更新实体，data 由调用方按 exclude_unset 语义准备。"""
        model = _get_model(entity_type)
        entity = await self._require_entity(project_id, model, entity_id, user_id)
        for key, value in data.items():
            setattr(entity, key, value)
        await self.db.commit()
        await self.db.refresh(entity)
        return entity

    async def delete_entity(
        self,
        project_id: int,
        entity_type: str,
        entity_id: int,
        user_id: int | None = None,
    ) -> None:
        """删除实体：先清理孤儿引用，再删除。"""
        model = _get_model(entity_type)
        entity = await self._require_entity(project_id, model, entity_id, user_id)
        await cleanup_entity_references(
            self.db,
            project_id=project_id,
            entity_type=entity_type.lower(),
            entity_id=entity_id,
        )
        await self.db.delete(entity)
        await self.db.commit()

    async def get_entity_by_id(
        self,
        project_id: int,
        entity_type: str,
        entity_id: int,
        user_id: int | None = None,
    ) -> EntityModel | None:
        """按 id 查询实体。"""
        model = _get_model(entity_type)
        stmt = select(model).where(model.id == entity_id, model.project_id == project_id)
        if user_id is not None:
            stmt = stmt.join(Project).where(Project.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_entity_by_name(
        self,
        project_id: int,
        entity_type: str,
        name: str,
    ) -> EntityModel | None:
        """按 name 精确匹配；未命中则 ilike 降级。"""
        model = _get_model(entity_type)
        result = await self.db.execute(
            select(model)
            .where(model.project_id == project_id, model.name == name)
            .limit(1)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            result = await self.db.execute(
                select(model)
                .where(model.project_id == project_id, model.name.ilike(f"%{name}%"))
                .limit(1)
            )
            entity = result.scalar_one_or_none()
        return entity

    async def list_entities(
        self,
        project_id: int,
        entity_type: str,
        limit: int = 100,
    ) -> list[EntityModel]:
        """列出项目下的实体。"""
        model = _get_model(entity_type)
        result = await self.db.execute(
            select(model).where(model.project_id == project_id).order_by(model.id).limit(limit)
        )
        return list(result.scalars().all())
