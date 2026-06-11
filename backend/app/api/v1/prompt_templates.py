"""提示词模板管理 API v1"""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.prompts import PromptTemplate
from app.infrastructure.db.repositories.base import BaseRepository
from app.infrastructure.db.session import get_db
from app.schemas.prompts import PromptTemplateCreate, PromptTemplateResponse, PromptTemplateUpdate

router = APIRouter(prefix="/api/v1/prompt-templates", tags=["AI辅助：提示词模板"])


class PromptTemplateRepository(BaseRepository[PromptTemplate]):
    model = PromptTemplate


async def _get_template_with_access(
    template_id: int,
    user_id: int,
    db: AsyncSession,
) -> PromptTemplate:
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise NotFoundError("提示词模板不存在")
    if not tpl.is_system and tpl.user_id != user_id:
        raise ForbiddenError("无权访问此模板")
    return tpl


@router.get("/", response_model=list[PromptTemplateResponse])
async def list_templates(
    category: str | None = Query(None),
    search: str | None = Query(None),
    include_system: bool = Query(True),
    only_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    conditions = []
    if include_system:
        conditions.append(or_(PromptTemplate.is_system == True, PromptTemplate.user_id == user.id))
    else:
        conditions.append(PromptTemplate.user_id == user.id)
    if category:
        conditions.append(PromptTemplate.category == category)
    if only_active:
        conditions.append(PromptTemplate.is_active == True)
    if search:
        conditions.append(
            or_(
                PromptTemplate.name.ilike(f"%{search}%"),
                PromptTemplate.description.ilike(f"%{search}%"),
                PromptTemplate.tags.ilike(f"%{search}%"),
            )
        )

    stmt = (
        select(PromptTemplate)
        .where(and_(*conditions))
        .order_by(PromptTemplate.is_system.desc(), PromptTemplate.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/categories")
async def get_categories(user: User = Depends(require_active_user)):
    return [
        {"value": "outline", "label": "大纲生成"},
        {"value": "suggestions", "label": "情节建议"},
        {"value": "optimization", "label": "内容优化"},
        {"value": "creative", "label": "创意生成"},
        {"value": "chat", "label": "AI对话"},
        {"value": "writing_advice", "label": "写作建议"},
        {"value": "ai_mode_assist", "label": "辅助优化型模式"},
        {"value": "ai_mode_takeover", "label": "全面接管型模式"},
    ]


@router.post("/", response_model=PromptTemplateResponse, status_code=201)
async def create_template(
    body: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    tpl = PromptTemplate(
        **body.model_dump(),
        user_id=user.id,
        is_system=False,
        usage_count=0,
    )
    repo = PromptTemplateRepository(db)
    await repo.create(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.get("/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    return await _get_template_with_access(template_id, user.id, db)


@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    template_id: int,
    body: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    tpl = await _get_template_with_access(template_id, user.id, db)
    if tpl.is_system:
        raise ForbiddenError("系统模板不允许修改，请复制后编辑")
    if tpl.user_id != user.id:
        raise ForbiddenError("只能修改自己创建的模板")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(tpl, key, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    tpl = await _get_template_with_access(template_id, user.id, db)
    if tpl.is_system:
        raise ForbiddenError("系统模板不允许删除")
    if tpl.user_id != user.id:
        raise ForbiddenError("只能删除自己创建的模板")

    await db.delete(tpl)
    await db.commit()
    return {"message": f"提示词模板 '{tpl.name}' 已成功删除"}


@router.post("/{template_id}/copy", response_model=PromptTemplateResponse)
async def copy_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    original = await _get_template_with_access(template_id, user.id, db)
    copy = PromptTemplate(
        name=f"{original.name} (副本)",
        category=original.category,
        template=original.template,
        description=original.description,
        variables=original.variables,
        tags=original.tags,
        user_id=user.id,
        is_system=False,
        is_active=True,
        usage_count=0,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy


@router.post("/{template_id}/use")
async def record_usage(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    tpl = await _get_template_with_access(template_id, user.id, db)
    tpl.usage_count += 1
    await db.commit()
    return {"message": "已记录使用", "usage_count": tpl.usage_count}


@router.post("/initialize-system-templates")
async def initialize_system_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """初始化系统默认模板（从种子数据加载）"""
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.is_system == True))
    existing = result.scalars().all()
    if existing:
        return {"message": "系统模板已存在，无需重复初始化", "count": len(existing)}

    # TODO: 将系统模板种子数据迁移到独立模块 app/domain/prompts/seed.py
    from app.domain.prompts.seed import get_system_templates

    templates = get_system_templates()
    for data in templates:
        data["user_id"] = None
        db.add(PromptTemplate(**data))

    await db.commit()
    return {"message": f"已初始化 {len(templates)} 个系统模板", "count": len(templates)}


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: int,
    variables: str | None = Query(None, description="JSON格式的变量值"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    tpl = await _get_template_with_access(template_id, user.id, db)

    var_dict = {}
    if variables:
        try:
            var_dict = json.loads(variables)
        except json.JSONDecodeError:
            from app.core.exceptions import ValidationError

            raise ValidationError("变量格式错误，需要合法 JSON")

    rendered = tpl.template
    for key, value in var_dict.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))

    template_vars = []
    if tpl.variables:
        try:
            template_vars = json.loads(tpl.variables)
        except json.JSONDecodeError:
            pass

    return {
        "template": tpl.template,
        "variables": tpl.variables,
        "rendered": rendered,
        "missing_variables": [v for v in template_vars if v not in var_dict],
    }
