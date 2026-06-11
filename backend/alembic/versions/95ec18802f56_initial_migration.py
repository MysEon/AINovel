"""initial_migration (历史迁移，已置空)

Revision ID: 95ec18802f56
Revises: 0001
Create Date: 2025-08-21 15:26:36.819762

说明：
- 此迁移为历史记录，其变更已合并至 0001_baseline_schema。
- upgrade / downgrade 置空，避免在新环境重复执行导致错误。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '95ec18802f56'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 历史变更已包含在 0001_baseline_schema 中，此处留空
    pass


def downgrade() -> None:
    # 历史回滚已包含在 0001_baseline_schema downgrade 中，此处留空
    pass
