"""
小说章节相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sql_func, update
from typing import List, Optional
import re

from database import get_db
from models import User, Project, Chapter
from schemas import ChapterCreate, ChapterUpdate, ChapterResponse, MessageResponse, ChapterBatchUpdate, BatchPublishRequest, BatchPublishResponse
from .auth import get_current_user_dependency

def calculate_word_count(content: str) -> int:
    """
    计算内容的字数（支持中英文混合）
    - 中文：按字符计算
    - 英文：按单词计算
    """
    if not content:
        return 0
    
    # 移除多余的空白字符
    content = re.sub(r'\s+', ' ', content.strip())
    
    # 计算中文字符数（包括中文标点）
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', content))
    
    # 计算英文单词数
    english_words = len(re.findall(r'\b[a-zA-Z]+\b', content))
    
    return chinese_chars + english_words

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
    
    # 获取项目中最大的章节编号
    max_chapter_result = await db.execute(
        select(sql_func.max(Chapter.chapter_number)).where(Chapter.project_id == project_id)
    )
    max_chapter_number = max_chapter_result.scalar_one_or_none() or 0
    
    # 获取项目中最大的order_index
    max_order_result = await db.execute(
        select(sql_func.max(Chapter.order_index)).where(Chapter.project_id == project_id)
    )
    max_order_index = max_order_result.scalar_one_or_none() or 0
    
    # 验证内容大小
    if chapter_data.content and len(chapter_data.content) > 1000000:  # 1MB限制
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="章节内容不能超过1MB"
        )
    
    word_count = calculate_word_count(chapter_data.content) if chapter_data.content else 0
    
    chapter_dict = chapter_data.model_dump()
    chapter_dict['project_id'] = project_id
    chapter_dict['word_count'] = word_count
    chapter_dict['chapter_number'] = max_chapter_number + 1
    chapter_dict['order_index'] = max_order_index + 1
    
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
        # 验证内容大小
        if len(update_data['content']) > 1000000:  # 1MB限制
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="章节内容不能超过1MB"
            )
        update_data['word_count'] = calculate_word_count(update_data['content'])

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

@router.get("/api/projects/{project_id}/chapters/unpublished")
async def get_unpublished_chapters(
    project_id: int,
    current_chapter_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取项目中所有未发布的章节列表"""
    # 验证项目权限
    project = await get_project_for_user(project_id, db, current_user)
    
    # 获取未发布章节
    query = select(Chapter).where(
        Chapter.project_id == project_id,
        Chapter.status == 'draft'
    ).order_by(Chapter.order_index)
    
    result = await db.execute(query)
    chapters = result.scalars().all()
    
    return {
        "chapters": [
            {
                "id": chapter.id,
                "title": chapter.title,
                "chapter_number": chapter.chapter_number,
                "content": chapter.content[:200] + "..." if len(chapter.content) > 200 else chapter.content,
                "updated_at": chapter.updated_at,
                "is_current": chapter.id == current_chapter_id
            }
            for chapter in chapters
        ]
    }

@router.post("/api/chapters/batch_update_status", response_model=MessageResponse)
async def batch_update_chapter_status(
    update_data: ChapterBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    批量更新章节的状态
    """
    # 验证项目所有权
    project_result = await db.execute(
        select(Project).where(Project.id == update_data.project_id, Project.user_id == current_user.id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=403, detail="无权操作该项目")

    # 更新指定章节及之后所有章节的状态
    await db.execute(
        update(Chapter)
        .where(Chapter.project_id == update_data.project_id)
        .where(Chapter.order_index >= update_data.from_order_index)
        .values(status=update_data.new_status)
    )
    await db.commit()
    await update_project_stats(update_data.project_id, db)
    
    return {"message": "章节状态已批量更新"}

@router.post("/api/chapters/batch-publish", response_model=BatchPublishResponse)
async def batch_publish_chapters(
    request: BatchPublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """批量发布章节"""
    # 验证项目权限
    project = await get_project_for_user(request.project_id, db, current_user)
    
    published_chapters = []
    failed_chapters = []
    
    # 批量处理章节发布
    for chapter_id in request.chapter_ids:
        try:
            chapter_result = await db.execute(
                select(Chapter).where(
                    Chapter.id == chapter_id,
                    Chapter.project_id == request.project_id,
                    Chapter.status == 'draft'
                )
            )
            chapter = chapter_result.scalar_one_or_none()
            
            if chapter:
                chapter.status = 'published'
                await db.commit()
                await db.refresh(chapter)
                
                published_chapters.append({
                    "id": chapter.id,
                    "title": chapter.title,
                    "published_at": chapter.updated_at
                })
            else:
                failed_chapters.append({
                    "id": chapter_id,
                    "reason": "章节不存在或已发布"
                })
        except Exception as e:
            await db.rollback()
            failed_chapters.append({
                "id": chapter_id,
                "reason": str(e)
            })
    
    # 更新项目统计信息
    await update_project_stats(request.project_id, db)
    
    return {
        "success": len(failed_chapters) == 0,
        "published_chapters": published_chapters,
        "failed_chapters": failed_chapters,
        "total_count": len(request.chapter_ids),
        "success_count": len(published_chapters)
    }