"""模型配置"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from app.infrastructure.db.base import Base, TimestampMixin


class ModelConfig(Base, TimestampMixin):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)
    api_key = Column(String(500))
    model_name = Column(String(100))
    temperature = Column(String(10), default="0.7")
    max_tokens = Column(Integer, default=2000)
    api_url = Column(String(500))
    top_p = Column(String(10), default="1.0")
    top_k = Column(Integer, default=40)
    frequency_penalty = Column(String(10), default="0.0")
    presence_penalty = Column(String(10), default="0.0")
    stop_sequences = Column(Text)
    stream = Column(Boolean, default=False)
    logprobs = Column(Boolean, default=False)
    top_logprobs = Column(Integer, default=0)
    proxy_url = Column(String(500), nullable=True)
    enable_proxy = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
