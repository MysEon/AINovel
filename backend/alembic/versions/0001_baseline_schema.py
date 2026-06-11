"""基线迁移：创建全部核心表

Revision ID: 0001
Revises:
Create Date: 2026-06-11 00:00:00.000000

说明：
- 此为新基线迁移，包含 13 张核心表的完整 create_table。
- 旧迁移（95ec18802f56 及后续）保留于目录中但已置空 upgrade/downgrade，
  仅供历史参考；新环境请从本迁移开始执行。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("username", sa.String(length=50), nullable=False, unique=True, index=True),
        sa.Column("email", sa.String(length=100), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 2. projects
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("word_count", sa.Integer(), default=0),
        sa.Column("chapter_count", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 3. organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("structure", sa.Text(), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("influence", sa.Text(), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 4. characters
    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("personality", sa.Text(), nullable=True),
        sa.Column("background", sa.Text(), nullable=True),
        sa.Column("appearance", sa.Text(), nullable=True),
        sa.Column("gender", sa.String(length=50), nullable=True),
        sa.Column("age", sa.String(length=50), nullable=True),
        sa.Column("height", sa.String(length=30), nullable=True),
        sa.Column("weight", sa.String(length=30), nullable=True),
        sa.Column("birthday", sa.String(length=50), nullable=True),
        sa.Column("blood_type", sa.String(length=20), nullable=True),
        sa.Column("species", sa.String(length=50), nullable=True),
        sa.Column("alignment", sa.String(length=50), nullable=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("dimensions", sa.Text(), nullable=True),
        sa.Column("abilities", sa.Text(), nullable=True),
        sa.Column("weaknesses", sa.Text(), nullable=True),
        sa.Column("extra_attributes", sa.Text(), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 5. locations
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("geography", sa.Text(), nullable=True),
        sa.Column("culture", sa.Text(), nullable=True),
        sa.Column("history", sa.Text(), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 6. worldviews
    op.create_table(
        "worldviews",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rules", sa.Text(), nullable=True),
        sa.Column("magic_system", sa.Text(), nullable=True),
        sa.Column("technology", sa.Text(), nullable=True),
        sa.Column("timeline", sa.Text(), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 7. chapters
    op.create_table(
        "chapters",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("outline", sa.Text(), nullable=True),
        sa.Column("chapter_number", sa.Integer(), default=0),
        sa.Column("order_index", sa.Integer(), default=0),
        sa.Column("word_count", sa.Integer(), default=0),
        sa.Column("status", sa.String(length=20), default="draft"),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 8. drafts
    op.create_table(
        "drafts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("word_count", sa.Integer(), default=0),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 9. model_configs
    op.create_table(
        "model_configs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("model_type", sa.String(length=50), nullable=False),
        sa.Column("api_key", sa.String(length=500), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("temperature", sa.String(length=10), default="0.7"),
        sa.Column("max_tokens", sa.Integer(), default=2000),
        sa.Column("api_url", sa.String(length=500), nullable=True),
        sa.Column("top_p", sa.String(length=10), default="1.0"),
        sa.Column("top_k", sa.Integer(), default=40),
        sa.Column("frequency_penalty", sa.String(length=10), default="0.0"),
        sa.Column("presence_penalty", sa.String(length=10), default="0.0"),
        sa.Column("stop_sequences", sa.Text(), nullable=True),
        sa.Column("stream", sa.Boolean(), default=False),
        sa.Column("logprobs", sa.Boolean(), default=False),
        sa.Column("top_logprobs", sa.Integer(), default=0),
        sa.Column("proxy_url", sa.String(length=500), nullable=True),
        sa.Column("enable_proxy", sa.Boolean(), default=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 10. prompt_templates
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("template", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), default=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("usage_count", sa.Integer(), default=0),
        sa.Column("variables", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 11. langgraph_workflows
    op.create_table(
        "langgraph_workflows",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("workflow_type", sa.String(length=50), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("model_config_id", sa.Integer(), sa.ForeignKey("model_configs.id"), nullable=False),
        sa.Column("status", sa.String(length=20), default="active"),
        sa.Column("config_data", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 12. langgraph_sessions
    op.create_table(
        "langgraph_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("workflow_id", sa.Integer(), sa.ForeignKey("langgraph_workflows.id"), nullable=False),
        sa.Column("thread_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("session_data", sa.Text(), nullable=True),
        sa.Column("messages_count", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("langgraph_sessions")
    op.drop_table("langgraph_workflows")
    op.drop_table("prompt_templates")
    op.drop_table("model_configs")
    op.drop_table("drafts")
    op.drop_table("chapters")
    op.drop_table("worldviews")
    op.drop_table("locations")
    op.drop_table("characters")
    op.drop_table("organizations")
    op.drop_table("projects")
    op.drop_table("users")
