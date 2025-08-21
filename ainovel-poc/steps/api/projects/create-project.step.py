"""
项目创建API Step
处理项目创建请求
"""

import uuid
import json
from datetime import datetime
from typing import Dict, Any

from adapters.sqlite_adapter import get_db_adapter


# Step配置
config = {
    "type": "api",
    "name": "CreateProject",
    "path": "/api/projects",
    "method": "POST",
    "emits": ["project.created"],
    "flows": ["project-management"]
}


async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """处理项目创建请求"""
    try:
        # 获取请求数据
        body = req.get("body", {})
        name = body.get("name")
        description = body.get("description", "")
        user_id = body.get("user_id", "default_user")
        
        # 验证必填字段
        if not name:
            return {
                "status": 400,
                "body": {
                    "error": "Project name is required",
                    "code": "MISSING_NAME"
                }
            }
        
        # 创建项目ID
        project_id = str(uuid.uuid4())
        
        # 构建项目数据
        project_data = {
            "id": project_id,
            "name": name,
            "description": description,
            "user_id": user_id,
            "word_count": 0,
            "chapter_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # 保存到数据库
        db_adapter = await get_db_adapter()
        success = await db_adapter.save_project(project_data)
        
        if not success:
            return {
                "status": 500,
                "body": {
                    "error": "Failed to create project",
                    "code": "DATABASE_ERROR"
                }
            }
        
        # 保存项目状态到Motia状态管理
        await ctx.state.set(project_id, "project_info", project_data)
        await ctx.state.set(project_id, "project_stats", {
            "word_count": 0,
            "chapter_count": 0,
            "ai_tasks_count": 0
        })
        
        # 发送项目创建事件
        await ctx.emit({
            "topic": "project.created",
            "data": {
                "project_id": project_id,
                "name": name,
                "user_id": user_id,
                "created_at": project_data["created_at"]
            }
        })
        
        # 返回成功响应
        return {
            "status": 201,
            "body": {
                "project_id": project_id,
                "name": name,
                "description": description,
                "word_count": 0,
                "chapter_count": 0,
                "created_at": project_data["created_at"],
                "message": "Project created successfully"
            }
        }
        
    except Exception as e:
        # 记录错误
        ctx.logger.error("Failed to create project", {
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