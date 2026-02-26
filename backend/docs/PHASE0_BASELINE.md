# Phase 0 基线文档 — AINovel Backend

> 生成时间: 2026-02-26
> 分支: `refactor/backend-langgraph-v1` (基于 `prompt-management`)

---

## 1. 当前后端路由清单

### 1.1 认证模块 (`routers/auth.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/auth/register` | POST | 无 | `UserResponse` | ✅ 高 |
| `/api/auth/login` | POST | 无 | `Token` | ✅ 高 |
| `/api/auth/me` | GET | JWT | `UserResponse` | ✅ 高 |
| `/api/auth/refresh` | POST | JWT | `Token` | ✅ 高 |

### 1.2 项目管理 (`routers/projects.py`, prefix: `/api/projects`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/` | POST | JWT | `ProjectResponse` | ✅ 高 |
| `/api/projects/` | GET | JWT | `List[ProjectResponse]` | ✅ 高 |
| `/api/projects/{project_id}` | GET | JWT | `ProjectResponse` | ✅ 高 |
| `/api/projects/{project_id}` | PUT | JWT | `ProjectResponse` | ✅ 高 |
| `/api/projects/{project_id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |

### 1.3 章节管理 (`routers/chapters.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/chapters` | POST | JWT | `ChapterResponse` | ✅ 高 |
| `/api/projects/{pid}/chapters` | GET | JWT | `List[ChapterResponse]` | ✅ 高 |
| `/api/chapters/{chapter_id}` | GET | JWT | `ChapterResponse` | ✅ 高 |
| `/api/chapters/{chapter_id}` | PUT | JWT | `ChapterResponse` | ✅ 高 |
| `/api/chapters/{chapter_id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |
| `/api/projects/{pid}/chapters/unpublished` | GET | JWT | dict | ✅ 中 |
| `/api/chapters/batch_update_status` | POST | JWT | `MessageResponse` | ✅ 中 |
| `/api/chapters/batch-publish` | POST | JWT | `BatchPublishResponse` | ✅ 中 |

### 1.4 角色管理 (`routers/characters.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/characters` | POST | JWT | `CharacterResponse` | ✅ 高 |
| `/api/projects/{pid}/characters` | GET | JWT | `List[CharacterResponse]` | ✅ 高 |
| `/api/characters/{id}` | GET | JWT | `CharacterResponse` | ✅ 高 |
| `/api/characters/{id}` | PUT | JWT | `CharacterResponse` | ✅ 高 |
| `/api/characters/{id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |

### 1.5 地点管理 (`routers/locations.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/locations` | POST | JWT | `LocationResponse` | ✅ 高 |
| `/api/projects/{pid}/locations` | GET | JWT | `List[LocationResponse]` | ✅ 高 |
| `/api/locations/{id}` | GET | JWT | `LocationResponse` | ✅ 高 |
| `/api/locations/{id}` | PUT | JWT | `LocationResponse` | ✅ 高 |
| `/api/locations/{id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |

### 1.6 组织管理 (`routers/organizations.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/organizations` | POST | JWT | `OrganizationResponse` | ✅ 高 |
| `/api/projects/{pid}/organizations` | GET | JWT | `List[OrganizationResponse]` | ✅ 高 |
| `/api/organizations/{id}` | GET | JWT | `OrganizationResponse` | ✅ 高 |
| `/api/organizations/{id}` | PUT | JWT | `OrganizationResponse` | ✅ 高 |
| `/api/organizations/{id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |

### 1.7 世界观管理 (`routers/worldviews.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/worldviews` | POST | JWT | `WorldviewResponse` | ✅ 高 |
| `/api/projects/{pid}/worldviews` | GET | JWT | `List[WorldviewResponse]` | ✅ 高 |
| `/api/worldviews/{id}` | GET | JWT | `WorldviewResponse` | ✅ 高 |
| `/api/worldviews/{id}` | PUT | JWT | `WorldviewResponse` | ✅ 高 |
| `/api/worldviews/{id}` | DELETE | JWT | `MessageResponse` | ✅ 高 |

### 1.8 草稿管理 (`routers/drafts.py`)
| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/projects/{pid}/drafts` | POST | JWT | `DraftResponse` | ✅ 中 |
| `/api/projects/{pid}/drafts` | GET | JWT | `List[DraftResponse]` | ✅ 中 |
| `/api/drafts/{id}` | GET | JWT | `DraftResponse` | ✅ 中 |
| `/api/drafts/{id}` | PUT | JWT | `DraftResponse` | ✅ 中 |
| `/api/drafts/{id}` | DELETE | JWT | `MessageResponse` | ✅ 中 |

### 1.9 模型配置 (`routers/model_configs.py`, prefix: `/api/model-configs`)

| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/model-configs/` | POST | JWT | `ModelConfigResponse` | ✅ 高 |
| `/api/model-configs/` | GET | JWT | `List[ModelConfigResponse]` | ✅ 高 |
| `/api/model-configs/{id}` | GET | JWT | `ModelConfigResponse` | ✅ 高 |
| `/api/model-configs/{id}` | PUT | JWT | `ModelConfigResponse` | ✅ 高 |
| `/api/model-configs/{id}` | DELETE | JWT | `MessageResponse` | ✅ 中 |
| `/api/model-configs/test-connection` | POST | JWT | `TestConnectionResponse` | ✅ 中 |
| `/api/model-configs/{id}/test` | POST | JWT | `TestConnectionResponse` | ✅ 中 |
| `/api/model-configs/list-models` | POST | JWT | `List[ModelInfo]` | ✅ 中 |
| `/api/model-configs/{id}/list-models` | POST | JWT | `List[ModelInfo]` | ✅ 中 |

### 1.10 提示词模板 (`routers/prompt_templates.py`, prefix: `/api/prompt-templates`)

| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/prompt-templates/` | GET | JWT | `List[PromptTemplateResponse]` | ✅ 高 |
| `/api/prompt-templates/categories` | GET | JWT | `List[dict]` | ✅ 中 |
| `/api/prompt-templates/` | POST | JWT | `PromptTemplateResponse` | ✅ 高 |
| `/api/prompt-templates/{id}` | GET | JWT | `PromptTemplateResponse` | ✅ 中 |
| `/api/prompt-templates/{id}` | PUT | JWT | `PromptTemplateResponse` | ✅ 中 |
| `/api/prompt-templates/{id}` | DELETE | JWT | `MessageResponse` | ✅ 中 |
| `/api/prompt-templates/{id}/copy` | POST | JWT | `PromptTemplateResponse` | ✅ 中 |
| `/api/prompt-templates/{id}/use` | POST | JWT | dict | ✅ 中 |
| `/api/prompt-templates/initialize-system-templates` | POST | JWT | dict | ⚠️ 管理 |
| `/api/prompt-templates/{id}/preview` | GET | JWT | dict | ✅ 低 |

### 1.11 知识库 (`routers/knowledge.py`, prefix: `/api/knowledge`)

| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/knowledge/characters/{pid}` | GET | JWT | `List[CharacterKnowledgeBase]` | ⚠️ 实验 |
| `/api/knowledge/characters/{pid}/{cid}/relations` | POST | JWT | dict (TODO) | ⚠️ 未实现 |
| `/api/knowledge/worldviews/{pid}` | GET | JWT | `List[WorldviewKnowledgeBase]` | ⚠️ 实验 |
| `/api/knowledge/scenes/{pid}` | GET | JWT | `List[SceneKnowledgeBase]` | ⚠️ 实验 |
| `/api/knowledge/techniques/{pid}` | GET | JWT | `List[WritingTechniqueKnowledgeBase]` | ⚠️ 假数据 |

### 1.12 AI 辅助 (`routers/langchain_ai.py`, prefix: `/api/ai`)

| 路径 | 方法 | 鉴权 | 响应模型 | 前端使用 |
|------|------|------|----------|----------|
| `/api/ai/chapter-outline` | POST | JWT | `ChapterOutlineResponse` | ✅ 高 |
| `/api/ai/chapter-draft` | POST | JWT | `ChapterDraftResponse` | ✅ 高 |
| `/api/ai/character-dialogue` | POST | JWT | `CharacterDialogueResponse` | ✅ 中 |
| `/api/ai/plot-suggestions` | POST | JWT | `PlotSuggestionResponse` | ✅ 中 |
| `/api/ai/writing-workflow` | POST | JWT | `WritingWorkflowResponse` | ✅ 中 |
| `/api/ai/agent-chat` | POST | JWT | `LangGraphAgentResponse` | ✅ 中 |
| `/api/ai/models/available` | GET | JWT | `List[dict]` | ✅ 中 |
| `/api/ai/project-context/{pid}` | GET | JWT | dict | ✅ 中 |
| `/api/ai/chat` | POST | JWT | `ChatResponse` | ✅ 高 |
| `/api/ai/chat-stream` | POST | JWT | SSE StreamingResponse | ✅ 高 |
| `/api/ai/optimize-content` | POST | JWT | `OptimizeContentResponse` | ✅ 中 |
| `/api/ai/creative-ideas` | POST | JWT | `CreativeIdeasResponse` | ✅ 中 |

### 路由统计

| 模块 | 端点数 | 优先级高 | 优先级中 | 实验/未实现 |
|------|--------|----------|----------|-------------|
| 认证 | 4 | 4 | 0 | 0 |
| 项目 | 5 | 5 | 0 | 0 |
| 章节 | 8 | 5 | 3 | 0 |
| 角色 | 5 | 5 | 0 | 0 |
| 地点 | 5 | 5 | 0 | 0 |
| 组织 | 5 | 5 | 0 | 0 |
| 世界观 | 5 | 5 | 0 | 0 |
| 草稿 | 5 | 0 | 5 | 0 |
| 模型配置 | 9 | 4 | 5 | 0 |
| 提示词模板 | 10 | 2 | 6 | 2 |
| 知识库 | 5 | 0 | 0 | 5 |
| AI辅助 | 12 | 4 | 8 | 0 |
| **合计** | **78** | **44** | **27** | **7** |

---

## 2. 数据库表结构

数据库: SQLite (`ainovel.db`), 异步驱动: `aiosqlite`
Alembic 当前版本: `a8f033bea24c` (共2次迁移)

### 2.1 表清单

| 表名 | 说明 | 主要字段 | 外键关系 |
|------|------|----------|----------|
| `users` | 用户表 | id, username, email, password_hash, full_name, avatar_url, is_active | — |
| `projects` | 项目表 | id, name, description, word_count, chapter_count | user_id → users.id |
| `characters` | 角色表 | id, name, description, personality, background, appearance | project_id → projects.id |
| `locations` | 地点表 | id, name, description, geography, culture, history | project_id → projects.id |
| `organizations` | 组织表 | id, name, description, structure, purpose, influence | project_id → projects.id |
| `worldviews` | 世界观表 | id, name, description, rules, magic_system, technology, timeline | project_id → projects.id |
| `chapters` | 章节表 | id, title, content, outline, chapter_number, order_index, word_count, status | project_id → projects.id |
| `drafts` | 草稿表 | id, title, content, tags, word_count | project_id → projects.id |
| `model_configs` | 模型配置表 | id, name, model_type, api_key, model_name, temperature, max_tokens, api_url, proxy_url, enable_proxy... | user_id → users.id |
| `prompt_templates` | 提示词模板表 | id, name, category, template, description, is_system, is_active, usage_count, variables, tags | user_id → users.id (nullable) |
| `langgraph_workflows` | LangGraph工作流表 | id, name, description, workflow_type, status, config_data | project_id → projects.id, model_config_id → model_configs.id |
| `langgraph_sessions` | LangGraph会话表 | id, thread_id, session_data, messages_count | workflow_id → langgraph_workflows.id |
| `ai_generated_content` | AI生成内容表 | id, content_type, title, content, content_metadata, word_count, tokens_used, quality_score, is_approved | project_id, chapter_id, workflow_id, session_id, model_config_id |

### 2.2 Alembic 迁移历史

| 版本 | 说明 | 日期 |
|------|------|------|
| `95ec18802f56` | 初始迁移: 添加 proxy_url 到 model_configs, 移除 chapters 唯一约束 | 2025-08-21 |
| `a8f033bea24c` | 扩展 PromptTemplate 表: 添加 is_system, is_active, usage_count, variables, tags | 2025-08-23 |

---

## 3. 配置项

### 3.1 数据库配置 (`database.py` 硬编码)

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| DATABASE_URL | `sqlite+aiosqlite:///./ainovel.db` | 异步数据库连接 |
| SYNC_DATABASE_URL | `sqlite:///./ainovel.db` | 同步数据库连接(初始化用) |
| pool_pre_ping | True | 连接可用性验证 |
| pool_recycle | 3600 | 连接回收周期(秒) |
| echo | False | SQL日志输出 |

### 3.2 认证配置 (`auth.py`)

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| SECRET_KEY | env `SECRET_KEY` 或硬编码默认值 | JWT签名密钥 |
| ALGORITHM | HS256 | JWT算法 |
| ACCESS_TOKEN_EXPIRE_MINUTES | 43200 (30天) | Token过期时间 |
| 密码加密 | bcrypt (passlib) | 密码哈希方案 |

### 3.3 应用配置 (`main.py`)

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| CORS allow_origins | `["*"]` | 允许所有来源(生产环境需收紧) |
| 服务端口 | 8082 | uvicorn 默认端口 |
| LangChain 加载 | 条件导入, 缺依赖时降级 | AI功能可选 |
| 系统模板 | 启动时自动初始化 | 首次运行写入DB |

### 3.4 Python 依赖 (`requirements.txt`)

| 包 | 用途 | 重构影响 |
|----|------|----------|
| fastapi | Web框架 | 保留 |
| uvicorn | ASGI服务器 | 保留 |
| sqlalchemy[asyncio] | ORM + 异步 | 保留 |
| aiosqlite | SQLite异步驱动 | 保留(requirements.txt 缺失，实际使用中) |
| alembic | 数据库迁移 | 保留 |
| passlib[bcrypt] | 密码加密 | 保留 |
| python-jose[cryptography] | JWT | 保留 |
| python-multipart | 表单解析 | 保留 |
| langchain | LangChain核心 | 重构重点 |
| langgraph | LangGraph核心 | 重构重点 |
| langchain-openai | OpenAI集成 | 保留 |
| langchain-anthropic | Anthropic集成 | 保留 |
| langchain-google-genai | Google AI集成 | 保留 |
| openai | OpenAI SDK | 保留 |
| google-generativeai | Google AI SDK | 保留 |
| anthropic | Anthropic SDK | 保留 |

---

## 4. 风险清单与已知问题

### 4.1 架构层面

| # | 风险项 | 严重度 | 说明 |
|---|--------|--------|------|
| R1 | `langchain_service.py` 底部方法用猴子补丁挂载 | 高 | `chat_with_ai`, `optimize_content` 等方法定义在类外，通过 `LangChainService.xxx = xxx` 挂载，维护困难 |
| R2 | API密钥仅用 base64 编解码 | 高 | `_encrypt_api_key` / `_decrypt_api_key` 实际是 base64，非真正加密 |
| R3 | 全局单例 + 模型缓存无过期 | 中 | `langchain_service` / `langgraph_service` 全局实例，模型缓存 `self.models` 无 TTL |
| R4 | 代理设置污染全局环境变量 | 中 | `os.environ["HTTP_PROXY"]` 在并发请求下会互相覆盖 |

### 4.2 代码层面

| # | 风险项 | 严重度 | 说明 |
|---|--------|--------|------|
| R5 | 知识库路由返回假数据 | 中 | `techniques` 端点返回硬编码示例，`relations` 端点为 TODO |
| R6 | 流式输出大量 debug print | 低 | `chat_with_ai_stream` 中遍布调试日志，生产环境需清理 |
| R7 | CRUD 路由重复 `get_project_for_user` | 低 | 每个资源路由都复制了相同的项目权限校验函数 |
| R8 | schemas.py 缺少 `import json` | 低 | `ModelConfigResponse.parse_stop_sequences` 引用了 json 但未导入 |

---

## 5. 重构执行规范

### 5.1 提交粒度

- 每个 Phase 的每个子步骤完成后提交一次
- 提交信息格式: `refactor(backend): Phase X.Y - 简要描述`
- 不跨 Phase 合并提交

### 5.2 代码规范

- Python 3.10+, 类型注解必须
- 异步优先 (async/await)
- Pydantic v2 风格 (model_dump, from_attributes)
- 路由前缀统一 `/api/`

### 5.3 依赖管理

- requirements.txt 需补充版本锁定
- 缺失依赖: `aiosqlite`, `pydantic[email]` 需显式声明
- LangChain/LangGraph 版本需锁定，避免 breaking change

### 5.4 重构原则

- 前端零感知: 所有现有 API 路径、请求/响应格式保持不变
- 渐进替换: 先新建模块，再迁移路由，最后删除旧代码
- 每步可回滚: 每个 Phase 完成后确保应用可正常启动
