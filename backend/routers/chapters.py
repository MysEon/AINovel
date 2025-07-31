"""
小说章节相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sql_func
from typing import List

from database import get_db
from models import User, Project, Chapter
from schemas import ChapterCreate, ChapterUpdate, ChapterResponse, MessageResponse
from .auth import get_current_user_dependency

async def update_project_stats(project_id: int, db: AsyncSession):
    """更新项目的统计数据：总字数和总章节数"""
    # 计算已发布章节的总字数
    word_count_result = await db.execute(
        select(sql_func.sum(Chapter.word_count)).where(
            Chapter.project_id == project_id,
            Chapter.status == 'published'
        )
    )
    total_words = word_count_result.scalar_one_or_none() or 0

    # 计算已发布章节的总数
    chapter_count_result = await db.execute(
        select(sql_func.count(Chapter.id)).where(
            Chapter.project_id == project_id,
            Chapter.status == 'published'
        )
    )
    total_chapters = chapter_count_result.scalar_one_or_none() or 0

    # 更新项目表
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    
    if project:
        project.word_count = total_words
        project.chapter_count = total_chapters
        project.updated_at = sql_func.now()
        await db.commit()

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
    
    word_count = len(chapter_data.content) if chapter_data.content else 0
    
    chapter_dict = chapter_data.model_dump()
    chapter_dict['project_id'] = project_id
    chapter_dict['word_count'] = word_count
    
    new_chapter = Chapter(**chapter_dict)
    db.add(new_chapter)
    await db.commit()
    await db.refresh(new_chapter)
    await update_project_stats(project_id, db)
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
    
    if 'content' in update_data and update_data['content'] is not None:
        update_data['word_count'] = len(update_data['content'])

    for key, value in update_data.items():
        setattr(chapter, key, value)
        
    await db.commit()
    await db.refresh(chapter)
    await update_project_stats(chapter.project_id, db)
    return chapter

@router.delete("/api/chapters/{chapter_id}", response_model=MessageResponse)
async def delete_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个章节"""
    chapter = await get_chapter(chapter_id, db, current_user)
    project_id = chapter.project_id
    
    await db.delete(chapter)
    await db.commit()
    await update_project_stats(project_id, db)
    
    return {"message": f"章节 '{chapter.title}' 已成功删除"}
