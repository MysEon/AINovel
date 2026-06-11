"""项目管理 API v1"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.project_service import ProjectService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["项目管理"])


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ProjectService(db)
    return await service.create(body, user.id)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ProjectService(db)
    return await service.list_with_stats(user.id)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ProjectService(db)
    return await service.get_project(project_id, user.id)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ProjectService(db)
    return await service.update_project(project_id, user.id, body)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ProjectService(db)
    return await service.delete_project(project_id, user.id)
