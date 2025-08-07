from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from database import create_tables
from routers import auth, projects, characters, locations, organizations, worldviews, chapters, drafts, model_configs, prompt_templates, knowledge

# 应用启动时创建数据库表
create_tables()

app = FastAPI(
    title="AINovel API",
    description="智能小说创作助手后端API",
    version="0.1.0"
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

# 配置CORS中间件，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境应更严格
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载认证路由
app.include_router(auth.router)
# 挂载项目管理路由
app.include_router(projects.router)
# 挂载角色管理路由
app.include_router(characters.router)
# 挂载地点管理路由
app.include_router(locations.router)
# 挂载组织管理路由
app.include_router(organizations.router)
# 挂载世界观管理路由
app.include_router(worldviews.router)
# 挂载章节管理路由
app.include_router(chapters.router)
# 挂载草稿管理路由
app.include_router(drafts.router)
# 挂载AI模型配置路由
app.include_router(model_configs.router)
# 挂载提示词模板路由
app.include_router(prompt_templates.router)
# 挂载知识库路由
app.include_router(knowledge.router)

@app.get("/", tags=["Root"])
def read_root():
    """根路径，返回欢迎信息"""
    return {"message": "Welcome to AINovel Backend API"}
