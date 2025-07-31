"""
小说角色相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Character
from schemas import CharacterCreate, CharacterUpdate, CharacterResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["小说元素：角色"],
    dependencies=[Depends(get_current_user_dependency)]
)

# 辅助函数，用于验证项目所有权并获取项目
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

@router.post("/api/projects/{project_id}/characters", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
async def create_character(
    project_id: int,
    character_data: CharacterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新角色"""
    await get_project_for_user(project_id, db, current_user) # 验证项目所有权
    
    new_character = Character(
        **character_data.model_dump(),
        project_id=project_id
    )
    db.add(new_character)
    await db.commit()
    await db.refresh(new_character)
    return new_character

@router.get("/api/projects/{project_id}/characters", response_model=List[CharacterResponse])
async def get_characters_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有角色列表"""
    await get_project_for_user(project_id, db, current_user) # 验证项目所有权
    
    result = await db.execute(
        select(Character).where(Character.project_id == project_id).order_by(Character.name)
    )
    characters = result.scalars().all()
    return characters

@router.get("/api/characters/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个角色的详细信息"""
    result = await db.execute(
        select(Character).join(Project).where(
            Character.id == character_id,
            Project.user_id == current_user.id
        )
    )
    character = result.scalar_one_or_none()
    
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在或无权访问")
    return character

@router.put("/api/characters/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: int,
    character_data: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新角色信息"""
    character = await get_character(character_id, db, current_user) # 复用查询和权限检查
    
    update_data = character_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(character, key, value)
        
    await db.commit()
    await db.refresh(character)
    return character

@router.delete("/api/characters/{character_id}", response_model=MessageResponse)
async def delete_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个角色"""
    character = await get_character(character_id, db, current_user) # 复用查询和权限检查
    
    await db.delete(character)
    await db.commit()
    
    return {"message": f"角色 '{character.name}' 已成功删除"}
