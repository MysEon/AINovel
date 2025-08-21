"""
获取项目信息API Step
处理项目信息查询请求
"""

from typing import Dict, Any

from adapters.sqlite_adapter import get_db_adapter


# Step配置
config = {
    "type": "api",
    "name": "GetProject",
    "path": "/api/projects/{project_id}",
    "method": "GET",
    "flows": ["project-management"]
}


async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """处理获取项目信息请求"""
    try:
        # 获取路径参数
        path_params = req.get("path_params", {})
        project_id = path_params.get("project_id")
        
        if not project_id:
            return {
                "status": 400,
                "body": {
                    "error": "Project ID is required",
                    "code": "MISSING_PROJECT_ID"
                }
            }
        
        # 从数据库获取项目信息
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
        
        # 获取项目状态
        project_stats = await ctx.state.get(project_id, "project_stats")
        
        # 构建响应数据
        response_data = {
            "project_id": project["id"],
            "name": project["name"],
            "description": project["description"],
            "user_id": project["user_id"],
            "word_count": project["word_count"],
            "chapter_count": project["chapter_count"],
            "created_at": project["created_at"],
            "updated_at": project["updated_at"]
        }
        
        # 添加统计信息
        if project_stats:
            response_data["stats"] = project_stats
        
        return {
            "status": 200,
            "body": response_data
        }
        
    except Exception as e:
        # 记录错误
        ctx.logger.error("Failed to get project", {
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