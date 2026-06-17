"""ChapterService 单元测试"""

from unittest.mock import AsyncMock, patch

import pytest

from app.application.chapter_service import ChapterService
from app.application.knowledge_graph_service import KnowledgeGraphService
from app.application.project_service import ProjectService
from app.core.exceptions import NotFoundError
from app.schemas.chapters import BatchPublishRequest, ChapterBatchUpdate, ChapterCreate, ChapterUpdate
from app.schemas.projects import ProjectCreate


class TestChapterService:
    async def _create_project(self, db_session, user_id, name="测试项目"):
        proj_service = ProjectService(db_session)
        return await proj_service.create(ProjectCreate(name=name), user_id)

    async def test_create_chapter(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        body = ChapterCreate(title="第一章", content="内容", status="draft")
        chapter = await service.create_chapter(project.id, test_user.id, body)
        assert chapter.title == "第一章"
        assert chapter.project_id == project.id

    async def test_update_chapter(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        chapter = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="旧", content="旧内容"))
        updated = await service.update_chapter(chapter.id, test_user.id, ChapterUpdate(title="新", content="新内容"))
        assert updated.title == "新"
        assert updated.content == "新内容"

    async def test_delete_chapter(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        chapter = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="待删"))
        result = await service.delete_chapter(chapter.id, test_user.id)
        assert "待删" in result["message"]
        with pytest.raises(NotFoundError):
            await service.get_chapter(chapter.id, test_user.id)

    async def test_get_chapter_not_found(self, db_session, test_user):
        service = ChapterService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_chapter(99999, test_user.id)

    async def test_list_chapters(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        await service.create_chapter(project.id, test_user.id, ChapterCreate(title="章1"))
        chapters = await service.list_chapters(project.id, test_user.id)
        assert len(chapters) >= 1

    async def test_batch_publish(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        ch1 = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿1", status="draft"))
        ch2 = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿2", status="draft"))
        result = await service.batch_publish(
            project.id, test_user.id, BatchPublishRequest(project_id=project.id, chapter_ids=[ch1.id, ch2.id])
        )
        assert result["success"] is True
        assert result["success_count"] == 2

    async def test_batch_update_status(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        ch = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿", status="draft"))
        result = await service.batch_update_status(
            project.id,
            test_user.id,
            ChapterBatchUpdate(project_id=project.id, from_order_index=ch.order_index, new_status="published"),
        )
        assert "已批量更新" in result["message"]

    async def test_create_chapter_with_published_status_triggers_analysis(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        with patch.object(KnowledgeGraphService, "submit_chapter_analysis", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = 42
            chapter = await service.create_chapter(
                project.id, test_user.id, ChapterCreate(title="已发布", content="内容", status="published")
            )
            assert chapter.status == "published"
            mock_submit.assert_awaited_once()
            assert mock_submit.await_args.args[1] == chapter.id

    async def test_update_chapter_to_published_triggers_analysis(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        chapter = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿", status="draft"))
        with patch.object(KnowledgeGraphService, "submit_chapter_analysis", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = 42
            updated = await service.update_chapter(chapter.id, test_user.id, ChapterUpdate(status="published"))
            assert updated.status == "published"
            mock_submit.assert_awaited_once()

    async def test_update_chapter_already_published_does_not_trigger_analysis(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        chapter = await service.create_chapter(
            project.id, test_user.id, ChapterCreate(title="已发布", content="内容", status="published")
        )
        with patch.object(KnowledgeGraphService, "submit_chapter_analysis", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = 42
            updated = await service.update_chapter(chapter.id, test_user.id, ChapterUpdate(title="改名"))
            assert updated.title == "改名"
            mock_submit.assert_not_awaited()

    async def test_batch_publish_triggers_analysis(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        service = ChapterService(db_session)
        ch1 = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿1", status="draft"))
        ch2 = await service.create_chapter(project.id, test_user.id, ChapterCreate(title="草稿2", status="draft"))
        with patch.object(KnowledgeGraphService, "submit_chapter_analysis", new_callable=AsyncMock) as mock_submit:
            mock_submit.return_value = 42
            result = await service.batch_publish(
                project.id, test_user.id, BatchPublishRequest(project_id=project.id, chapter_ids=[ch1.id, ch2.id])
            )
            assert result["success"] is True
            assert result["success_count"] == 2
            assert mock_submit.await_count == 2
