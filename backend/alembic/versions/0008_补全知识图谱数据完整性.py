"""补全知识图谱数据完整性

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-17 00:00:00.000000

PR1 数据完整性基础：
- entity_state_events 新增 chapter_order（叙事时序冗余字段，回填自 chapters.order_index）
- 补齐 ORM 标记但迁移未建的单列索引（proposal_id / proposal_operation_id / operation_type 等）
- entity_state_events 加 (proposal_id, proposal_operation_id) 唯一索引，防止提案操作重复 apply
- characters.organization_id 加索引
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── entity_state_events.chapter_order + 回填 ──
    op.add_column("entity_state_events", sa.Column("chapter_order", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE entity_state_events SET chapter_order = ("
        "  SELECT c.order_index FROM chapters c WHERE c.id = entity_state_events.chapter_id"
        ")"
    )
    op.create_index(
        "ix_entity_state_events_chapter_order",
        "entity_state_events",
        ["project_id", "chapter_order"],
        unique=False,
    )

    # ── 补齐单列索引（0007 仅建了复合索引） ──
    op.create_index(
        "ix_entity_relationships_proposal_id",
        "entity_relationships",
        ["proposal_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_relationships_proposal_operation_id",
        "entity_relationships",
        ["proposal_operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_state_events_proposal_id",
        "entity_state_events",
        ["proposal_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_state_events_proposal_operation_id",
        "entity_state_events",
        ["proposal_operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_proposal_operations_operation_type",
        "proposal_operations",
        ["operation_type"],
        unique=False,
    )
    op.create_index(
        "ix_characters_organization_id",
        "characters",
        ["organization_id"],
        unique=False,
    )

    # ── 幂等 apply 兜底：同一提案操作的 state_event 唯一 ──
    # NULL 在唯一索引中被视为互异，故手动 / 无操作来源的历史事件（NULL, NULL）不受影响，
    # 仅阻止同一 (proposal_id, proposal_operation_id) 重复落库。SQLite/Postgres 均如此。
    op.create_index(
        "uq_entity_state_events_proposal_operation",
        "entity_state_events",
        ["proposal_id", "proposal_operation_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_entity_state_events_proposal_operation", table_name="entity_state_events")
    op.drop_index("ix_characters_organization_id", table_name="characters")
    op.drop_index("ix_proposal_operations_operation_type", table_name="proposal_operations")
    op.drop_index("ix_entity_state_events_proposal_operation_id", table_name="entity_state_events")
    op.drop_index("ix_entity_state_events_proposal_id", table_name="entity_state_events")
    op.drop_index("ix_entity_relationships_proposal_operation_id", table_name="entity_relationships")
    op.drop_index("ix_entity_relationships_proposal_id", table_name="entity_relationships")
    op.drop_index("ix_entity_state_events_chapter_order", table_name="entity_state_events")
    op.drop_column("entity_state_events", "chapter_order")
