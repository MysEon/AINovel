"""新增知识图谱提案基础表

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-14 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "entity_relationships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("relation_type", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=30), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("properties", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("proposal_id", sa.Integer(), nullable=True),
        sa.Column("proposal_operation_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "source_type",
            "source_id",
            "relation_type",
            "target_type",
            "target_id",
            name="uq_entity_relationship_identity",
        ),
    )
    op.create_index("ix_entity_relationships_id", "entity_relationships", ["id"], unique=False)
    op.create_index("ix_entity_relationships_project_id", "entity_relationships", ["project_id"], unique=False)
    op.create_index(
        "ix_entity_relationships_source",
        "entity_relationships",
        ["project_id", "source_type", "source_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_relationships_target",
        "entity_relationships",
        ["project_id", "target_type", "target_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_relationships_status",
        "entity_relationships",
        ["project_id", "status"],
        unique=False,
    )

    op.create_table(
        "entity_state_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("entity_type", sa.String(length=30), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("state_key", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("metadata", sa.Text(), nullable=True),
        sa.Column("proposal_id", sa.Integer(), nullable=True),
        sa.Column("proposal_operation_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_state_events_id", "entity_state_events", ["id"], unique=False)
    op.create_index("ix_entity_state_events_project_id", "entity_state_events", ["project_id"], unique=False)
    op.create_index(
        "ix_entity_state_events_entity",
        "entity_state_events",
        ["project_id", "entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_state_events_chapter_id",
        "entity_state_events",
        ["chapter_id"],
        unique=False,
    )

    op.create_table(
        "entity_change_proposals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("raw_payload", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_change_proposals_id", "entity_change_proposals", ["id"], unique=False)
    op.create_index(
        "ix_entity_change_proposals_project_id",
        "entity_change_proposals",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_change_proposals_status",
        "entity_change_proposals",
        ["project_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_entity_change_proposals_chapter_id",
        "entity_change_proposals",
        ["chapter_id"],
        unique=False,
    )

    op.create_table(
        "proposal_operations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("proposal_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("operation_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("entity_type", sa.String(length=30), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column("relation_type", sa.String(length=80), nullable=True),
        sa.Column("target_type", sa.String(length=30), nullable=True),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("state_key", sa.String(length=100), nullable=True),
        sa.Column("expected_old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("conflict_reason", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["proposal_id"], ["entity_change_proposals.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proposal_operations_id", "proposal_operations", ["id"], unique=False)
    op.create_index("ix_proposal_operations_proposal_id", "proposal_operations", ["proposal_id"], unique=False)
    op.create_index(
        "ix_proposal_operations_entity",
        "proposal_operations",
        ["entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        "ix_proposal_operations_target",
        "proposal_operations",
        ["target_type", "target_id"],
        unique=False,
    )
    op.create_index(
        "ix_proposal_operations_status",
        "proposal_operations",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_proposal_operations_status", table_name="proposal_operations")
    op.drop_index("ix_proposal_operations_target", table_name="proposal_operations")
    op.drop_index("ix_proposal_operations_entity", table_name="proposal_operations")
    op.drop_index("ix_proposal_operations_proposal_id", table_name="proposal_operations")
    op.drop_index("ix_proposal_operations_id", table_name="proposal_operations")
    op.drop_table("proposal_operations")

    op.drop_index("ix_entity_change_proposals_chapter_id", table_name="entity_change_proposals")
    op.drop_index("ix_entity_change_proposals_status", table_name="entity_change_proposals")
    op.drop_index("ix_entity_change_proposals_project_id", table_name="entity_change_proposals")
    op.drop_index("ix_entity_change_proposals_id", table_name="entity_change_proposals")
    op.drop_table("entity_change_proposals")

    op.drop_index("ix_entity_state_events_chapter_id", table_name="entity_state_events")
    op.drop_index("ix_entity_state_events_entity", table_name="entity_state_events")
    op.drop_index("ix_entity_state_events_project_id", table_name="entity_state_events")
    op.drop_index("ix_entity_state_events_id", table_name="entity_state_events")
    op.drop_table("entity_state_events")

    op.drop_index("ix_entity_relationships_status", table_name="entity_relationships")
    op.drop_index("ix_entity_relationships_target", table_name="entity_relationships")
    op.drop_index("ix_entity_relationships_source", table_name="entity_relationships")
    op.drop_index("ix_entity_relationships_project_id", table_name="entity_relationships")
    op.drop_index("ix_entity_relationships_id", table_name="entity_relationships")
    op.drop_table("entity_relationships")
