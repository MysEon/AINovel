"""Story knowledge graph models.

These tables keep graph-shaped novel memory in the existing relational store:
relationships, accepted state events, and reviewable change proposals.
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.db.base import Base, TimestampMixin


class EntityRelationship(Base, TimestampMixin):
    """Current cross-entity relationship in a project."""

    __tablename__ = "entity_relationships"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "source_type",
            "source_id",
            "relation_type",
            "target_type",
            "target_id",
            name="uq_entity_relationship_identity",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    source_type = Column(String(30), nullable=False, index=True)
    source_id = Column(Integer, nullable=False, index=True)
    relation_type = Column(String(80), nullable=False, index=True)
    target_type = Column(String(30), nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    description = Column(Text)
    evidence = Column(Text)
    confidence = Column(Float)
    properties = Column(Text)
    source = Column(String(30), nullable=False, default="proposal")
    proposal_id = Column(Integer, nullable=True, index=True)
    proposal_operation_id = Column(Integer, nullable=True, index=True)

    project = relationship("Project", back_populates="entity_relationships")


class EntityStateEvent(Base, TimestampMixin):
    """Timeline entry describing an entity state change caused by story progress."""

    __tablename__ = "entity_state_events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True, index=True)
    entity_type = Column(String(30), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    state_key = Column(String(100), nullable=False, index=True)
    old_value = Column(Text)
    new_value = Column(Text)
    summary = Column(Text)
    evidence = Column(Text)
    confidence = Column(Float)
    source = Column(String(30), nullable=False, default="proposal")
    metadata_json = Column("metadata", Text)
    proposal_id = Column(Integer, nullable=True, index=True)
    proposal_operation_id = Column(Integer, nullable=True, index=True)
    # 冗余叙事时序：取自 chapters.order_index，便于按故事顺序而非写入时间排列时间线
    chapter_order = Column(Integer, nullable=True, index=True)

    project = relationship("Project", back_populates="entity_state_events")
    chapter = relationship("Chapter")


class EntityChangeProposal(Base, TimestampMixin):
    """Reviewable story event proposal with structured child operations."""

    __tablename__ = "entity_change_proposals"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text)
    evidence = Column(Text)
    confidence = Column(Float)
    status = Column(String(20), nullable=False, default="pending", index=True)
    source = Column(String(30), nullable=False, default="manual", index=True)
    raw_payload = Column(Text)
    reviewed_at = Column(DateTime)

    project = relationship("Project", back_populates="entity_change_proposals")
    chapter = relationship("Chapter")
    operations = relationship(
        "ProposalOperation",
        back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="ProposalOperation.sort_order",
    )


class ProposalOperation(Base, TimestampMixin):
    """Single structured write operation inside a change proposal."""

    __tablename__ = "proposal_operations"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("entity_change_proposals.id"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    operation_type = Column(String(40), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    entity_type = Column(String(30), nullable=True, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    field_name = Column(String(100), nullable=True, index=True)
    relation_type = Column(String(80), nullable=True, index=True)
    target_type = Column(String(30), nullable=True, index=True)
    target_id = Column(Integer, nullable=True, index=True)
    state_key = Column(String(100), nullable=True, index=True)
    expected_old_value = Column(Text)
    new_value = Column(Text)
    payload = Column(Text)
    conflict_reason = Column(Text)
    applied_at = Column(DateTime)

    proposal = relationship("EntityChangeProposal", back_populates="operations")
