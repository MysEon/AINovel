"""世界观构建模型：角色、地点、组织、世界观"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class Character(Base, TimestampMixin):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    personality = Column(Text)
    background = Column(Text)
    appearance = Column(Text)

    # ── 角色参数 ──
    gender = Column(String(50))          # 性别（含多元选项）
    age = Column(String(50))             # 年龄 / 年龄段
    height = Column(String(30))          # 身高
    weight = Column(String(30))          # 体重
    birthday = Column(String(50))        # 生日
    blood_type = Column(String(20))      # 血型
    species = Column(String(50))         # 种族
    alignment = Column(String(50))       # 阵营
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    dimensions = Column(Text)            # 三维属性 JSON，如 {"智力":80,"体力":60,"魅力":90}
    abilities = Column(Text)             # 能力 / 技能
    weaknesses = Column(Text)            # 弱点 / 缺陷

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="characters")
    organization = relationship("Organization", foreign_keys=[organization_id])


class Location(Base, TimestampMixin):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    geography = Column(Text)
    culture = Column(Text)
    history = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="locations")


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    structure = Column(Text)
    purpose = Column(Text)
    influence = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="organizations")


class Worldview(Base, TimestampMixin):
    __tablename__ = "worldviews"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    rules = Column(Text)
    magic_system = Column(Text)
    technology = Column(Text)
    timeline = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="worldviews")
