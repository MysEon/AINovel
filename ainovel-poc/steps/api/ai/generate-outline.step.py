"""
AI章节大纲生成API Step
处理AI大纲生成请求
"""

import uuid
import json
from datetime import datetime
from typing import Dict, Any

from adapters.sqlite_adapter import get_db_adapter


# Step配置
config = {
    "type": "api",
    "name": "GenerateChapterOutline",
    "path": "/api/ai/chapter-outline",
    "method": "POST",
    "emits": ["ai.outline.requested"],
    "flows": ["ai-writing"]
}


async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """处理AI大纲生成请求"""
    try:
        # 获取请求数据
        body = req.get("body", {})
        project_id = body.get("project_id")
        chapter_number = body.get("chapter_number")
        user_requirements = body.get("user_requirements", "")
        
        # 验证必填字段
        if not project_id or not chapter_number:
            return {
                "status": 400,
                "body": {
                    "error": "Project ID and chapter number are required",
                    "code": "MISSING_FIELDS"
                }
            }
        
        # 验证项目是否存在
        db_adapter = await get_db_adapter()
        project = await db_adapter.get_project(project_id)
        
        if not project:
            return {
                "status": 404,
                "body": {
                    "error": "Project not found",
                    "code": "PROJECT_NOT_FOUND"
                }
            }
        
        # 创建任务ID
        task_id = str(uuid.uuid4())
        
        # 构建任务数据
        task_data = {
            "id": task_id,
            "type": "outline",
            "status": "pending",
            "progress": 0.0,
            "project_id": project_id,
            "chapter_number": chapter_number,
            "user_requirements": user_requirements,
            "created_at": datetime.now().isoformat()
        }
        
        # 保存任务到数据库
        success = await db_adapter.save_ai_task(task_data)
        
        if not success:
            return {
                "status": 500,
                "body": {
                    "error": "Failed to create AI task",
                    "code": "DATABASE_ERROR"
                }
            }
        
        # 保存任务状态到Motia状态管理
        await ctx.state.set(task_id, "task_info", task_data)
        await ctx.state.set(task_id, "task_progress", {
            "status": "pending",
            "progress": 0.0,
            "message": "Task queued"
        })
        
        # 更新项目统计
        project_stats = await ctx.state.get(project_id, "project_stats")
        if project_stats:
            project_stats["ai_tasks_count"] = project_stats.get("ai_tasks_count", 0) + 1
            await ctx.state.set(project_id, "project_stats", project_stats)
        
        # 发送AI大纲生成请求事件
        await ctx.emit({
            "topic": "ai.outline.requested",
            "data": {
                "task_id": task_id,
                "project_id": project_id,
                "chapter_number": chapter_number,
                "user_requirements": user_requirements,
                "project_context": {
                    "name": project["name"],
                    "description": project["description"]
                }
            }
        })
        
        # 返回任务信息
        return {
            "status": 202,
            "body": {
                "task_id": task_id,
                "type": "outline",
                "status": "pending",
                "progress": 0.0,
                "message": "Outline generation started",
                "project_id": project_id,
                "chapter_number": chapter_number,
                "created_at": task_data["created_at"]
            }
        }
        
    except Exception as e:
        # 记录错误
        ctx.logger.error("Failed to start outline generation", {
            "error": str(e),
            "request": req
        })
        
        return {
            "status": 500,
            "body": {
                "error": f"Internal server error: {str(e)}",
                "code": "INTERNAL_ERROR"
            }
        }