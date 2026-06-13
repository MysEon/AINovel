"""扩展ModelConfig表新增scenarios字段

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_SCENARIOS_JSON = '["writing","chat"]'


def upgrade() -> None:
    op.add_column("model_configs", sa.Column("scenarios", sa.Text(), nullable=True))
    op.execute(
        sa.text("UPDATE model_configs SET scenarios = :scenarios WHERE scenarios IS NULL").bindparams(
            scenarios=DEFAULT_SCENARIOS_JSON
        )
    )


def downgrade() -> None:
    op.drop_column("model_configs", "scenarios")
