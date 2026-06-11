"""项目管理 API v1"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.core.exceptions import ConflictError, NotFoundError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.project import ProjectRepository
from app.infrastructure.db.session import get_db
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["项目管理"])


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    repo = ProjectRepository(db)
    if await repo.get_user_project_by_name(body.name, user.id):
        raise ConflictError("项目名称已存在，请使用其他名称")

    project = Project(name=body.name, description=body.description, user_id=user.id)
    await repo.create(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    repo = ProjectRepository(db)
    rows = await repo.get_with_stats(user.id)

    result = []
    for project, word_count, chapter_count in rows:
        resp = ProjectResponse.model_validate(project)
        resp.word_count = word_count or 0
        resp.chapter_count = chapter_count or 0
        result.append(resp)
    return result


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    repo = ProjectRepository(db)
    project = await repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    repo = ProjectRepository(db)
    project = await repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    repo = ProjectRepository(db)
    project = await repo.get_user_project(project_id, user.id)
    if not project:
        raise NotFoundError("项目不存在或无权访问")

    await db.delete(project)
    await db.commit()
    return {"message": f"项目 '{project.name}' 已成功删除"}
