"""
小说章节相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Chapter
from schemas import ChapterCreate, ChapterUpdate, ChapterResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["内容创作：章节"],
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

@router.post("/api/projects/{project_id}/chapters", response_model=ChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_chapter(
    project_id: int,
    chapter_data: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新章节"""
    await get_project_for_user(project_id, db, current_user)
    
    # 自动计算字数
    word_count = len(chapter_data.content) if chapter_data.content else 0
    
    new_chapter = Chapter(
        **chapter_data.model_dump(),
        project_id=project_id,
        word_count=word_count
    )
    db.add(new_chapter)
    await db.commit()
    await db.refresh(new_chapter)
    return new_chapter

@router.get("/api/projects/{project_id}/chapters", response_model=List[ChapterResponse])
async def get_chapters_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有章节列表 (按顺序)"""
    await get_project_for_user(project_id, db, current_user)
    
    result = await db.execute(
        select(Chapter).where(Chapter.project_id == project_id).order_by(Chapter.order_index)
    )
    chapters = result.scalars().all()
    return chapters

@router.get("/api/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个章节的详细信息"""
    result = await db.execute(
        select(Chapter).join(Project).where(
            Chapter.id == chapter_id,
            Project.user_id == current_user.id
        )
    )
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在或无权访问")
    return chapter

@router.put("/api/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    chapter_data: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新章节信息"""
    chapter = await get_chapter(chapter_id, db, current_user)
    
    update_data = chapter_data.model_dump(exclude_unset=True)
    
    # 如果内容更新，重新计算字数
    if 'content' in update_data and update_data['content'] is not None:
        update_data['word_count'] = len(update_data['content'])

    for key, value in update_data.items():
        setattr(chapter, key, value)
        
    await db.commit()
    await db.refresh(chapter)
    return chapter

@router.delete("/api/chapters/{chapter_id}", response_model=MessageResponse)
async def delete_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个章节"""
    chapter = await get_chapter(chapter_id, db, current_user)
    
    await db.delete(chapter)
    await db.commit()
    
    return {"message": f"章节 '{chapter.title}' 已成功删除"}
