"""
小说地点相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Location
from schemas import LocationCreate, LocationUpdate, LocationResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["小说元素：地点"],
    dependencies=[Depends(get_current_user_dependency)]
)

# 辅助函数，复用项目所有权验证逻辑
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

@router.post("/api/projects/{project_id}/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    project_id: int,
    location_data: LocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新地点"""
    await get_project_for_user(project_id, db, current_user) # 验证项目所有权
    
    new_location = Location(
        **location_data.model_dump(),
        project_id=project_id
    )
    db.add(new_location)
    await db.commit()
    await db.refresh(new_location)
    return new_location

@router.get("/api/projects/{project_id}/locations", response_model=List[LocationResponse])
async def get_locations_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有地点列表"""
    await get_project_for_user(project_id, db, current_user) # 验证项目所有权
    
    result = await db.execute(
        select(Location).where(Location.project_id == project_id).order_by(Location.name)
    )
    locations = result.scalars().all()
    return locations

@router.get("/api/locations/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个地点的详细信息"""
    result = await db.execute(
        select(Location).join(Project).where(
            Location.id == location_id,
            Project.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()
    
    if not location:
        raise HTTPException(status_code=404, detail="地点不存在或无权访问")
    return location

@router.put("/api/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: int,
    location_data: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新地点信息"""
    location = await get_location(location_id, db, current_user) # 复用查询和权限检查
    
    update_data = location_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(location, key, value)
        
    await db.commit()
    await db.refresh(location)
    return location

@router.delete("/api/locations/{location_id}", response_model=MessageResponse)
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个地点"""
    location = await get_location(location_id, db, current_user) # 复用查询和权限检查
    
    await db.delete(location)
    await db.commit()
    
    return {"message": f"地点 '{location.name}' 已成功删除"}
