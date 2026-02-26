"""AI Runtime 模型：工作流、会话、生成内容"""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class LangGraphWorkflow(Base, TimestampMixin):
    __tablename__ = "langgraph_workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    workflow_type = Column(String(50), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    model_config_id = Column(Integer, ForeignKey("model_configs.id"), nullable=False)
    status = Column(String(20), default="active")
    config_data = Column(Text)

    project = relationship("Project", backref="langgraph_workflows")
    model_config = relationship("ModelConfig")
    sessions = relationship("LangGraphSession", back_populates="workflow", cascade="all, delete-orphan")
    generated_contents = relationship("AIGeneratedContent", back_populates="workflow")


class LangGraphSession(Base, TimestampMixin):
    __tablename__ = "langgraph_sessions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("langgraph_workflows.id"), nullable=False)
    thread_id = Column(String(100), nullable=False, unique=True)
    session_data = Column(Text)
    messages_count = Column(Integer, default=0)

    workflow = relationship("LangGraphWorkflow", back_populates="sessions")
    generated_contents = relationship("AIGeneratedContent", back_populates="session")


class AIGeneratedContent(Base, TimestampMixin):
    __tablename__ = "ai_generated_content"

    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String(50), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    workflow_id = Column(Integer, ForeignKey("langgraph_workflows.id"), nullable=True)
    session_id = Column(Integer, ForeignKey("langgraph_sessions.id"), nullable=True)
    model_config_id = Column(Integer, ForeignKey("model_configs.id"), nullable=False)
    title = Column(String(200))
    content = Column(Text, nullable=False)
    content_metadata = Column(Text)
    word_count = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0)
    quality_score = Column(Float)
    user_feedback = Column(Text)
    is_approved = Column(Boolean, default=False)

    project = relationship("Project", backref="ai_contents")
    chapter = relationship("Chapter", backref="ai_contents")
    workflow = relationship("LangGraphWorkflow", back_populates="generated_contents")
    session = relationship("LangGraphSession", back_populates="generated_contents")
    model_config = relationship("ModelConfig")
