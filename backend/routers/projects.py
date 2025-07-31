"""
项目管理相关的API路由
包括项目的创建、查询、更新、删除 (CRUD)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Chapter
from sqlalchemy import func, case
from schemas import ProjectCreate, ProjectUpdate, ProjectResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    prefix="/api/projects",
    tags=["项目管理"],
    dependencies=[Depends(get_current_user_dependency)] # 所有路由都需要认证
)

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    创建一个新项目
    """
    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        user_id=current_user.id
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return new_project

@router.get("/", response_model=List[ProjectResponse])
async def get_user_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    获取当前用户的所有项目列表,并计算统计信息
    """
    # 子查询计算每个项目的统计信息
    stats_sq = (
        select(
            Chapter.project_id,
            func.sum(Chapter.word_count).label("total_word_count"),
            func.count(Chapter.id).label("total_chapter_count"),
            func.max(Chapter.updated_at).label("last_updated_at")
        )
        .group_by(Chapter.project_id)
        .subquery()
    )

    # 主查询连接项目表和统计信息
    result = await db.execute(
        select(
            Project,
            stats_sq.c.total_word_count,
            stats_sq.c.total_chapter_count,
            stats_sq.c.last_updated_at
        )
        .outerjoin(stats_sq, Project.id == stats_sq.c.project_id)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )

    projects_with_stats = result.all()

    # 构建响应数据
    response_data = []
    for project, word_count, chapter_count, last_updated in projects_with_stats:
        updated_at = project.updated_at
        if last_updated and last_updated > updated_at:
            updated_at = last_updated
            
        project_response = ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            user_id=project.user_id,
            created_at=project.created_at,
            updated_at=updated_at,
            word_count=word_count or 0,
            chapter_count=chapter_count or 0
        )
        response_data.append(project_response)

    return response_data

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    获取单个项目的详细信息
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在或无权访问"
        )
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    更新项目信息
    """
    project = await get_project(project_id, db, current_user) # 复用查询和权限检查逻辑
    
    update_data = project_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
        
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    删除一个项目
    """
    project = await get_project(project_id, db, current_user) # 复用查询和权限检查逻辑
    
    await db.delete(project)
    await db.commit()
    
    return {"message": f"项目 '{project.name}' 已成功删除"}
