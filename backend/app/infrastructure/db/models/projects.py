"""项目模型"""

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_count = Column(Integer, default=0)
    chapter_count = Column(Integer, default=0)

    # 关系
    owner = relationship("User", back_populates="projects")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="project", cascade="all, delete-orphan")
    organizations = relationship("Organization", back_populates="project", cascade="all, delete-orphan")
    worldviews = relationship("Worldview", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    drafts = relationship("Draft", back_populates="project", cascade="all, delete-orphan")
    entity_relationships = relationship("EntityRelationship", back_populates="project", cascade="all, delete-orphan")
    entity_state_events = relationship("EntityStateEvent", back_populates="project", cascade="all, delete-orphan")
    entity_change_proposals = relationship(
        "EntityChangeProposal",
        back_populates="project",
        cascade="all, delete-orphan",
    )
