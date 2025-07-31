"""
小说草稿相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Draft
from schemas import DraftCreate, DraftUpdate, DraftResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["内容创作：草稿"],
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

@router.post("/api/projects/{project_id}/drafts", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
async def create_draft(
    project_id: int,
    draft_data: DraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新草稿"""
    await get_project_for_user(project_id, db, current_user)
    
    word_count = len(draft_data.content) if draft_data.content else 0
    
    new_draft = Draft(
        **draft_data.model_dump(),
        project_id=project_id,
        word_count=word_count
    )
    db.add(new_draft)
    await db.commit()
    await db.refresh(new_draft)
    return new_draft

@router.get("/api/projects/{project_id}/drafts", response_model=List[DraftResponse])
async def get_drafts_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有草稿列表"""
    await get_project_for_user(project_id, db, current_user)
    
    result = await db.execute(
        select(Draft).where(Draft.project_id == project_id).order_by(Draft.updated_at.desc())
    )
    drafts = result.scalars().all()
    return drafts

@router.get("/api/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个草稿的详细信息"""
    result = await db.execute(
        select(Draft).join(Project).where(
            Draft.id == draft_id,
            Project.user_id == current_user.id
        )
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="草稿不存在或无权访问")
    return draft

@router.put("/api/drafts/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: int,
    draft_data: DraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新草稿信息"""
    draft = await get_draft(draft_id, db, current_user)
    
    update_data = draft_data.model_dump(exclude_unset=True)
    
    if 'content' in update_data and update_data['content'] is not None:
        update_data['word_count'] = len(update_data['content'])

    for key, value in update_data.items():
        setattr(draft, key, value)
        
    await db.commit()
    await db.refresh(draft)
    return draft

@router.delete("/api/drafts/{draft_id}", response_model=MessageResponse)
async def delete_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个草稿"""
    draft = await get_draft(draft_id, db, current_user)
    
    await db.delete(draft)
    await db.commit()
    
    return {"message": f"草稿 '{draft.title}' 已成功删除"}
