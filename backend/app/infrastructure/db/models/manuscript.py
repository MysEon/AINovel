"""章节与草稿模型"""

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class Chapter(Base, TimestampMixin):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text)
    outline = Column(Text)
    chapter_number = Column(Integer, default=0)
    order_index = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # 分层摘要缓存——由 AIContextBuilder.get_tiered_chapter_context 写入
    # 失效规则：word_count != summary_source_word_count → 摘要过期需重新生成
    summary_detailed = Column(Text)  # L2 用：约 500 字详细概括
    summary_brief = Column(Text)  # L3 用：约 150 字简要概括
    summary_source_word_count = Column(Integer)  # 生成摘要时章节 word_count 快照

    project = relationship("Project", back_populates="chapters")


class Draft(Base, TimestampMixin):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text)
    tags = Column(String(500))
    word_count = Column(Integer, default=0)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="drafts")
