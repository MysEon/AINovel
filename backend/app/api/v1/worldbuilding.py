"""世界观模块 API v1（角色/地点/组织/世界观）

四个实体共享相同的 CRUD 模式，用工厂函数生成路由。
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.entity_integrity import cleanup_entity_references
from app.application.project_service import ProjectService
from app.core.character_templates import build_character_template_registry
from app.core.exceptions import NotFoundError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.repositories.base import ProjectScopedRepository
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.get(
    "/api/v1/character-templates",
    tags=["小说元素：角色"],
    name="get_character_templates",
)
async def get_character_templates(
    user: User = Depends(require_active_user),
):
    # 预留 user / project 级模板扩展，当前返回系统模板注册表。
    _ = user
    return build_character_template_registry()


def _register_crud(
    *,
    model: type[Base],
    create_schema: type[BaseModel],
    update_schema: type[BaseModel],
    response_schema: type[BaseModel],
    plural: str,
    singular: str,
    label: str,
    tag: str,
):
    """为一个世界观实体注册标准 CRUD 五端点"""

    class _Repo(ProjectScopedRepository):
        pass

    _Repo.model = model

    @router.post(
        f"/api/v1/projects/{{project_id}}/{plural}",
        response_model=response_schema,
        status_code=201,
        tags=[tag],
        name=f"create_{singular}",
    )
    async def create_entity(
        project_id: int,
        body: create_schema,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_active_user),
    ):
        proj_service = ProjectService(db)
        await proj_service.require_user_project(project_id, user.id)

        entity = model(**body.model_dump(), project_id=project_id)
        repo = _Repo(db)
        await repo.create(entity)
        await db.commit()
        await db.refresh(entity)
        return entity

    @router.get(
        f"/api/v1/projects/{{project_id}}/{plural}",
        response_model=list[response_schema],
        tags=[tag],
        name=f"list_{plural}",
    )
    async def list_entities(
        project_id: int,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_active_user),
    ):
        proj_service = ProjectService(db)
        await proj_service.require_user_project(project_id, user.id)

        repo = _Repo(db)
        return await repo.get_by_project(project_id)

    @router.get(
        f"/api/v1/{plural}/{{item_id}}",
        response_model=response_schema,
        tags=[tag],
        name=f"get_{singular}",
    )
    async def get_entity(
        item_id: int,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_active_user),
    ):
        from sqlalchemy import select

        from app.infrastructure.db.models.projects import Project

        stmt = select(model).join(Project).where(model.id == item_id, Project.user_id == user.id)
        result = await db.execute(stmt)
        entity = result.scalar_one_or_none()
        if not entity:
            raise NotFoundError(f"{label}不存在或无权访问")
        return entity

    @router.put(
        f"/api/v1/{plural}/{{item_id}}",
        response_model=response_schema,
        tags=[tag],
        name=f"update_{singular}",
    )
    async def update_entity(
        item_id: int,
        body: update_schema,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_active_user),
    ):
        entity = await get_entity(item_id, db, user)
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(entity, key, value)
        await db.commit()
        await db.refresh(entity)
        return entity

    @router.delete(
        f"/api/v1/{plural}/{{item_id}}",
        tags=[tag],
        name=f"delete_{singular}",
    )
    async def delete_entity(
        item_id: int,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_active_user),
    ):
        entity = await get_entity(item_id, db, user)
        # 清理该实体的全部图引用（关系/状态时间线/待处理提案操作），避免孤儿软引用
        await cleanup_entity_references(
            db,
            project_id=entity.project_id,
            entity_type=singular,
            entity_id=item_id,
        )
        await db.delete(entity)
        await db.commit()
        return {"message": f"{label} '{entity.name}' 已成功删除"}


# ── 注册四个实体 ───────────────────────────────────────

from app.infrastructure.db.models.worldbuilding import (
    Character,
    Location,
    Organization,
    Worldview,
)
from app.schemas.worldbuilding import (
    CharacterCreate,
    CharacterResponse,
    CharacterUpdate,
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    WorldviewCreate,
    WorldviewResponse,
    WorldviewUpdate,
)

_register_crud(
    model=Character,
    create_schema=CharacterCreate,
    update_schema=CharacterUpdate,
    response_schema=CharacterResponse,
    plural="characters",
    singular="character",
    label="角色",
    tag="小说元素：角色",
)

_register_crud(
    model=Location,
    create_schema=LocationCreate,
    update_schema=LocationUpdate,
    response_schema=LocationResponse,
    plural="locations",
    singular="location",
    label="地点",
    tag="小说元素：地点",
)

_register_crud(
    model=Organization,
    create_schema=OrganizationCreate,
    update_schema=OrganizationUpdate,
    response_schema=OrganizationResponse,
    plural="organizations",
    singular="organization",
    label="组织",
    tag="小说元素：组织",
)

_register_crud(
    model=Worldview,
    create_schema=WorldviewCreate,
    update_schema=WorldviewUpdate,
    response_schema=WorldviewResponse,
    plural="worldviews",
    singular="worldview",
    label="世界观",
    tag="小说元素：世界观",
)
