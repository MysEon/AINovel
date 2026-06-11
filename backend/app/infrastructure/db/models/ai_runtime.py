"""AI Runtime 模型：工作流、会话、运行、事件、生成内容"""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
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
    run_id = Column(Integer, ForeignKey("ai_runs.id"), nullable=True)


class AIRun(Base, TimestampMixin):
    """一次图运行实例（对应 LangGraph 的一次 invoke/stream）"""

    __tablename__ = "ai_runs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("langgraph_sessions.id"), nullable=False)
    workflow_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    input_data = Column(Text)
    output_data = Column(Text)
    error_message = Column(Text)
    tokens_used = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    session = relationship("LangGraphSession", backref="runs")
    events = relationship("AIRunEvent", back_populates="run", cascade="all, delete-orphan")
    artifacts = relationship("AIGeneratedContent", backref="run")


class AIRunEvent(Base):
    """运行过程中的事件记录（节点开始/结束、token、错误等）"""

    __tablename__ = "ai_run_events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("ai_runs.id"), nullable=False, index=True)
    event_type = Column(String(30), nullable=False)
    node_name = Column(String(100), nullable=True)
    data = Column(Text)
    sequence = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    run = relationship("AIRun", back_populates="events")
