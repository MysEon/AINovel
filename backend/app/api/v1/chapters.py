"""章节管理 API v1"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.chapter_service import ChapterService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.chapters import (
    BatchPublishRequest,
    BatchPublishResponse,
    ChapterBatchUpdate,
    ChapterCreate,
    ChapterResponse,
    ChapterUpdate,
)

router = APIRouter(tags=["内容创作：章节"])


@router.post(
    "/api/v1/projects/{project_id}/chapters",
    response_model=ChapterResponse,
    status_code=201,
)
async def create_chapter(
    project_id: int,
    body: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.create_chapter(project_id, user.id, body)


@router.get(
    "/api/v1/projects/{project_id}/chapters",
    response_model=list[ChapterResponse],
)
async def list_chapters(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.list_chapters(project_id, user.id)


@router.get("/api/v1/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.get_chapter(chapter_id, user.id)


@router.put("/api/v1/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    body: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.update_chapter(chapter_id, user.id, body)


@router.delete("/api/v1/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.delete_chapter(chapter_id, user.id)


@router.get("/api/v1/projects/{project_id}/chapters/unpublished")
async def get_unpublished_chapters(
    project_id: int,
    current_chapter_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.get_unpublished_chapters(project_id, user.id, current_chapter_id)


@router.post("/api/v1/chapters/batch_update_status")
async def batch_update_chapter_status(
    body: ChapterBatchUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.batch_update_status(body.project_id, user.id, body)


@router.post("/api/v1/chapters/batch-publish", response_model=BatchPublishResponse)
async def batch_publish_chapters(
    body: BatchPublishRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ChapterService(db)
    return await service.batch_publish(body.project_id, user.id, body)
