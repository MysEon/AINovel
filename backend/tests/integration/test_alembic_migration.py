"""Alembic 迁移集成测试

验证基线迁移、AI Runtime 表、外键索引的完整性与幂等性。
"""

import os
import tempfile
import threading
from typing import Set

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

# 期望的表名（新基线 + AI Runtime）
EXPECTED_TABLES: Set[str] = {
    "users",
    "projects",
    "characters",
    "locations",
    "organizations",
    "worldviews",
    "chapters",
    "drafts",
    "model_configs",
    "prompt_templates",
    "ai_generated_content",
    "langgraph_workflows",
    "langgraph_sessions",
    "ai_runs",
    "ai_run_events",
}

EXPECTED_INDEXES: Set[str] = {
    "ix_projects_user_id",
    "ix_characters_project_id",
    "ix_locations_project_id",
    "ix_organizations_project_id",
    "ix_worldviews_project_id",
    "ix_chapters_project_id",
    "ix_chapters_status",
    "ix_chapters_chapter_number",
    "ix_chapters_project_status_order",
    "ix_model_configs_user_id",
    "ix_prompt_templates_user_id",
    "ix_ai_generated_content_project_id",
    "ix_ai_generated_content_chapter_id",
    "ix_ai_generated_content_workflow_id",
    "ix_ai_generated_content_session_id",
    "ix_ai_generated_content_model_config_id",
}

ALEMBIC_INI = os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")


def _run_alembic(url: str, revision: str):
    """在独立线程中运行 Alembic，避免与 pytest-asyncio 事件循环冲突。"""
    exc_info = None

    def _target():
        nonlocal exc_info
        try:
            cfg = Config(ALEMBIC_INI)
            cfg.set_main_option("sqlalchemy.url", url)
            command.upgrade(cfg, revision)
        except Exception as exc:
            exc_info = exc

    t = threading.Thread(target=_target)
    t.start()
    t.join()
    if exc_info:
        raise exc_info


def _run_alembic_downgrade(url: str, revision: str):
    exc_info = None

    def _target():
        nonlocal exc_info
        try:
            cfg = Config(ALEMBIC_INI)
            cfg.set_main_option("sqlalchemy.url", url)
            command.downgrade(cfg, revision)
        except Exception as exc:
            exc_info = exc

    t = threading.Thread(target=_target)
    t.start()
    t.join()
    if exc_info:
        raise exc_info


class TestAlembicMigration:
    def test_upgrade_head_creates_all_tables(self):
        """空数据库执行 upgrade head 后，所有期望的表都应存在。"""
        db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite+aiosqlite:///{db_path}"
        try:
            _run_alembic(url, "head")

            sync_url = f"sqlite:///{db_path}"
            engine = create_engine(sync_url)
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
            engine.dispose()

            missing = EXPECTED_TABLES - tables
            assert not missing, f"缺少表: {missing}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_ai_runtime_tables_exist(self):
        """AI Runtime 5 张表（ai_runs / ai_run_events / langgraph_workflows / langgraph_sessions / ai_generated_content）必须存在。"""
        db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite+aiosqlite:///{db_path}"
        try:
            _run_alembic(url, "head")

            sync_url = f"sqlite:///{db_path}"
            engine = create_engine(sync_url)
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
            engine.dispose()

            ai_tables = {"ai_runs", "ai_run_events", "langgraph_workflows", "langgraph_sessions", "ai_generated_content"}
            assert ai_tables.issubset(tables), f"AI Runtime 表缺失: {ai_tables - tables}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_foreign_key_indexes_exist(self):
        """所有外键索引在 upgrade head 后必须存在。"""
        db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite+aiosqlite:///{db_path}"
        try:
            _run_alembic(url, "head")

            sync_url = f"sqlite:///{db_path}"
            engine = create_engine(sync_url)
            inspector = inspect(engine)

            found_indexes: Set[str] = set()
            for table_name in inspector.get_table_names():
                for idx in inspector.get_indexes(table_name):
                    found_indexes.add(idx["name"])
            engine.dispose()

            missing = EXPECTED_INDEXES - found_indexes
            assert not missing, f"缺少索引: {missing}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_downgrade_base_removes_all_tables(self):
        """upgrade head 后再 downgrade base，应干净回滚所有表。"""
        db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite+aiosqlite:///{db_path}"
        try:
            _run_alembic(url, "head")
            _run_alembic_downgrade(url, "base")

            sync_url = f"sqlite:///{db_path}"
            engine = create_engine(sync_url)
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
            engine.dispose()

            # 排除 SQLite 系统表 alembic_version
            assert tables == {"alembic_version"}, f"回滚后仍有残余表: {tables}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_upgrade_head_is_idempotent(self):
        """重复执行 upgrade head 不应报错（幂等性）。"""
        db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite+aiosqlite:///{db_path}"
        try:
            _run_alembic(url, "head")
            _run_alembic(url, "head")  # 第二次不应报错

            sync_url = f"sqlite:///{db_path}"
            engine = create_engine(sync_url)
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
            engine.dispose()

            missing = EXPECTED_TABLES - tables
            assert not missing, f"幂等执行后缺少表: {missing}"
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)
