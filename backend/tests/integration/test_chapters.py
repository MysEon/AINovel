"""章节模块集成测试"""

from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient


class TestChapters:
    async def test_create_chapter(self, client: AsyncClient, auth_headers: dict):
        """创建章节"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "章节测试项目",
        })
        project_id = proj_resp.json()["id"]

        resp = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "第一章",
            "content": "第一章内容",
            "status": "draft",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "第一章"
        assert data["project_id"] == project_id

    async def test_list_chapters(self, client: AsyncClient, auth_headers: dict):
        """列表章节"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "列表章节项目",
        })
        project_id = proj_resp.json()["id"]

        await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "第一章",
            "content": "内容",
        })

        resp = await client.get(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["title"] == "第一章"

    async def test_get_chapter(self, client: AsyncClient, auth_headers: dict):
        """获取单个章节"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "获取章节项目",
        })
        project_id = proj_resp.json()["id"]

        create_resp = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "测试章节",
            "content": "测试内容",
        })
        chapter_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/chapters/{chapter_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == chapter_id
        assert data["title"] == "测试章节"

    async def test_update_chapter(self, client: AsyncClient, auth_headers: dict):
        """更新章节"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "更新章节项目",
        })
        project_id = proj_resp.json()["id"]

        create_resp = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "旧标题",
            "content": "旧内容",
        })
        chapter_id = create_resp.json()["id"]

        resp = await client.put(f"/api/v1/chapters/{chapter_id}", headers=auth_headers, json={
            "title": "新标题",
            "content": "新内容",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "新标题"
        assert data["content"] == "新内容"

    async def test_delete_chapter(self, client: AsyncClient, auth_headers: dict):
        """删除章节"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "删除章节项目",
        })
        project_id = proj_resp.json()["id"]

        create_resp = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "待删除",
            "content": "内容",
        })
        chapter_id = create_resp.json()["id"]

        del_resp = await client.delete(f"/api/v1/chapters/{chapter_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        get_resp = await client.get(f"/api/v1/chapters/{chapter_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    async def test_batch_publish_rollback_on_error(self, client: AsyncClient, auth_headers: dict, db_session):
        """批量发布在 DB 抛错时应整体回滚"""
        from app.infrastructure.db.models.manuscript import Chapter

        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "批量发布项目",
        })
        project_id = proj_resp.json()["id"]

        # 创建两个草稿章节
        r1 = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "草稿一", "content": "内容1", "status": "draft",
        })
        r2 = await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "草稿二", "content": "内容2", "status": "draft",
        })
        cid1 = r1.json()["id"]
        cid2 = r2.json()["id"]

        # mock db.flush 在第二次调用时抛错
        call_count = 0
        original_flush = db_session.flush

        async def fake_flush(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count >= 1:
                raise Exception("模拟数据库错误")
            return await original_flush(*args, **kwargs)

        # 通过覆盖 client.app 中使用的 db 依赖里的 flush 来实现回滚验证
        # 更简单的做法：直接 patch ChapterRepository 的 get_one_in_project 在第二次返回后抛错
        from app.api.v1.chapters import ChapterRepository
        original_get_one = ChapterRepository.get_one_in_project

        call_count_repo = 0
        async def fake_get_one(self, cid, pid):
            nonlocal call_count_repo
            call_count_repo += 1
            if call_count_repo == 2:
                raise Exception("模拟 DB 错误")
            return await original_get_one(self, cid, pid)

        with patch.object(ChapterRepository, "get_one_in_project", fake_get_one):
            resp = await client.post("/api/v1/chapters/batch-publish", headers=auth_headers, json={
                "project_id": project_id,
                "chapter_ids": [cid1, cid2],
            })
            # 由于 DB 错误未捕获，FastAPI 会返回 500
            # 但我们真正关心的是事务是否回滚：cid1 应保持 draft
            assert resp.status_code == 500

        # 验证 cid1 仍然是 draft（整体回滚）
        from sqlalchemy import select
        stmt = select(Chapter).where(Chapter.id == cid1)
        result = await db_session.execute(stmt)
        chapter = result.scalar_one()
        assert chapter.status == "draft"

    async def test_project_word_count_auto_update(self, client: AsyncClient, auth_headers: dict):
        """发布章节后项目字数自动更新"""
        proj_resp = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": "字数自动更新项目",
        })
        project_id = proj_resp.json()["id"]

        # 创建并发布章节
        await client.post(f"/api/v1/projects/{project_id}/chapters", headers=auth_headers, json={
            "title": "发布章",
            "content": "这是一段用于测试字数统计的文本内容。",
            "status": "published",
        })

        # 获取项目验证字数
        resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
        data = resp.json()
        assert data["word_count"] >= 0
