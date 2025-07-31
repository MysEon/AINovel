"""
数据库模型定义
使用SQLAlchemy ORM定义所有数据表结构
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class User(Base):
    """用户表"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    avatar_url = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")

class Project(Base):
    """项目表"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    owner = relationship("User", back_populates="projects")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="project", cascade="all, delete-orphan")
    organizations = relationship("Organization", back_populates="project", cascade="all, delete-orphan")
    worldviews = relationship("Worldview", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    drafts = relationship("Draft", back_populates="project", cascade="all, delete-orphan")

class Character(Base):
    """角色表"""
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    personality = Column(Text)  # 性格特点
    background = Column(Text)   # 背景故事
    appearance = Column(Text)   # 外貌描述
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="characters")

class Location(Base):
    """地点表"""
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    geography = Column(Text)    # 地理环境
    culture = Column(Text)      # 文化特色
    history = Column(Text)      # 历史背景
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="locations")

class Organization(Base):
    """组织表"""
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    structure = Column(Text)    # 组织结构
    purpose = Column(Text)      # 组织目的
    influence = Column(Text)    # 影响力范围
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="organizations")

class Worldview(Base):
    """世界观表"""
    __tablename__ = "worldviews"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    rules = Column(Text)        # 世界规则
    magic_system = Column(Text) # 魔法体系
    technology = Column(Text)   # 科技水平
    timeline = Column(Text)     # 时间线
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="worldviews")

class Chapter(Base):
    """章节表"""
    __tablename__ = "chapters"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text)
    outline = Column(Text)      # 章节大纲
    order_index = Column(Integer, default=0)  # 章节顺序
    word_count = Column(Integer, default=0)   # 字数统计
    status = Column(String(20), default="draft")  # draft, published
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="chapters")

class Draft(Base):
    """草稿表"""
    __tablename__ = "drafts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text)
    tags = Column(String(500))  # 标签，逗号分隔
    word_count = Column(Integer, default=0)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    project = relationship("Project", back_populates="drafts")

class ModelConfig(Base):
    """模型配置表"""
    __tablename__ = "model_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)  # openai, claude, etc
    api_key = Column(String(500))  # 加密存储
    model_name = Column(String(100))  # gpt-4, claude-3, etc
    temperature = Column(String(10), default="0.7")
    max_tokens = Column(Integer, default=2000)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class PromptTemplate(Base):
    """提示词模板表"""
    __tablename__ = "prompt_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50))  # character, plot, dialogue, etc
    template = Column(Text, nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())