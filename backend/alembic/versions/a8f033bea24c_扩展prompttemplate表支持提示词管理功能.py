"""扩展PromptTemplate表支持提示词管理功能 (历史迁移，已置空)

Revision ID: a8f033bea24c
Revises: 95ec18802f56
Create Date: 2025-08-23 15:55:23.511505

说明：
- 此迁移为历史记录，其变更已合并至 0001_baseline_schema。
- upgrade / downgrade 置空，避免在新环境重复执行导致错误。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8f033bea24c'
down_revision: Union[str, None] = '95ec18802f56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 历史变更已包含在 0001_baseline_schema 中，此处留空
    pass


def downgrade() -> None:
    # 历史回滚已包含在 0001_baseline_schema downgrade 中，此处留空
    pass
