"""提示词模板模型"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from app.infrastructure.db.base import Base, TimestampMixin


class PromptTemplate(Base, TimestampMixin):
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    template = Column(Text, nullable=False)
    description = Column(Text)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    variables = Column(Text)
    tags = Column(String(500))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
