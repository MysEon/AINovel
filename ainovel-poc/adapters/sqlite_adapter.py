"""
SQLite数据适配器
用于连接和操作SQLite数据库
"""

import sqlite3
import json
import asyncio
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager
from datetime import datetime
import aiofiles


class SQLiteAdapter:
    """SQLite数据库适配器"""
    
    def __init__(self, db_path: str = "ainovel_poc.db"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    user_id TEXT NOT NULL,
                    word_count INTEGER DEFAULT 0,
                    chapter_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS ai_tasks (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress REAL DEFAULT 0.0,
                    project_id TEXT,
                    result TEXT,
                    error TEXT,
                    created_at TEXT,
                    completed_at TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS chapters (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT,
                    outline TEXT,
                    chapter_number INTEGER DEFAULT 0,
                    order_index INTEGER DEFAULT 0,
                    word_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'draft',
                    project_id TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            ''')
            
            conn.commit()
    
    @asynccontextmanager
    async def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    async def save_project(self, project_data: Dict[str, Any]) -> bool:
        """保存项目信息"""
        try:
            async with self.get_connection() as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO projects 
                    (id, name, description, user_id, word_count, chapter_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_data["id"],
                    project_data["name"],
                    project_data.get("description", ""),
                    project_data["user_id"],
                    project_data.get("word_count", 0),
                    project_data.get("chapter_count", 0),
                    project_data.get("created_at", datetime.now().isoformat()),
                    project_data.get("updated_at", datetime.now().isoformat())
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving project: {e}")
            return False
    
    async def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取项目信息"""
        try:
            async with self.get_connection() as conn:
                row = conn.execute(
                    'SELECT * FROM projects WHERE id = ?',
                    (project_id,)
                ).fetchone()
                
                if row:
                    return dict(row)
                return None
        except Exception as e:
            print(f"Error getting project: {e}")
            return None
    
    async def get_projects_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的所有项目"""
        try:
            async with self.get_connection() as conn:
                rows = conn.execute(
                    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
                    (user_id,)
                ).fetchall()
                
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Error getting projects: {e}")
            return []
    
    async def save_ai_task(self, task_data: Dict[str, Any]) -> bool:
        """保存AI任务信息"""
        try:
            async with self.get_connection() as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO ai_tasks 
                    (id, type, status, progress, project_id, result, error, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    task_data["id"],
                    task_data["type"],
                    task_data["status"],
                    task_data.get("progress", 0.0),
                    task_data.get("project_id"),
                    json.dumps(task_data.get("result")) if task_data.get("result") else None,
                    task_data.get("error"),
                    task_data.get("created_at", datetime.now().isoformat()),
                    task_data.get("completed_at")
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving AI task: {e}")
            return False
    
    async def get_ai_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取AI任务信息"""
        try:
            async with self.get_connection() as conn:
                row = conn.execute(
                    'SELECT * FROM ai_tasks WHERE id = ?',
                    (task_id,)
                ).fetchone()
                
                if row:
                    result = dict(row)
                    if result["result"]:
                        result["result"] = json.loads(result["result"])
                    return result
                return None
        except Exception as e:
            print(f"Error getting AI task: {e}")
            return None
    
    async def update_ai_task(self, task_id: str, updates: Dict[str, Any]) -> bool:
        """更新AI任务信息"""
        try:
            async with self.get_connection() as conn:
                set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
                values = list(updates.values())
                values.append(task_id)
                
                conn.execute(f'''
                    UPDATE ai_tasks 
                    SET {set_clause}
                    WHERE id = ?
                ''', values)
                conn.commit()
                return True
        except Exception as e:
            print(f"Error updating AI task: {e}")
            return False
    
    async def save_chapter(self, chapter_data: Dict[str, Any]) -> bool:
        """保存章节信息"""
        try:
            async with self.get_connection() as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO chapters 
                    (id, title, content, outline, chapter_number, order_index, word_count, status, project_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    chapter_data["id"],
                    chapter_data["title"],
                    chapter_data.get("content", ""),
                    chapter_data.get("outline", ""),
                    chapter_data.get("chapter_number", 0),
                    chapter_data.get("order_index", 0),
                    chapter_data.get("word_count", 0),
                    chapter_data.get("status", "draft"),
                    chapter_data["project_id"],
                    chapter_data.get("created_at", datetime.now().isoformat()),
                    chapter_data.get("updated_at", datetime.now().isoformat())
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving chapter: {e}")
            return False
    
    async def get_chapters_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """获取项目的所有章节"""
        try:
            async with self.get_connection() as conn:
                rows = conn.execute(
                    'SELECT * FROM chapters WHERE project_id = ? ORDER BY order_index',
                    (project_id,)
                ).fetchall()
                
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Error getting chapters: {e}")
            return []
    
    async def update_project_stats(self, project_id: str) -> bool:
        """更新项目统计信息"""
        try:
            async with self.get_connection() as conn:
                # 计算总字数和章节数
                result = conn.execute('''
                    SELECT COUNT(*) as chapter_count, SUM(word_count) as total_words
                    FROM chapters 
                    WHERE project_id = ?
                ''', (project_id,)).fetchone()
                
                chapter_count = result["chapter_count"] or 0
                total_words = result["total_words"] or 0
                
                # 更新项目统计
                conn.execute('''
                    UPDATE projects 
                    SET word_count = ?, chapter_count = ?, updated_at = ?
                    WHERE id = ?
                ''', (total_words, chapter_count, datetime.now().isoformat(), project_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error updating project stats: {e}")
            return False


# 全局数据库适配器实例
db_adapter = SQLiteAdapter()


async def get_db_adapter():
    """获取数据库适配器实例"""
    return db_adapter