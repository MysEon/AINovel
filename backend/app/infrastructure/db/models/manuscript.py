"""章节与草稿模型"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class Chapter(Base, TimestampMixin):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text(1000000))
    outline = Column(Text(50000))
    chapter_number = Column(Integer, default=0)
    order_index = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

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
