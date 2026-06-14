"""扩展Chapter表新增分层摘要字段

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-14 00:00:00.000000

说明：
- 给 chapters 表新增三列，用于分层章节摘要缓存
- summary_detailed: L2 详细概括（约 500 字），用户当前章往前 1~3 章
- summary_brief: L3 简要概括（约 150 字），更早的章节
- summary_source_word_count: 生成摘要时章节 word_count 快照，
  用于失效检测：当前 word_count != 快照 → 摘要过期需重新生成
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("chapters", sa.Column("summary_detailed", sa.Text(), nullable=True))
    op.add_column("chapters", sa.Column("summary_brief", sa.Text(), nullable=True))
    op.add_column("chapters", sa.Column("summary_source_word_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("chapters", "summary_source_word_count")
    op.drop_column("chapters", "summary_brief")
    op.drop_column("chapters", "summary_detailed")
