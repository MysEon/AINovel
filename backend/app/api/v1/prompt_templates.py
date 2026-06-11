"""提示词模板管理 API v1"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.prompt_template_service import PromptTemplateService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.prompts import PromptTemplateCreate, PromptTemplateResponse, PromptTemplateUpdate

router = APIRouter(prefix="/api/v1/prompt-templates", tags=["AI辅助：提示词模板"])


@router.get("/", response_model=list[PromptTemplateResponse])
async def list_templates(
    category: str | None = Query(None),
    search: str | None = Query(None),
    include_system: bool = Query(True),
    only_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.list_templates(
        user.id,
        category=category,
        search=search,
        include_system=include_system,
        only_active=only_active,
    )


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
    service = PromptTemplateService(db)
    return await service.create_template(body, user.id)


@router.get("/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.get_template(template_id, user.id)


@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    template_id: int,
    body: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.update_template(template_id, user.id, body)


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.delete_template(template_id, user.id)


@router.post("/{template_id}/copy", response_model=PromptTemplateResponse)
async def copy_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.copy_template(template_id, user.id)


@router.post("/{template_id}/use")
async def record_usage(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.record_usage(template_id, user.id)


@router.post("/initialize-system-templates")
async def initialize_system_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.initialize_system_templates()


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: int,
    variables: str | None = Query(None, description="JSON格式的变量值"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = PromptTemplateService(db)
    return await service.preview_template(template_id, user.id, variables)
