"""
AI大纲生成Event Step
处理AI大纲生成的工作流
"""

import json
import asyncio
from datetime import datetime
from typing import Dict, Any

from adapters.sqlite_adapter import get_db_adapter
from adapters.openai_adapter import get_ai_adapter


# Step配置
config = {
    "type": "event",
    "name": "GenerateOutlineAI",
    "subscribes": ["ai.outline.requested"],
    "emits": ["ai.outline.generated", "ai.outline.failed"],
    "flows": ["ai-writing"]
}


async def handler(input_data: Dict[str, Any], ctx) -> None:
    """处理AI大纲生成事件"""
    try:
        task_id = input_data["task_id"]
        project_id = input_data["project_id"]
        chapter_number = input_data["chapter_number"]
        user_requirements = input_data["user_requirements"]
        project_context = input_data["project_context"]
        
        # 获取适配器
        db_adapter = await get_db_adapter()
        ai_adapter = await get_ai_adapter()
        
        # 更新任务状态为处理中
        await update_task_status(ctx, db_adapter, task_id, "processing", 0.2)
        
        # 记录开始处理
        ctx.logger.info("Starting AI outline generation", {
            "task_id": task_id,
            "project_id": project_id,
            "chapter_number": chapter_number
        })
        
        # 调用AI生成大纲
        outline = await ai_adapter.generate_outline(
            project_context=project_context,
            chapter_number=chapter_number,
            user_requirements=user_requirements
        )
        
        # 更新进度
        await update_task_status(ctx, db_adapter, task_id, "processing", 0.8)
        
        # 处理生成结果
        if not outline or not outline.get("title"):
            raise ValueError("Generated outline is invalid")
        
        # 构建结果数据
        result = {
            "outline": outline,
            "chapter_number": chapter_number,
            "generated_at": datetime.now().isoformat(),
            "model": "gpt-4"
        }
        
        # 更新任务状态为完成
        await update_task_status(ctx, db_adapter, task_id, "completed", 1.0, result)
        
        # 发送成功事件
        await ctx.emit({
            "topic": "ai.outline.generated",
            "data": {
                "task_id": task_id,
                "project_id": project_id,
                "chapter_number": chapter_number,
                "outline": outline,
                "generated_at": result["generated_at"]
            }
        })
        
        # 记录完成
        ctx.logger.info("AI outline generation completed", {
            "task_id": task_id,
            "project_id": project_id,
            "outline_title": outline.get("title")
        })
        
    except Exception as e:
        # 记录错误
        ctx.logger.error("AI outline generation failed", {
            "task_id": input_data.get("task_id"),
            "error": str(e)
        })
        
        # 更新任务状态为失败
        await update_task_status(ctx, db_adapter, input_data["task_id"], "failed", 0.0, None, str(e))
        
        # 发送失败事件
        await ctx.emit({
            "topic": "ai.outline.failed",
            "data": {
                "task_id": input_data["task_id"],
                "project_id": input_data["project_id"],
                "error": str(e)
            }
        })


async def update_task_status(
    ctx, 
    db_adapter, 
    task_id: str, 
    status: str, 
    progress: float, 
    result: Dict[str, Any] = None, 
    error: str = None
) -> bool:
    """更新任务状态"""
    try:
        # 更新数据库中的任务状态
        updates = {
            "status": status,
            "progress": progress
        }
        
        if result:
            updates["result"] = json.dumps(result)
        
        if error:
            updates["error"] = error
        
        if status == "completed":
            updates["completed_at"] = datetime.now().isoformat()
        
        await db_adapter.update_ai_task(task_id, updates)
        
        # 更新Motia状态管理中的任务进度
        progress_data = {
            "status": status,
            "progress": progress,
            "updated_at": datetime.now().isoformat()
        }
        
        if result:
            progress_data["result"] = result
        
        if error:
            progress_data["error"] = error
        
        await ctx.state.set(task_id, "task_progress", progress_data)
        
        return True
        
    except Exception as e:
        ctx.logger.error("Failed to update task status", {
            "task_id": task_id,
            "error": str(e)
        })
        return False