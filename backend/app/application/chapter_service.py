"""章节 Application Service

职责：
- create / update / delete chapter，word_count 计算，next_number 分配
- batch_publish 事务编排（验证→状态变更→flush→stats 更新→异常回滚）
- project stats 重算（从 ChapterRepository 移出）
"""

import logging
from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.knowledge_graph_service import KnowledgeGraphService
from app.core.exceptions import NotFoundError
from app.domain.word_count import calculate_word_count

logger = logging.getLogger(__name__)
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.infrastructure.db.repositories.chapter import ChapterRepository
from app.schemas.chapters import (
    BatchPublishRequest,
    ChapterBatchUpdate,
    ChapterCreate,
    ChapterUpdate,
)

from .project_service import ProjectService


class ChapterService:
    """章节业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ch_repo = ChapterRepository(db)
        self.proj_service = ProjectService(db)

    async def create_chapter(
        self,
        project_id: int,
        user_id: int,
        body: ChapterCreate,
    ) -> Chapter:
        """创建章节并更新项目统计"""
        await self.proj_service.require_user_project(project_id, user_id)

        next_num, next_ord = await self.ch_repo.get_next_numbers(project_id)
        word_count = calculate_word_count(body.content) if body.content else 0

        chapter = Chapter(
            project_id=project_id,
            title=body.title,
            content=body.content,
            outline=body.outline,
            status=body.status,
            word_count=word_count,
            chapter_number=next_num,
            order_index=next_ord,
        )
        await self.ch_repo.create(chapter)
        await self.db.commit()
        await self.db.refresh(chapter)
        await self._update_project_stats(project_id)
        await self.db.commit()
        if body.status == "published":
            await self._trigger_chapter_analysis(chapter, user_id)
        return chapter

    async def update_chapter(
        self,
        chapter_id: int,
        user_id: int,
        body: ChapterUpdate,
    ) -> Chapter:
        """更新章节并重新计算字数与项目统计"""
        chapter = await self.ch_repo.get_with_owner_check(chapter_id, user_id)
        if not chapter:
            raise NotFoundError("章节不存在或无权访问")

        old_status = chapter.status
        data = body.model_dump(exclude_unset=True)
        if "content" in data and data["content"] is not None:
            data["word_count"] = calculate_word_count(data["content"])

        for key, value in data.items():
            setattr(chapter, key, value)

        await self.db.commit()
        await self.db.refresh(chapter)
        await self._update_project_stats(chapter.project_id)
        await self.db.commit()
        if old_status != "published" and chapter.status == "published":
            await self._trigger_chapter_analysis(chapter, user_id)
        return chapter

    async def delete_chapter(self, chapter_id: int, user_id: int) -> dict:
        """删除章节并更新项目统计"""
        chapter = await self.ch_repo.get_with_owner_check(chapter_id, user_id)
        if not chapter:
            raise NotFoundError("章节不存在或无权访问")

        project_id = chapter.project_id
        await self.db.delete(chapter)
        await self.db.commit()
        await self._update_project_stats(project_id)
        await self.db.commit()
        return {"message": f"章节 '{chapter.title}' 已成功删除"}

    async def list_chapters(self, project_id: int, user_id: int) -> Sequence[Chapter]:
        """列出项目下所有章节"""
        await self.proj_service.require_user_project(project_id, user_id)
        return await self.ch_repo.get_by_project(project_id)

    async def get_chapter(self, chapter_id: int, user_id: int) -> Chapter:
        """获取单章节并校验权限"""
        chapter = await self.ch_repo.get_with_owner_check(chapter_id, user_id)
        if not chapter:
            raise NotFoundError("章节不存在或无权访问")
        return chapter

    async def get_unpublished_chapters(
        self,
        project_id: int,
        user_id: int,
        current_chapter_id: int | None,
    ) -> dict:
        """获取未发布章节列表"""
        await self.proj_service.require_user_project(project_id, user_id)
        chapters = await self.ch_repo.get_unpublished(project_id)
        return {
            "chapters": [
                {
                    "id": ch.id,
                    "title": ch.title,
                    "chapter_number": ch.chapter_number,
                    "content": ch.content[:200] + "..." if ch.content and len(ch.content) > 200 else ch.content,
                    "updated_at": ch.updated_at,
                    "is_current": ch.id == current_chapter_id,
                }
                for ch in chapters
            ]
        }

    async def batch_update_status(
        self,
        project_id: int,
        user_id: int,
        body: ChapterBatchUpdate,
    ) -> dict:
        """批量更新章节状态并刷新项目统计"""
        await self.proj_service.require_user_project(project_id, user_id)

        await self.db.execute(
            update(Chapter)
            .where(
                Chapter.project_id == body.project_id,
                Chapter.order_index >= body.from_order_index,
            )
            .values(status=body.new_status)
        )
        await self.db.commit()
        await self._update_project_stats(body.project_id)
        await self.db.commit()
        return {"message": "章节状态已批量更新"}

    async def batch_publish(
        self,
        project_id: int,
        user_id: int,
        body: BatchPublishRequest,
    ) -> dict:
        """批量发布章节（事务编排）"""
        await self.proj_service.require_user_project(project_id, user_id)

        published: list[Chapter] = []
        failed: list[dict] = []

        try:
            for cid in body.chapter_ids:
                chapter = await self.ch_repo.get_one_in_project(cid, body.project_id)
                if chapter and chapter.status == "draft":
                    chapter.status = "published"
                    published.append(chapter)
                else:
                    failed.append({"id": cid, "reason": "章节不存在或已发布"})

            if published:
                await self.db.flush()
                await self._update_project_stats(body.project_id)

            await self.db.commit()
            for chapter in published:
                await self.db.refresh(chapter)
        except Exception:
            await self.db.rollback()
            raise

        for chapter in published:
            await self._trigger_chapter_analysis(chapter, user_id)

        return {
            "success": len(failed) == 0,
            "published_chapters": [{"id": ch.id, "title": ch.title, "published_at": ch.updated_at} for ch in published],
            "failed_chapters": failed,
            "total_count": len(body.chapter_ids),
            "success_count": len(published),
        }

    async def _update_project_stats(self, project_id: int) -> None:
        """更新项目的字数和章节统计（已发布）"""
        words = await self.db.execute(
            select(func.sum(Chapter.word_count)).where(
                Chapter.project_id == project_id,
                Chapter.status == "published",
            )
        )
        count = await self.db.execute(
            select(func.count(Chapter.id)).where(
                Chapter.project_id == project_id,
                Chapter.status == "published",
            )
        )
        project = await self.db.get(Project, project_id)
        if project:
            project.word_count = words.scalar_one_or_none() or 0
            project.chapter_count = count.scalar_one_or_none() or 0

    async def _trigger_chapter_analysis(self, chapter: Chapter, user_id: int) -> None:
        """章节发布后触发异步知识分析（不阻塞响应）"""
        try:
            kg_service = KnowledgeGraphService(self.db)
            run_id = await kg_service.submit_chapter_analysis(chapter.project_id, chapter.id, user_id)
            if run_id is not None:
                await self.db.commit()
        except Exception:
            logger.exception("Failed to trigger chapter analysis for chapter %s", chapter.id)
