"""章节管理 API v1"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from typing import List, Optional

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.chapter import ChapterRepository, calculate_word_count
from app.infrastructure.db.repositories.project import ProjectRepository
from app.schemas.chapters import (
    ChapterCreate, ChapterUpdate, ChapterResponse,
    ChapterBatchUpdate, BatchPublishRequest, BatchPublishResponse,
)
from app.api.deps.auth import require_active_user

router = APIRouter(tags=["内容创作：章节"])


async def _get_user_project(
    repo: ProjectRepository, project_id: int, user_id: int,
) -> Project:
    project = await repo.get_user_project(project_id, user_id)
    if not project:
        raise NotFoundError("项目不存在或您没有权限访问")
    return project


@router.post(
    "/api/v1/projects/{project_id}/chapters",
    response_model=ChapterResponse, status_code=201,
)
async def create_chapter(
    project_id: int,
    body: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    await _get_user_project(proj_repo, project_id, user.id)

    ch_repo = ChapterRepository(db)
    next_num, next_ord = await ch_repo.get_next_numbers(project_id)

    word_count = calculate_word_count(body.content) if body.content else 0

    chapter = Chapter(
        project_id=project_id,
        title=body.title,
        content=body.content,
        outline=body.outline,
        status=body.status,
        word_count=word_count,
        chapter_number=next_num,
        order_index=next_ord,
    )
    await ch_repo.create(chapter)
    await db.commit()
    await db.refresh(chapter)
    await ch_repo.update_project_stats(project_id)
    await db.commit()
    return chapter


@router.get(
    "/api/v1/projects/{project_id}/chapters",
    response_model=List[ChapterResponse],
)
async def list_chapters(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    await _get_user_project(proj_repo, project_id, user.id)

    ch_repo = ChapterRepository(db)
    return await ch_repo.get_by_project(project_id)


@router.get("/api/v1/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    ch_repo = ChapterRepository(db)
    chapter = await ch_repo.get_with_owner_check(chapter_id, user.id)
    if not chapter:
        raise NotFoundError("章节不存在或无权访问")
    return chapter


@router.put("/api/v1/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    body: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    ch_repo = ChapterRepository(db)
    chapter = await ch_repo.get_with_owner_check(chapter_id, user.id)
    if not chapter:
        raise NotFoundError("章节不存在或无权访问")

    data = body.model_dump(exclude_unset=True)
    if "content" in data and data["content"] is not None:
        data["word_count"] = calculate_word_count(data["content"])

    for key, value in data.items():
        setattr(chapter, key, value)

    await db.commit()
    await db.refresh(chapter)
    await ch_repo.update_project_stats(chapter.project_id)
    await db.commit()
    return chapter


@router.delete("/api/v1/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    ch_repo = ChapterRepository(db)
    chapter = await ch_repo.get_with_owner_check(chapter_id, user.id)
    if not chapter:
        raise NotFoundError("章节不存在或无权访问")

    project_id = chapter.project_id
    await db.delete(chapter)
    await db.commit()
    await ch_repo.update_project_stats(project_id)
    await db.commit()
    return {"message": f"章节 '{chapter.title}' 已成功删除"}


@router.get("/api/v1/projects/{project_id}/chapters/unpublished")
async def get_unpublished_chapters(
    project_id: int,
    current_chapter_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    await _get_user_project(proj_repo, project_id, user.id)

    ch_repo = ChapterRepository(db)
    chapters = await ch_repo.get_unpublished(project_id)

    return {
        "chapters": [
            {
                "id": ch.id,
                "title": ch.title,
                "chapter_number": ch.chapter_number,
                "content": ch.content[:200] + "..." if ch.content and len(ch.content) > 200 else ch.content,
                "updated_at": ch.updated_at,
                "is_current": ch.id == current_chapter_id,
            }
            for ch in chapters
        ]
    }


@router.post("/api/v1/chapters/batch_update_status")
async def batch_update_chapter_status(
    body: ChapterBatchUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    await _get_user_project(proj_repo, body.project_id, user.id)

    await db.execute(
        update(Chapter)
        .where(
            Chapter.project_id == body.project_id,
            Chapter.order_index >= body.from_order_index,
        )
        .values(status=body.new_status)
    )
    await db.commit()

    ch_repo = ChapterRepository(db)
    await ch_repo.update_project_stats(body.project_id)
    await db.commit()
    return {"message": "章节状态已批量更新"}


@router.post("/api/v1/chapters/batch-publish", response_model=BatchPublishResponse)
async def batch_publish_chapters(
    body: BatchPublishRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    await _get_user_project(proj_repo, body.project_id, user.id)

    ch_repo = ChapterRepository(db)
    published = []
    failed = []

    for cid in body.chapter_ids:
        chapter = await ch_repo.get_one_in_project(cid, body.project_id)
        if chapter and chapter.status == "draft":
            chapter.status = "published"
            await db.commit()
            await db.refresh(chapter)
            published.append({"id": chapter.id, "title": chapter.title, "published_at": chapter.updated_at})
        else:
            failed.append({"id": cid, "reason": "章节不存在或已发布"})

    await ch_repo.update_project_stats(body.project_id)
    await db.commit()

    return {
        "success": len(failed) == 0,
        "published_chapters": published,
        "failed_chapters": failed,
        "total_count": len(body.chapter_ids),
        "success_count": len(published),
    }
