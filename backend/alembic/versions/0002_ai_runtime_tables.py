"""AI Runtime 表迁移：ai_runs / ai_run_events / 完善 ai_generated_content

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "d9f7c1b2e4aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ai_runs
    op.create_table(
        "ai_runs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("langgraph_sessions.id"), nullable=False),
        sa.Column("workflow_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, default="pending", index=True),
        sa.Column("input_data", sa.Text(), nullable=True),
        sa.Column("output_data", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), default=0),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 2. ai_run_events
    op.create_table(
        "ai_run_events",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("ai_runs.id"), nullable=False, index=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("node_name", sa.String(length=100), nullable=True),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # 3. ai_generated_content（含 run_id）
    op.create_table(
        "ai_generated_content",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("chapter_id", sa.Integer(), sa.ForeignKey("chapters.id"), nullable=True),
        sa.Column("workflow_id", sa.Integer(), sa.ForeignKey("langgraph_workflows.id"), nullable=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("langgraph_sessions.id"), nullable=True),
        sa.Column("model_config_id", sa.Integer(), sa.ForeignKey("model_configs.id"), nullable=False),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("ai_runs.id"), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_metadata", sa.Text(), nullable=True),
        sa.Column("word_count", sa.Integer(), default=0),
        sa.Column("tokens_used", sa.Integer(), default=0),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("user_feedback", sa.Text(), nullable=True),
        sa.Column("is_approved", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ai_generated_content")
    op.drop_table("ai_run_events")
    op.drop_table("ai_runs")
