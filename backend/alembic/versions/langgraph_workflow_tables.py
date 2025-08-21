"""add langgraph workflow tables

Revision ID: langgraph_workflow_tables
Revises: f0b36e979082_add_llm_parameters_to_model_config
Create Date: 2025-08-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'langgraph_workflow_tables'
down_revision = 'f0b36e979082_add_llm_parameters_to_model_config'
branch_labels = None
depends_on = None


def upgrade():
    # 创建LangGraph工作流表
    op.create_table(
        'langgraph_workflows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('workflow_type', sa.String(50), nullable=False),  # outline_to_draft, dialogue_generation, plot_planning
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('model_config_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), server_default='active'),  # active, paused, completed
        sa.Column('config_data', sa.Text(), nullable=True),  # JSON格式的工作流配置
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['model_config_id'], ['model_configs.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建LangGraph会话表
    op.create_table(
        'langgraph_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.String(100), nullable=False),
        sa.Column('session_data', sa.Text(), nullable=True),  # JSON格式的会话数据
        sa.Column('messages_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['workflow_id'], ['langgraph_workflows.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('thread_id')
    )
    
    # 创建AI生成内容表
    op.create_table(
        'ai_generated_content',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(50), nullable=False),  # outline, draft, dialogue, suggestion
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('chapter_id', sa.Integer(), nullable=True),
        sa.Column('workflow_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('model_config_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_metadata', sa.Text(), nullable=True),  # JSON格式的元数据
        sa.Column('word_count', sa.Integer(), server_default='0'),
        sa.Column('tokens_used', sa.Integer(), server_default='0'),
        sa.Column('quality_score', sa.Float(), nullable=True),  # AI质量评分
        sa.Column('user_feedback', sa.Text(), nullable=True),  # 用户反馈
        sa.Column('is_approved', sa.Boolean(), server_default='False'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ),
        sa.ForeignKeyConstraint(['model_config_id'], ['model_configs.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['langgraph_sessions.id'], ),
        sa.ForeignKeyConstraint(['workflow_id'], ['langgraph_workflows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建索引
    op.create_index('ix_langgraph_workflows_project_id', 'langgraph_workflows', ['project_id'])
    op.create_index('ix_langgraph_workflows_workflow_type', 'langgraph_workflows', ['workflow_type'])
    op.create_index('ix_langgraph_workflows_status', 'langgraph_workflows', ['status'])
    op.create_index('ix_langgraph_sessions_workflow_id', 'langgraph_sessions', ['workflow_id'])
    op.create_index('ix_ai_generated_content_project_id', 'ai_generated_content', ['project_id'])
    op.create_index('ix_ai_generated_content_content_type', 'ai_generated_content', ['content_type'])
    op.create_index('ix_ai_generated_content_created_at', 'ai_generated_content', ['created_at'])


def downgrade():
    # 删除索引
    op.drop_index('ix_ai_generated_content_created_at', table_name='ai_generated_content')
    op.drop_index('ix_ai_generated_content_content_type', table_name='ai_generated_content')
    op.drop_index('ix_ai_generated_content_project_id', table_name='ai_generated_content')
    op.drop_index('ix_langgraph_sessions_workflow_id', table_name='langgraph_sessions')
    op.drop_index('ix_langgraph_workflows_status', table_name='langgraph_workflows')
    op.drop_index('ix_langgraph_workflows_workflow_type', table_name='langgraph_workflows')
    op.drop_index('ix_langgraph_workflows_project_id', table_name='langgraph_workflows')
    
    # 删除表
    op.drop_table('ai_generated_content')
    op.drop_table('langgraph_sessions')
    op.drop_table('langgraph_workflows')