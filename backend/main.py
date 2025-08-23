from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from uvicorn.logging import DefaultFormatter

# 配置日志记录器
def setup_logging():
    # 禁用 SQLAlchemy 的日志记录器
    logging.getLogger('sqlalchemy').setLevel(logging.WARNING)

    # 配置 uvicorn 的访问日志
    access_logger = logging.getLogger('uvicorn.access')
    access_logger.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(DefaultFormatter("%(levelprefix)s %(client_addr)s - \"%(request_line)s\" %(status_code)s"))
    access_logger.addHandler(handler)

setup_logging()

from database import create_tables
from routers import auth, projects, characters, locations, organizations, worldviews, chapters, drafts, model_configs, prompt_templates, knowledge

# 尝试导入LangChain路由（如果依赖已安装）
try:
    from routers import langchain_ai
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    print("Warning: LangChain dependencies not installed. AI features will not be available.")

# 应用启动时创建数据库表
create_tables()

app = FastAPI(
    title="AINovel API",
    description="智能小说创作助手后端API",
    version="0.1.0"
)

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

# 如果LangChain可用，挂载AI路由
if LANGCHAIN_AVAILABLE:
    app.include_router(langchain_ai.router)

@app.get("/", tags=["Root"])
def read_root():
    """根路径，返回欢迎信息"""
    return {"message": "Welcome to AINovel Backend API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8082)
