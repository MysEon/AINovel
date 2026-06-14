"""AIContextBuilder.get_tiered_chapter_context 单元测试。"""

from app.application.ai_context_builder import (
    TIERED_TOTAL_CHAPTERS,
    AIContextBuilder,
    TieredChapterContext,
)
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.projects import Project
from app.schemas.legacy_ai import ChapterSummarySchema


class _FakeChatModel:
    """模拟 chat_model.with_structured_output().ainvoke()。

    每次调用都返回 stub 摘要：「<title> 摘要 <call_idx>」。
    可通过 fail_calls 集合让指定调用次序抛错（测试摘要生成失败被收集）。
    """

    def __init__(self, fail_calls: set[int] | None = None):
        self.fail_calls = fail_calls or set()
        self.call_count = 0
        self.structured_calls: list = []  # 记录传入的 schema

    def with_structured_output(self, schema, method=None):
        self.structured_calls.append((schema, method))
        outer = self

        class _Structured:
            async def ainvoke(self, _messages):
                outer.call_count += 1
                idx = outer.call_count
                if idx in outer.fail_calls:
                    raise RuntimeError(f"模拟第 {idx} 次摘要生成失败")
                return ChapterSummarySchema(summary=f"摘要-{idx}-内容用来填字数" + "占" * 20)

        return _Structured()


async def _make_chapters(db_session, user_id: int, count: int) -> tuple[Project, list[Chapter]]:
    project = Project(name=f"分层项目{count}", description="x", user_id=user_id)
    db_session.add(project)
    await db_session.flush()

    chapters: list[Chapter] = []
    for i in range(count):
        ch = Chapter(
            project_id=project.id,
            title=f"第{i + 1}章",
            content=f"第{i + 1}章正文" * 50,  # ~250 字
            chapter_number=i + 1,
            word_count=250,
            status="draft",
        )
        db_session.add(ch)
        chapters.append(ch)
    await db_session.commit()
    for ch in chapters:
        await db_session.refresh(ch)
    return project, chapters


