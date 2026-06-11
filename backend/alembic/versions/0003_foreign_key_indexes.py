"""外键索引迁移

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # projects
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    # worldbuilding
    op.create_index("ix_characters_project_id", "characters", ["project_id"])
    op.create_index("ix_locations_project_id", "locations", ["project_id"])
    op.create_index("ix_organizations_project_id", "organizations", ["project_id"])
    op.create_index("ix_worldviews_project_id", "worldviews", ["project_id"])

    # chapters
    op.create_index("ix_chapters_project_id", "chapters", ["project_id"])
    op.create_index("ix_chapters_status", "chapters", ["status"])
    op.create_index("ix_chapters_chapter_number", "chapters", ["chapter_number"])
    op.create_index("ix_chapters_project_status_order", "chapters", ["project_id", "status", "order_index"])

    # configs & prompts
    op.create_index("ix_model_configs_user_id", "model_configs", ["user_id"])
    op.create_index("ix_prompt_templates_user_id", "prompt_templates", ["user_id"])

    # ai_generated_content
    op.create_index("ix_ai_generated_content_project_id", "ai_generated_content", ["project_id"])
    op.create_index("ix_ai_generated_content_chapter_id", "ai_generated_content", ["chapter_id"])
    op.create_index("ix_ai_generated_content_workflow_id", "ai_generated_content", ["workflow_id"])
    op.create_index("ix_ai_generated_content_session_id", "ai_generated_content", ["session_id"])
    op.create_index("ix_ai_generated_content_model_config_id", "ai_generated_content", ["model_config_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_generated_content_model_config_id", table_name="ai_generated_content")
    op.drop_index("ix_ai_generated_content_session_id", table_name="ai_generated_content")
    op.drop_index("ix_ai_generated_content_workflow_id", table_name="ai_generated_content")
    op.drop_index("ix_ai_generated_content_chapter_id", table_name="ai_generated_content")
    op.drop_index("ix_ai_generated_content_project_id", table_name="ai_generated_content")

    op.drop_index("ix_prompt_templates_user_id", table_name="prompt_templates")
    op.drop_index("ix_model_configs_user_id", table_name="model_configs")

    op.drop_index("ix_chapters_project_status_order", table_name="chapters")
    op.drop_index("ix_chapters_chapter_number", table_name="chapters")
    op.drop_index("ix_chapters_status", table_name="chapters")
    op.drop_index("ix_chapters_project_id", table_name="chapters")

    op.drop_index("ix_worldviews_project_id", table_name="worldviews")
    op.drop_index("ix_organizations_project_id", table_name="organizations")
    op.drop_index("ix_locations_project_id", table_name="locations")
    op.drop_index("ix_characters_project_id", table_name="characters")

    op.drop_index("ix_projects_user_id", table_name="projects")
