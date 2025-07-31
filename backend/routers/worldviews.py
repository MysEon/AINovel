"""
小说世界观相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Worldview
from schemas import WorldviewCreate, WorldviewUpdate, WorldviewResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["小说元素：世界观"],
    dependencies=[Depends(get_current_user_dependency)]
)

async def get_project_for_user(project_id: int, db: AsyncSession, user: User) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在或您没有权限访问"
        )
    return project

@router.post("/api/projects/{project_id}/worldviews", response_model=WorldviewResponse, status_code=status.HTTP_201_CREATED)
async def create_worldview(
    project_id: int,
    worldview_data: WorldviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新世界观"""
    await get_project_for_user(project_id, db, current_user)
    
    new_worldview = Worldview(
        **worldview_data.model_dump(),
        project_id=project_id
    )
    db.add(new_worldview)
    await db.commit()
    await db.refresh(new_worldview)
    return new_worldview

@router.get("/api/projects/{project_id}/worldviews", response_model=List[WorldviewResponse])
async def get_worldviews_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有世界观列表"""
    await get_project_for_user(project_id, db, current_user)
    
    result = await db.execute(
        select(Worldview).where(Worldview.project_id == project_id).order_by(Worldview.name)
    )
    worldviews = result.scalars().all()
    return worldviews

@router.get("/api/worldviews/{worldview_id}", response_model=WorldviewResponse)
async def get_worldview(
    worldview_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个世界观的详细信息"""
    result = await db.execute(
        select(Worldview).join(Project).where(
            Worldview.id == worldview_id,
            Project.user_id == current_user.id
        )
    )
    worldview = result.scalar_one_or_none()
    
    if not worldview:
        raise HTTPException(status_code=404, detail="世界观不存在或无权访问")
    return worldview

@router.put("/api/worldviews/{worldview_id}", response_model=WorldviewResponse)
async def update_worldview(
    worldview_id: int,
    worldview_data: WorldviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新世界观信息"""
    worldview = await get_worldview(worldview_id, db, current_user)
    
    update_data = worldview_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(worldview, key, value)
        
    await db.commit()
    await db.refresh(worldview)
    return worldview

@router.delete("/api/worldviews/{worldview_id}", response_model=MessageResponse)
async def delete_worldview(
    worldview_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个世界观"""
    worldview = await get_worldview(worldview_id, db, current_user)
    
    await db.delete(worldview)
    await db.commit()
    
    return {"message": f"世界观 '{worldview.name}' 已成功删除"}
