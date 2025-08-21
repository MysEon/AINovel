# AINovel 项目结构总结

## 项目概述
智能小说创作助手 - 基于React前端和FastAPI后端的AI驱动的小说创作平台

## 项目结构

```
AINovel/
├── README.md                           # 项目说明文档
├── TODO.md                             # 任务清单
├── AI_UNIFIED_MANAGEMENT.md           # AI功能统一管理说明
├── LANGCHAIN_INTEGRATION.md           # LangChain集成文档
├── CLAUDE.md                           # Claude Code项目指南
├── .gitignore                          # Git忽略文件
├── docker-compose.yml                  # Docker编排配置
├── ainovel.db                          # SQLite数据库文件
├── backend/                            # 后端目录
│   ├── main.py                        # FastAPI应用入口
│   ├── requirements.txt               # Python依赖
│   ├── Dockerfile                     # Docker配置
│   ├── alembic.ini                   # 数据库迁移配置
│   ├── alembic/                       # 数据库迁移目录
│   │   ├── env.py                     # 迁移环境
│   │   ├── script.py.mako            # 迁移脚本模板
│   │   └── versions/                  # 迁移版本文件
│   ├── auth.py                        # 认证模块
│   ├── database.py                   # 数据库连接
│   ├── models.py                      # 数据库模型
│   ├── schemas.py                     # Pydantic数据模型
│   ├── langchain_service.py           # LangChain AI服务
│   ├── knowledge_models.py            # 知识库模型
│   └── routers/                       # API路由目录
│       ├── __init__.py
│       ├── auth.py                    # 认证路由
│       ├── projects.py                # 项目管理路由
│       ├── chapters.py                # 章节管理路由
│       ├── characters.py              # 角色管理路由
│       ├── locations.py               # 地点管理路由
│       ├── organizations.py           # 组织管理路由
│       ├── worldviews.py              # 世界观管理路由
│       ├── drafts.py                  # 草稿管理路由
│       ├── model_configs.py           # AI模型配置路由
│       ├── prompt_templates.py        # 提示词模板路由
│       ├── knowledge.py               # 知识库路由
│       └── langchain_ai.py            # LangChain AI功能路由
└── frontend/                           # 前端目录
    ├── package.json                   # Node.js依赖配置
    ├── vite.config.js                 # Vite构建配置
    ├── index.html                     # HTML入口文件
    ├── Dockerfile                     # Docker配置
    ├── README.md                      # 前端说明
    ├── node_modules/                  # Node.js依赖包
    ├── dist/                          # 构建输出目录
    ├── public/                        # 静态资源目录
    └── src/                           # 源代码目录
        ├── main.jsx                   # React应用入口
        ├── App.jsx                    # 主应用组件
        ├── App.css                    # 主应用样式
        ├── index.css                  # 全局样式
        ├── Sidebar.jsx                # 侧边栏组件
        ├── assets/                    # 资源文件
        ├── components/                # React组件目录
        │   ├── LoginPage.jsx           # 登录页面
        │   ├── RegisterPage.jsx       # 注册页面
        │   ├── ProjectEditor.jsx       # 项目编辑器
        │   ├── ProjectEditor.css       # 项目编辑器样式
        │   ├── ProjectOverview.jsx    # 项目概览
        │   ├── ProjectOverview.css    # 项目概览样式
        │   ├── ProjectDashboard.jsx   # 项目仪表板
        │   ├── ModelConfigManager.jsx # AI模型配置管理器
        │   ├── ModelConfigManager.css # 模型配置管理器样式
        │   ├── KnowledgeBase.jsx      # 知识库组件
        │   ├── KnowledgeBase.css      # 知识库样式
        │   ├── KanbanBoard.jsx        # 看板组件
        │   ├── KanbanBoard.css        # 看板样式
        │   ├── Notification.jsx       # 通知组件
        │   ├── Notification.css       # 通知样式
        │   ├── NotificationManager.jsx # 通知管理器
        │   ├── NotificationManager.css # 通知管理器样式
        │   ├── UniversalDialog.jsx     # 通用对话框
        │   ├── UniversalDialog.css     # 通用对话框样式
        │   └── writing/                # 写作相关组件
        │       ├── WritingEditor.jsx   # 写作编辑器
        │       ├── WritingEditor.css   # 写作编辑器样式
        │       ├── WritingEditorImproved.css # 改进版写作编辑器样式
        │       ├── WritingEditorSimple.css    # 简版写作编辑器样式
        │       ├── PublishedChapters.jsx     # 已发布章节
        │       ├── PublishedChapters.css     # 已发布章节样式
        │       ├── ChapterItem.jsx           # 章节项组件
        │       ├── BatchChapterPublishDialog.jsx # 批量发布章节对话框
        │       └── BatchChapterPublishDialog.css # 批量发布对话框样式
        └── services/                  # API服务层
            ├── projectService.js       # 项目服务
            ├── chapterService.js       # 章节服务
            └── modelConfigService.js   # 模型配置服务
```

## 核心功能

