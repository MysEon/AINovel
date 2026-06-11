"""扩展Character表新增extra_attributes字段 (历史迁移，已置空)

Revision ID: d9f7c1b2e4aa
Revises: b3e7a1c9d042
Create Date: 2026-02-26 20:30:00.000000

说明：
- 此迁移为历史记录，其变更已合并至 0001_baseline_schema。
- upgrade / downgrade 置空，避免在新环境重复执行导致错误。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9f7c1b2e4aa"
down_revision: Union[str, None] = "b3e7a1c9d042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 历史变更已包含在 0001_baseline_schema 中，此处留空
    pass


def downgrade() -> None:
    # 历史回滚已包含在 0001_baseline_schema downgrade 中，此处留空
    pass