class TestGetTieredChapterContext:
    async def test_only_one_chapter_returns_l1_only(self, db_session, test_user):
        """1 章场景：只 L1，没有 L2/L3。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 1)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()

        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[0].id,
            chat_model=chat_model,
        )

        assert result.l1.id == chapters[0].id
        assert result.l2 == []
        assert result.l3 == []
        assert chat_model.call_count == 0  # 没有 L2/L3 → 不需要生成摘要
        assert result.summary_errors == []

    async def test_four_chapters_l1_plus_three_l2(self, db_session, test_user):
        """4 章在第 4 章写 → L1=4, L2=[1,2,3], L3=[]。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 4)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()

        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model,
        )

        assert result.l1.chapter_number == 4
        assert [ch.chapter_number for ch in result.l2] == [1, 2, 3]
        assert result.l3 == []
        assert chat_model.call_count == 3  # 三章详细摘要并发生成
        # 摘要落库
        for ch in result.l2:
            assert ch.summary_detailed is not None
            assert ch.summary_source_word_count == ch.word_count

    async def test_fifteen_chapters_at_15_l1_l2_l3(self, db_session, test_user):
        """15 章在第 15 章写 → L1=15, L2=[12,13,14], L3=[5,6,7,8,9,10,11] 截到 6 章 = [6..11]。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 15)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()

        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[14].id,
            chat_model=chat_model,
        )

        assert result.l1.chapter_number == 15
        assert [ch.chapter_number for ch in result.l2] == [12, 13, 14]
        assert [ch.chapter_number for ch in result.l3] == [6, 7, 8, 9, 10, 11]
        assert len(result.l2) + len(result.l3) + 1 == TIERED_TOTAL_CHAPTERS
        assert chat_model.call_count == 9  # 3 详细 + 6 简要

    async def test_hundred_chapters_at_100_l1_l2_l3(self, db_session, test_user):
        """100 章在第 100 章写 → 远古章节（≤ 90）不进 prompt。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 100)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()

        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[99].id,
            chat_model=chat_model,
        )

        assert result.l1.chapter_number == 100
        assert [ch.chapter_number for ch in result.l2] == [97, 98, 99]
        assert [ch.chapter_number for ch in result.l3] == [91, 92, 93, 94, 95, 96]
        # 第 90 章及更早不在结果里
        all_returned = {result.l1.chapter_number, *(ch.chapter_number for ch in result.l2), *(ch.chapter_number for ch in result.l3)}
        assert min(all_returned) == 91

    async def test_word_count_invalidation_triggers_regeneration(self, db_session, test_user):
        """章节 word_count 变了 → summary_source_word_count 不匹配 → 重新生成。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 4)
        builder = AIContextBuilder(db_session)
        chat_model_first = _FakeChatModel()

        # 第一次生成
        await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model_first,
        )
        assert chat_model_first.call_count == 3

        # 修改章节 1 的内容（模拟用户编辑），word_count 变化
        chapters[0].content = "改后的内容" * 100
        chapters[0].word_count = 500
        await db_session.commit()

        # 第二次：只有 chapter[0] 摘要过期，应该只调 1 次 LLM
        chat_model_second = _FakeChatModel()
        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model_second,
        )
        assert chat_model_second.call_count == 1
        # 其它 2 章保留原摘要
        assert all(ch.summary_detailed is not None for ch in result.l2)

    async def test_summary_permanent_cache_no_regeneration_on_second_call(self, db_session, test_user):
        """word_count 不变 → 第二次完全不调 LLM（永久缓存）。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 4)
        builder = AIContextBuilder(db_session)
        chat_model_first = _FakeChatModel()
        await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model_first,
        )

        # 第二次同样 chapter，未修改
        chat_model_second = _FakeChatModel()
        await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model_second,
        )
        assert chat_model_second.call_count == 0

    async def test_summary_generation_failure_collected_not_fatal(self, db_session, test_user):
        """单章摘要 LLM 失败 → 收集到 summary_errors，不抛错；其它章正常。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 4)
        builder = AIContextBuilder(db_session)
        # 模拟第 2 次调用失败（3 章并发顺序不严格保证，只保证至少 1 个失败被收集）
        chat_model = _FakeChatModel(fail_calls={2})

        result = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model,
        )

        # 主流程没炸
        assert result.l1.chapter_number == 4
        assert len(result.l2) == 3
        # 至少 1 个失败被收集
        assert len(result.summary_errors) >= 1
        # 至少有 1 章成功生成（其它章保持 None 或旧摘要）
        successful = [ch for ch in result.l2 if ch.summary_detailed]
        assert len(successful) >= 1

    async def test_render_segment_includes_l1_full_l2_l3(self, db_session, test_user):
        """render_tiered_chapter_segment 默认形态：L1 全文 + L2 详细 + L3 简要。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 15)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()
        tiered = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[14].id,
            chat_model=chat_model,
        )

        text = AIContextBuilder.render_tiered_chapter_segment(tiered)
        assert "【小说前情简述】" in text
        assert "【近期章节回顾】" in text
        assert "【当前章节正在写的内容（第15章" in text
        # L1 没截断
        assert "前文" not in text or "已省略" not in text
        # 当前章节正文出现在段中
        assert chapters[14].content in text

    async def test_render_segment_l1_tail_truncation(self, db_session, test_user):
        """l1_tail_chars 模式：L1 取末尾 N 字 + 占位符。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 4)
        # 把当前章塞成 5 万字
        chapters[3].content = "x" * 50000
        chapters[3].word_count = 50000
        await db_session.commit()
        await db_session.refresh(chapters[3])

        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()
        tiered = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[3].id,
            chat_model=chat_model,
        )

        text = AIContextBuilder.render_tiered_chapter_segment(tiered, l1_tail_chars=10000)
        assert "已省略" in text
        # L1 部分长度大致 = 占位符 + 10000
        assert "x" * 10000 in text  # 末尾 10000 字 'x' 都在
        assert "x" * 11000 not in text  # 不会保留更多

    async def test_render_segment_drops_l2_when_include_l2_false(self, db_session, test_user):
        """include_l2=False（最严降级）：L2 段不出现，L3 仍出现。"""
        project, chapters = await _make_chapters(db_session, test_user.id, 15)
        builder = AIContextBuilder(db_session)
        chat_model = _FakeChatModel()
        tiered = await builder.get_tiered_chapter_context(
            project_id=project.id,
            current_chapter_id=chapters[14].id,
            chat_model=chat_model,
        )

        text = AIContextBuilder.render_tiered_chapter_segment(
            tiered, l1_tail_chars=5000, include_l2=False
        )
        assert "【近期章节回顾】" not in text
        assert "【小说前情简述】" in text
        assert "【当前章节正在写的内容" in text


class TestRenderTieredEmpty:
    """render_tiered_chapter_segment 边界场景。"""

    def test_empty_tiered_returns_empty_string(self):
        empty = TieredChapterContext(l1=None, l2=[], l3=[], summary_errors=[])
        assert AIContextBuilder.render_tiered_chapter_segment(empty) == ""
