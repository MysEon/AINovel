"""草稿管理 API v1"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.core.exceptions import NotFoundError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.manuscript import Draft
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.base import ProjectScopedRepository
from app.infrastructure.db.repositories.project import ProjectRepository
from app.infrastructure.db.session import get_db
from app.schemas.drafts import DraftCreate, DraftResponse, DraftUpdate

router = APIRouter(tags=["内容创作：草稿"])


class DraftRepository(ProjectScopedRepository[Draft]):
    model = Draft


async def _get_draft_with_owner_check(
    draft_id: int,
    user_id: int,
    db: AsyncSession,
) -> Draft:
    stmt = select(Draft).join(Project).where(Draft.id == draft_id, Project.user_id == user_id)
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()
    if not draft:
        raise NotFoundError("草稿不存在或无权访问")
    return draft


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
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或您没有权限访问")

    word_count = len(body.content) if body.content else 0
    draft = Draft(
        **body.model_dump(),
        project_id=project_id,
        word_count=word_count,
    )
    repo = DraftRepository(db)
    await repo.create(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.get(
    "/api/v1/projects/{project_id}/drafts",
    response_model=list[DraftResponse],
)
async def list_drafts(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或您没有权限访问")

    repo = DraftRepository(db)
    return await repo.get_by_project(project_id)


@router.get("/api/v1/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    return await _get_draft_with_owner_check(draft_id, user.id, db)


@router.put("/api/v1/drafts/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: int,
    body: DraftUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    draft = await _get_draft_with_owner_check(draft_id, user.id, db)

    data = body.model_dump(exclude_unset=True)
    if "content" in data and data["content"] is not None:
        data["word_count"] = len(data["content"])

    for key, value in data.items():
        setattr(draft, key, value)

    await db.commit()
    await db.refresh(draft)
    return draft


@router.delete("/api/v1/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    draft = await _get_draft_with_owner_check(draft_id, user.id, db)
    await db.delete(draft)
    await db.commit()
    return {"message": f"草稿 '{draft.title}' 已成功删除"}
