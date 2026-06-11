"""草稿管理 API v1"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.draft_service import DraftService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.drafts import DraftCreate, DraftResponse, DraftUpdate

router = APIRouter(tags=["内容创作：草稿"])


@router.post(
    "/api/v1/projects/{project_id}/drafts",
    response_model=DraftResponse,
    status_code=201,
)
async def create_draft(
    project_id: int,
    body: DraftCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = DraftService(db)
    return await service.create_draft(project_id, user.id, body)


@router.get(
    "/api/v1/projects/{project_id}/drafts",
    response_model=list[DraftResponse],
)
async def list_drafts(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = DraftService(db)
    return await service.list_drafts(project_id, user.id)


@router.get("/api/v1/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = DraftService(db)
    return await service.get_draft(draft_id, user.id)


@router.put("/api/v1/drafts/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: int,
    body: DraftUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = DraftService(db)
    return await service.update_draft(draft_id, user.id, body)


@router.delete("/api/v1/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = DraftService(db)
    return await service.delete_draft(draft_id, user.id)
