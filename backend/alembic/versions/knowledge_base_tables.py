"""添加知识库相关表

Revision ID: knowledge_base_tables
Revises: f0b36e979082_add_llm_parameters_to_model_config
Create Date: 2025-01-07 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'knowledge_base_tables'
down_revision = 'f0b36e979082_add_llm_parameters_to_model_config'
branch_labels = None
depends_on = None

def upgrade():
    # 创建角色关系表
    op.create_table('character_relations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('character_id', sa.Integer(), nullable=False),
        sa.Column('related_character_id', sa.Integer(), nullable=False),
        sa.Column('relation_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ),
        sa.ForeignKeyConstraint(['related_character_id'], ['characters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建角色知识扩展表
    op.create_table('character_knowledge',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('character_id', sa.Integer(), nullable=False),
        sa.Column('dialogue_style', sa.Text(), nullable=True),
        sa.Column('story_involvement', sa.Text(), nullable=True),
        sa.Column('character_arc', sa.Text(), nullable=True),
        sa.Column('key_moments', sa.JSON(), nullable=True),
        sa.Column('psychological_traits', sa.Text(), nullable=True),
        sa.Column('relationships_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建世界规则表
    op.create_table('world_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('worldview_id', sa.Integer(), nullable=False),
        sa.Column('rule_name', sa.String(length=100), nullable=False),
        sa.Column('rule_description', sa.Text(), nullable=False),
        sa.Column('rule_category', sa.String(length=50), nullable=True),
        sa.Column('rule_importance', sa.String(length=20), nullable=True),
        sa.Column('exceptions', sa.Text(), nullable=True),
        sa.Column('related_rules', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['worldview_id'], ['worldviews.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建时间线事件表
    op.create_table('timeline_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('worldview_id', sa.Integer(), nullable=False),
        sa.Column('event_name', sa.String(length=100), nullable=False),
        sa.Column('event_description', sa.Text(), nullable=True),
        sa.Column('event_date', sa.String(length=50), nullable=True),
        sa.Column('event_category', sa.String(length=50), nullable=True),
        sa.Column('impact_level', sa.String(length=20), nullable=True),
        sa.Column('related_characters', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['worldview_id'], ['worldviews.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建场景标签表
    op.create_table('scene_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('tag_name', sa.String(length=50), nullable=False),
        sa.Column('tag_type', sa.String(length=20), nullable=True),
        sa.Column('tag_intensity', sa.String(length=20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建场景模板表
    op.create_table('scene_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('template_name', sa.String(length=100), nullable=False),
        sa.Column('template_content', sa.Text(), nullable=False),
        sa.Column('template_category', sa.String(length=50), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建创作技巧表
    op.create_table('writing_techniques',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('technique_name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('key_points', sa.JSON(), nullable=True),
        sa.Column('examples', sa.JSON(), nullable=True),
        sa.Column('templates', sa.JSON(), nullable=True),
        sa.Column('difficulty_level', sa.String(length=20), nullable=True),
        sa.Column('usage_frequency', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建创作灵感记录表
    op.create_table('inspiration_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('is_used', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建创作案例表
    op.create_table('case_studies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('source_work', sa.String(length=100), nullable=False),
        sa.Column('author', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('analysis', sa.Text(), nullable=False),
        sa.Column('key_techniques', sa.JSON(), nullable=True),
        sa.Column('learning_points', sa.JSON(), nullable=True),
        sa.Column('difficulty_level', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    # 删除所有表
    op.drop_table('case_studies')
    op.drop_table('inspiration_notes')
    op.drop_table('writing_techniques')
    op.drop_table('scene_templates')
    op.drop_table('scene_tags')
    op.drop_table('timeline_events')
    op.drop_table('world_rules')
    op.drop_table('character_knowledge')
    op.drop_table('character_relations')