### 后端功能
- **用户认证**: JWT令牌认证系统
- **项目管理**: 创建、编辑、删除小说项目
- **章节管理**: 章节创建、编辑、发布、批量管理
- **角色管理**: 小说角色信息管理
- **地点管理**: 故事地点信息管理
- **组织管理**: 组织机构信息管理
- **世界观管理**: 世界观设定管理
- **草稿管理**: 章节草稿保存和管理
- **AI功能**: 通过LangChain/LangGraph统一管理的AI功能
  - 章节大纲生成
  - 章节草稿生成
  - 角色对话生成
  - 情节发展建议
- **模型配置**: AI模型配置管理
- **提示词模板**: 自定义提示词模板
- **知识库**: 项目相关知识库管理

### 前端功能
- **响应式界面**: 支持桌面和移动设备
- **项目仪表板**: 项目统计和概览
- **写作编辑器**: 专业的小说写作界面
- **AI辅助**: 智能写作助手功能
- **批量操作**: 批量章节发布和管理
- **实时通知**: 系统通知管理
- **看板视图**: 项目进度可视化
- **模型配置**: AI模型配置界面

## 技术栈

### 后端
- **框架**: FastAPI (异步Python Web框架)
- **数据库**: SQLite + SQLAlchemy ORM
- **认证**: JWT令牌
- **AI框架**: LangChain + LangGraph
- **数据验证**: Pydantic
- **数据库迁移**: Alembic
- **容器化**: Docker

### 前端
- **框架**: React 19
- **构建工具**: Vite
- **状态管理**: React Hooks
- **样式**: CSS Modules + 响应式设计
- **图标**: React Icons
- **代码质量**: ESLint
- **容器化**: Docker

## 数据库表结构

### 核心表
- `users` - 用户表
- `projects` - 项目表
- `chapters` - 章节表
- `drafts` - 草稿表

### 实体表
- `characters` - 角色表
- `locations` - 地点表
- `organizations` - 组织表
- `worldviews` - 世界观表

### AI相关表
- `model_configs` - AI模型配置表
- `prompt_templates` - 提示词模板表
- `knowledge_base` - 知识库表
- `langgraph_workflows` - LangGraph工作流表
- `langgraph_sessions` - LangGraph会话表
- `ai_generated_content` - AI生成内容表

## 开发命令

### 后端
```bash
cd backend
python main.py                    # 启动开发服务器
pip install -r requirements.txt   # 安装依赖
```

### 前端
```bash
cd frontend
npm run dev                      # 启动开发服务器
npm run build                    # 构建生产版本
npm run lint                     # 代码检查
```

### Docker
```bash
docker-compose up                # 启动完整应用
docker-compose up backend        # 仅启动后端
docker-compose up frontend       # 仅启动前端
```

## API端点

基础路径: `/api`

### 认证
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `GET /auth/me` - 获取当前用户信息

### 项目管理
- `GET /projects/` - 获取项目列表
- `POST /projects/` - 创建项目
- `GET /projects/{id}` - 获取项目详情
- `PUT /projects/{id}` - 更新项目
- `DELETE /projects/{id}` - 删除项目

### 章节管理
- `GET /projects/{project_id}/chapters` - 获取项目章节
- `POST /chapters/` - 创建章节
- `PUT /chapters/{id}` - 更新章节
- `DELETE /chapters/{id}` - 删除章节

### AI功能 (LangChain)
- `POST /ai/chapter-outline` - 生成章节大纲
- `POST /ai/chapter-draft` - 生成章节草稿
- `POST /ai/character-dialogue` - 生成角色对话
- `POST /ai/plot-suggestions` - 获取情节建议
- `POST /ai/workflow` - 创建写作工作流
- `POST /ai/chat` - AI智能体对话

## 环境配置

### 后端环境变量
- `DATABASE_URL` - 数据库连接URL
- `SECRET_KEY` - JWT密钥
- `ALGORITHM` - 加密算法
- `ACCESS_TOKEN_EXPIRE_MINUTES` - 令牌过期时间

### 前端环境变量
- `VITE_API_URL` - 后端API地址

## 部署说明

### 生产环境部署
1. 配置环境变量
2. 构建前端: `npm run build`
3. 使用Docker Compose部署: `docker-compose up -d`
4. 配置反向代理 (如需要)

### 开发环境部署
1. 启动后端: `python main.py`
2. 启动前端: `npm run dev`
3. 访问 `http://localhost:5173`

## 维护说明

### 数据库迁移
```bash
cd backend
alembic upgrade head              # 应用所有迁移
alembic revision --autogenerate -m "描述"  # 创建新迁移
```

### 依赖更新
```bash
# 后端
pip freeze > requirements.txt

# 前端
npm update
npm audit fix
```

## 注意事项

1. **AI功能**: 需要安装LangChain/LangGraph依赖才能使用AI功能
2. **数据库**: 使用SQLite，生产环境建议使用PostgreSQL
3. **安全性**: 生产环境需要配置HTTPS和CORS策略
4. **性能**: 建议使用Redis缓存和CDN优化性能
5. **备份**: 定期备份数据库文件

---
*最后更新: 2025-08-14*