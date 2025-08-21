"""
知识库模型扩展
为四个知识库模块添加新的数据模型
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .models import Base

# === 角色关系表 ===

character_relations = Table(
    'character_relations',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('character_id', Integer, ForeignKey('characters.id'), nullable=False),
    Column('related_character_id', Integer, ForeignKey('characters.id'), nullable=False),
    Column('relation_type', String(50), nullable=False),
    Column('description', Text),
    Column('created_at', DateTime, default=func.now())
)

# === 角色扩展模型 ===

class CharacterKnowledge(Base):
    """角色知识扩展表"""
    __tablename__ = "character_knowledge"
    
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    dialogue_style = Column(Text)  # 对话风格
    story_involvement = Column(Text)  # 故事参与度
    character_arc = Column(Text)  # 角色发展弧线
    key_moments = Column(JSON)  # 关键时刻列表
    psychological_traits = Column(Text)  # 心理特征
    relationships_summary = Column(Text)  # 关系总结
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    character = relationship("Character", back_populates="knowledge")

# === 世界观扩展模型 ===

class WorldRule(Base):
    """世界规则表"""
    __tablename__ = "world_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    worldview_id = Column(Integer, ForeignKey("worldviews.id"), nullable=False)
    rule_name = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    rule_category = Column(String(50))  # physics, magic, social, etc.
    rule_importance = Column(String(20))  # high, medium, low
    exceptions = Column(Text)  # 规则例外
    related_rules = Column(JSON)  # 相关规则ID列表
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    worldview = relationship("Worldview", back_populates="rules")

class TimelineEvent(Base):
    """时间线事件表"""
    __tablename__ = "timeline_events"
    
    id = Column(Integer, primary_key=True, index=True)
    worldview_id = Column(Integer, ForeignKey("worldviews.id"), nullable=False)
    event_name = Column(String(100), nullable=False)
    event_description = Column(Text)
    event_date = Column(String(50))  # 事件日期（可以是相对时间）
    event_category = Column(String(50))  # historical, future, alternate
    impact_level = Column(String(20))  # global, regional, local
    related_characters = Column(JSON)  # 相关角色ID列表
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    worldview = relationship("Worldview", back_populates="timeline_events")

# === 场景扩展模型 ===

class SceneTag(Base):
    """场景标签表"""
    __tablename__ = "scene_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    tag_name = Column(String(50), nullable=False)
    tag_type = Column(String(20))  # atmosphere, emotion, theme
    tag_intensity = Column(String(20))  # high, medium, low
    description = Column(Text)
    
    created_at = Column(DateTime, default=func.now())
    
    # 关系
    location = relationship("Location", back_populates="tags")

class SceneTemplate(Base):
    """场景模板表"""
    __tablename__ = "scene_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    template_name = Column(String(100), nullable=False)
    template_content = Column(Text, nullable=False)
    template_category = Column(String(50))  # description, action, dialogue
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    location = relationship("Location", back_populates="templates")

# === 创作技巧模型 ===

class WritingTechnique(Base):
    """创作技巧表"""
    __tablename__ = "writing_techniques"
    
    id = Column(Integer, primary_key=True, index=True)
    technique_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # plot, character, dialogue, description
    description = Column(Text, nullable=False)
    key_points = Column(JSON)  # 关键点列表
    examples = Column(JSON)  # 示例列表
    templates = Column(JSON)  # 模板列表
    difficulty_level = Column(String(20))  # beginner, intermediate, advanced
    usage_frequency = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class InspirationNote(Base):
    """创作灵感记录表"""
    __tablename__ = "inspiration_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50))  # character, plot, scene, dialogue
    source_type = Column(String(50))  # book, movie, life, dream
    tags = Column(JSON)  # 标签列表
    is_used = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    user = relationship("User", back_populates="inspiration_notes")

class CaseStudy(Base):
    """创作案例表"""
    __tablename__ = "case_studies"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    source_work = Column(String(100), nullable=False)  # 来源作品
    author = Column(String(100))  # 作者
    category = Column(String(50))  # plot, character, dialogue, description
    analysis = Column(Text, nullable=False)
    key_techniques = Column(JSON)  # 使用的关键技巧列表
    learning_points = Column(JSON)  # 学习要点列表
    difficulty_level = Column(String(20))  # beginner, intermediate, advanced
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

# === 为现有模型添加关系 ===

# 在Character模型中添加knowledge关系
Character.knowledge = relationship("CharacterKnowledge", back_populates="character", uselist=False)

# 在Worldview模型中添加rules和timeline_events关系
Worldview.rules = relationship("WorldRule", back_populates="worldview", cascade="all, delete-orphan")
Worldview.timeline_events = relationship("TimelineEvent", back_populates="worldview", cascade="all, delete-orphan")

# 在Location模型中添加tags和templates关系
Location.tags = relationship("SceneTag", back_populates="location", cascade="all, delete-orphan")
Location.templates = relationship("SceneTemplate", back_populates="location", cascade="all, delete-orphan")

# 在User模型中添加inspiration_notes关系
User.inspiration_notes = relationship("InspirationNote", back_populates="user", cascade="all, delete-orphan")