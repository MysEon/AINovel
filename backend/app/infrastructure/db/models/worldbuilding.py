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
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    project = relationship("Project", back_populates="characters")


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
