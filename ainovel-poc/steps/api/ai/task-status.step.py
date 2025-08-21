"""
查询AI任务状态API Step
处理任务状态查询请求
"""

from typing import Dict, Any

from adapters.sqlite_adapter import get_db_adapter


# Step配置
config = {
    "type": "api",
    "name": "GetTaskStatus",
    "path": "/api/ai/status/{task_id}",
    "method": "GET",
    "flows": ["ai-writing"]
}


async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """处理任务状态查询请求"""
    try:
        # 获取路径参数
        path_params = req.get("path_params", {})
        task_id = path_params.get("task_id")
        
        if not task_id:
            return {
                "status": 400,
                "body": {
                    "error": "Task ID is required",
                    "code": "MISSING_TASK_ID"
                }
            }
        
        # 从数据库获取任务信息
        db_adapter = await get_db_adapter()
        task = await db_adapter.get_ai_task(task_id)
        
        if not task:
            return {
                "status": 404,
                "body": {
                    "error": "Task not found",
                    "code": "TASK_NOT_FOUND"
                }
            }
        
        # 获取任务进度状态
        task_progress = await ctx.state.get(task_id, "task_progress")
        
        # 构建响应数据
        response_data = {
            "task_id": task["id"],
            "type": task["type"],
            "status": task["status"],
            "progress": task["progress"],
            "project_id": task["project_id"],
            "created_at": task["created_at"],
            "completed_at": task.get("completed_at")
        }
        
        # 添加结果信息（如果任务已完成）
        if task["status"] == "completed" and task["result"]:
            response_data["result"] = task["result"]
        
        # 添加错误信息（如果任务失败）
        if task["status"] == "failed" and task["error"]:
            response_data["error"] = task["error"]
        
        # 添加进度信息
        if task_progress:
            response_data["progress_detail"] = task_progress
        
        return {
            "status": 200,
            "body": response_data
        }
        
    except Exception as e:
        # 记录错误
        ctx.logger.error("Failed to get task status", {
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