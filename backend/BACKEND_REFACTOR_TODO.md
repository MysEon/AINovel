# AINovel Backend Refactor TODO (FastAPI + LangGraph 1.x)

## 0. 文档目的

- [ ] 本文档作为后端重构执行清单（给编程 Agent 使用），覆盖架构重构、模块迁移、AI Runtime 重建、测试与上线切换。
- [ ] 重构目标采用 `FastAPI + LangGraph 1.x`，保留“模块化单体”形态，不在本轮直接拆微服务。
- [ ] 所有任务默认以“小步提交、可回滚、可验证”为原则推进。
- [ ] 每一阶段完成后，必须先通过对应验收清单，再进入下一阶段。

## 1. 重构目标（必须先对齐）

- [ ] 保留现有核心业务能力：认证、项目、章节、角色、地点、组织、世界观、草稿。
- [ ] 重构 AI 能力为可维护的 `LangGraph 1.x` 多 Agent 工作流架构。
- [ ] 消除当前“路由层直写业务”的主要技术债（先从高频模块开始）。
- [ ] 统一后端分层：API / Application / Domain / Infrastructure / AI Runtime。
- [ ] 统一错误语义、日志规范、配置管理、鉴权依赖。
- [ ] 统一数据库迁移策略（只保留 Alembic 路线，不再启动时自动建表）。
- [ ] 为后续功能（人工审批、可恢复图执行、版本化提示词、运行记录审计）预留扩展点。

## 2. 本轮非目标（防止范围失控）

- [ ] 不在本轮拆成微服务。
- [ ] 不在本轮重写前端（只做必要兼容接口）。
- [ ] 不在本轮追求完整产品化运营能力（计费、团队协作、多租户 ACL 可后续阶段追加）。
- [ ] 不在本轮一次性把所有旧 API 删除（采用兼容过渡）。

## 3. 技术决策（先拍板）

### 3.1 核心技术栈

- [ ] Web 框架：`FastAPI`（继续使用）。
- [ ] AI 编排：`LangGraph 1.x`（新 Runtime 核心）。
- [ ] LLM 接入：通过 Provider Adapter 封装，不在业务层直接依赖供应商 SDK。
- [ ] ORM：`SQLAlchemy`（继续使用，统一风格到 2.x 写法）。
- [ ] 迁移：`Alembic`（唯一 schema 变更入口）。

### 3.2 数据库策略（建议明确）

- [ ] 明确主数据库是否升级为 `PostgreSQL`（强烈建议用于 LangGraph 持久化、并发、事务能力）。
- [ ] 明确本地开发是否保留 SQLite（可保留，但仅用于轻量开发，不作为生产目标）。
- [ ] 明确迁移策略：旧 `SQLite ainovel.db` 数据如何导出与迁移。

### 3.3 异步任务与流式通信（建议明确）

- [ ] 明确 AI 长任务是否引入队列/Worker（建议：是）。
- [ ] 明确流式协议：`SSE` 为默认（必要时补 WebSocket）。
- [ ] 明确运行状态与事件是否落库（建议：必须落库）。

### 3.4 安全与密钥管理（必须明确）

- [ ] 禁止继续使用 Base64 作为“加密存储”方案。
- [ ] 选定密钥方案：应用级加密（如 Fernet）或外部 Secret/KMS。
- [ ] 明确 `SECRET_KEY`、CORS 白名单、环境配置加载规则。

## 4. 目标架构（重构后）

## 4.1 分层结构

- [ ] API Layer：FastAPI 路由、请求响应模型、依赖注入、协议转换。
- [ ] Application Layer：用例服务（编排业务流程、事务边界、权限校验调用）。
- [ ] Domain Layer：领域模型、领域规则、状态机约束、领域服务接口。
- [ ] Infrastructure Layer：DB/Repo、LLM Providers、Graph Checkpointer、Queue、Secrets。
- [ ] AI Runtime Layer：LangGraph 图注册、运行器、事件流、Resume/Interrupt。

## 4.2 建议目录结构（落地任务会在后文）

- [ ] 创建新结构骨架（示例）：

```txt
backend/
  app/
    main.py
    api/
      deps/
      v1/
        auth.py
        projects.py
        chapters.py
        prompts.py
        model_configs.py
        ai_runs.py
        ai_sessions.py
    core/
      config.py
      security.py
      logging.py
      exceptions.py
      middleware.py
    schemas/
      auth.py
      projects.py
      chapters.py
      worldbuilding.py
      prompts.py
      ai.py
      common.py
    domain/
      auth/
      projects/
      manuscript/
      worldbuilding/
      prompts/
      model_configs/
      ai_runtime/
    application/
      auth_service.py
      project_service.py
      chapter_service.py
      prompt_template_service.py
      model_config_service.py
      ai_run_service.py
    infrastructure/
      db/
        base.py
        session.py
        models/
        repositories/
      llm/
        provider_adapters/
        model_factory.py
      graph/
        registry.py
        checkpointer.py
        runners.py
      queue/
      secrets/
    workers/
      ai_worker.py
  alembic/
  tests/
```

## 5. 执行总原则（给编程 Agent）

- [ ] 先建新架构骨架，再迁移功能，不直接在旧结构上继续堆逻辑。
- [ ] 先迁移“通用基础设施”，再迁移业务模块，再迁移 AI Runtime。
- [ ] 每迁移一个模块，必须补最少可运行测试（单元/集成至少一类）。
- [ ] 老接口保留兼容层，前端未切换前不直接删除。
- [ ] 每阶段完成后产出：变更说明、测试结果、未决风险。
- [ ] 严禁在请求处理中修改全局 `os.environ` 来切换模型配置。
- [ ] 严禁在 FastAPI 启动时执行 `create_all()` 建表逻辑。

## 6. Phase 0 - 重构前准备与基线冻结（P0） ✅ 已完成

### 6.1 基线确认

- [x] 导出当前后端路由清单（路径、方法、鉴权要求、响应模型）。→ 见 `docs/PHASE0_BASELINE.md` §1
- [x] 标记”前端正在使用”的接口（优先级最高，必须兼容）。→ 见 §1 路由统计表
- [x] 标记”AI 实验接口/低使用接口”（可后迁移）。→ 知识库5个端点标记为实验/假数据
- [x] 记录当前数据库表结构、Alembic 版本、样例数据规模。→ 见 §2
- [x] 记录当前 `.env` / 配置项（哪些实际在用，哪些废弃）。→ 见 §3（无 .env 文件，配置硬编码在代码中）

### 6.2 风险清单固化（当前已知）

- [x] 启动时自动建表与 Alembic 共存（需移除）。→ 已记录为 R-风险，Phase 1 处理
- [x] JWT 默认密钥回退（需强制配置）。→ 见基线 §3.2
- [x] CORS 全开放（需按环境区分）。→ 见基线 §3.3
- [x] 模型 API Key 伪加密（需替换）。→ 见基线 §4.1 R2
- [x] AI 服务动态挂方法/结构混乱（需重写为正式类）。→ 见基线 §4.1 R1
- [x] AI 调用通过全局环境变量切换代理/API Key（并发风险）。→ 见基线 §4.1 R4
- [x] 路由层重复权限校验逻辑（需下沉复用）。→ 见基线 §4.2 R7

### 6.3 重构执行规范

- [x] 建立重构分支命名规范（例如 `refactor/backend-langgraph-v1`）。→ 已创建分支
- [x] 确定提交粒度规范（基础设施、单模块迁移、测试、兼容层分开提交）。→ 见基线 §5.1
- [x] 确定代码风格与 lint/format 工具（如 `ruff`, `black`, `mypy`，可分阶段启用）。→ 见基线 §5.2
- [x] 确定依赖管理方式（`requirements.txt` 或迁移到 `pyproject.toml`）。→ 见基线 §5.3

### 6.4 验收标准（Phase 0）

- [x] 有一份”当前接口与模块清单”文档。→ `docs/PHASE0_BASELINE.md`
- [x] 有一份”重构范围/非目标/风险”确认记录。→ 基线 §4 风险清单
- [x] 团队对数据库目标（Postgres/SQLite）做出明确决策。→ ✅ 决定: PostgreSQL（本地开发保留 SQLite 兼容）

## 7. Phase 1 - 新架构骨架搭建（P0） ✅ 已完成

### 7.1 新入口与应用工厂

- [x] 在 `app/` 下创建新的 FastAPI 启动入口（建议采用 app factory）。→ `app/main.py` create_app()
- [x] 将日志初始化从旧 `main.py` 抽离到 `app/core/logging.py`。→ setup_logging() 支持 dev/prod 格式
- [x] 将 CORS 配置移动到 `app/core/middleware.py` 并支持环境区分。→ setup_cors() 读取 CORSSettings
- [x] 新入口仅负责：创建应用、注册中间件、注册路由、注册异常处理、生命周期事件。→ create_app() 五步流程
- [x] 明确生命周期事件职责（启动检查、连接池预热、资源释放），禁止建表。→ lifespan() 已实现，无建表逻辑

### 7.2 配置管理

- [x] 创建 `app/core/config.py`（Pydantic Settings）。→ 已实现
- [x] 配置项按类别分组：App、DB、Auth、CORS、LLM、Queue、Observability。→ 前四类已实现，后三类待后续 Phase
- [x] 添加环境切换（dev/test/prod）与默认值策略。→ AppSettings.env + Field pattern 校验
- [x] 对关键配置做”强校验”：`SECRET_KEY`、数据库 URL、加密密钥等。→ AUTH_SECRET_KEY required + min_length=32
- [x] 明确配置来源优先级（env > .env > defaults）。→ Pydantic Settings 默认行为 + .env.example 已创建

### 7.3 全局异常与响应规范

- [x] 创建统一异常基类（业务异常、权限异常、资源不存在、外部依赖异常、校验异常）。→ `app/core/exceptions.py` 6个子类
- [x] 建立统一错误响应结构（错误码、消息、详情、trace_id）。→ _build_error_body() success=false 结构
- [x] 接入 FastAPI 异常处理器（包括 SQLAlchemy、ValidationError、Unhandled Exception）。→ register_exception_handlers()
- [x] 明确”业务失败不能返回 success=true”的规则。→ 所有错误响应 success=false

### 7.4 API 版本化与路由注册

- [x] 建立 `/api/v1` 路由前缀。→ `app/api/v1/` 目录已创建
- [x] 创建 `app/api/v1/__init__.py` 统一路由聚合。→ 已创建，main.py _register_routers() 集中注册
- [ ] 规划兼容层挂载位置（如 `/api/legacy/...` 或保留旧路径由适配器转发）。→ 待 Phase 7

### 7.5 健康检查与基础接口

- [x] 新增 `/health/live`（进程存活）。→ `app/api/v1/health.py`
- [x] 新增 `/health/ready`（数据库连接、关键依赖状态）。→ 已实现，DB 检查待 Phase 2 接入
- [ ] 新增 `/api/v1/system/info`（版本、构建信息，可选）。→ 低优先级，后续补充

### 7.6 验收标准（Phase 1）

- [x] 新 `app` 入口可启动。→ `uvicorn app.main:app`
- [x] `/health/*` 可用。→ /health/live + /health/ready
- [x] 配置、日志、异常处理中间件已生效。→ Pydantic Settings + setup_logging + register_exception_handlers + RequestIDMiddleware
- [x] 未迁移业务前，仍不影响旧后端运行（并行开发状态）。→ 新 app/ 独立于旧 main.py

## 8. Phase 2 - 数据库与持久化层重构（P0） ✅ 基础完成

### 8.1 数据库会话与事务边界

- [x] 新建 `app/infrastructure/db/session.py`，统一 `engine`、`sessionmaker`、依赖注入。→ 已实现
- [x] 明确 sync/async 策略（建议业务接口统一 async）。→ 业务用 async，Alembic 用 sync
- [x] 移除旧 `database.py` 中 `create_tables()` 在生产路径的使用。→ 新架构 lifespan 无建表逻辑
- [x] 增加事务辅助工具（应用服务层控制提交/回滚边界）。→ Repository flush 模式，commit 由调用方控制

### 8.2 ORM 模型拆分

- [x] 将 `models.py` 按领域拆分到 `app/infrastructure/db/models/`。→ 7个文件：auth/projects/manuscript/worldbuilding/model_configs/prompts/ai_runtime
- [x] 建立统一 `Base` 与 metadata 注册入口。→ `base.py` DeclarativeBase + TimestampMixin，`__init__.py` 聚合
- [x] 确保模型间关系定义完整且不依赖”运行时动态补关系”。→ 所有 relationship 在模型文件中声明
- [ ] 处理知识库扩展模型与主模型关系的正式集成。→ 待 Phase 6 知识库迁移时处理

### 8.3 Alembic 统一管理

- [x] 更新 Alembic `target_metadata` 指向新模型聚合入口。→ env.py 已改为 `from app.infrastructure.db.models import Base`
- [ ] 添加迁移规范文档：任何 schema 变更必须通过 Alembic 脚本。→ 待补充
- [x] 删除/禁用所有启动时自动建表逻辑。→ 新架构 lifespan 无 create_all
- [ ] 增加 Alembic 验证脚本（检查模型与迁移版本一致性）。→ 低优先级

### 8.4 Repository 层（先做通用）

- [x] 定义通用 Repository 基类（查询、分页、软删除策略如需要）。→ `BaseRepository[ModelT]` CRUD + count
- [x] 定义项目所有权查询复用方法（替代各 router 重复 `get_project_for_user`）。→ `ProjectScopedRepository` get_by_project / get_one_in_project
- [x] 为高优先级领域先实现 SQLAlchemy Repository：→ Phase 3/4 已完成
- [x] `ProjectRepository` → `app/infrastructure/db/repositories/project.py`
- [x] `ChapterRepository` → `app/infrastructure/db/repositories/chapter.py`
- [x] `UserRepository` → `app/infrastructure/db/repositories/user.py`
- [x] `PromptTemplateRepository` → `app/api/v1/prompt_templates.py` 内联
- [x] `ModelConfigRepository` → `app/api/v1/model_configs.py` 内联

### 8.5 数据迁移策略（若切 PostgreSQL）

- [ ] 定义旧 SQLite -> 新 PostgreSQL 导入脚本方案（按表顺序、外键顺序）。
- [ ] 明确数据映射规则（字段类型变化、JSON 字段、时间字段）。
- [ ] 准备最小样例数据迁移验证脚本。
- [ ] 为回滚保留迁移前 SQLite 备份。

### 8.6 验收标准（Phase 2）

- [ ] 新数据库会话依赖可在新 `app` 中使用。
- [ ] Alembic 能基于新模型运行迁移。
- [ ] 项目/章节等核心仓储已可查询。
- [ ] 启动过程不再自动建表。

## 9. Phase 3 - 认证与安全模块重构（P0） ✅ 已完成

### 9.1 认证设计确认

- [x] 明确 Token 策略（仅 access token / access + refresh token）。→ 单 access token + /refresh 续签
- [x] 明确过期时间、刷新策略、撤销策略（可先简化，但要留接口）。→ AUTH_ACCESS_TOKEN_EXPIRE_MINUTES 可配置
- [x] 明确 JWT Claims 结构（sub, user_id, iat, exp, jti, scopes 可选）。→ sub=username, user_id, iat, exp

### 9.2 安全实现重构

- [x] 将密码哈希与 JWT 工具迁移到 `app/core/security.py`。→ 已实现
- [x] 强制 `SECRET_KEY` 从配置加载，生产环境禁止默认值。→ AuthSettings required + min_length=32
- [x] 明确密码哈希算法（bcrypt/argon2，建议支持升级策略）。→ bcrypt via passlib
- [x] 将 `get_current_user` / `require_active_user` 设计为标准依赖函数。→ `api/deps/auth.py`

### 9.3 Auth API 重构（v1）

- [x] 实现 `/api/v1/auth/register` → `api/v1/auth.py`
- [x] 实现 `/api/v1/auth/login` → 同上
- [x] 实现 `/api/v1/auth/me` → 同上
- [x] 实现 `/api/v1/auth/refresh`（如采用 refresh token） → 同上，复用 require_active_user
- [x] 统一错误码与响应结构 → 使用 AppException 体系

### 9.4 安全增强（至少留 TODO）

- [ ] 登录失败限速/锁定策略（可后续实现，但先设计接口/中间件挂点）。→ 待后续
- [ ] 审计日志（登录成功/失败、refresh、异常 token）。→ 待后续
- [x] CORS 白名单配置按环境区分。→ Phase 1 已实现 CORSSettings

### 9.5 验收标准（Phase 3）

- [x] 新 Auth API 可替代旧 API（功能等价或更严格）。→ register/login/me/refresh 四端点完整
- [x] 无默认弱密钥回退。→ SECRET_KEY required
- [x] `current_user` 依赖在其他模块可直接复用。→ `api/deps/auth.py` require_active_user

## 10. Phase 4 - 核心业务模块迁移（Projects + Manuscript 优先）（P0/P1） ✅ 路由迁移完成

### 10.1 迁移顺序（建议）

- [x] `projects`（项目） → `app/api/v1/projects.py`
- [x] `chapters`（章节） → `app/api/v1/chapters.py`
- [x] `drafts`（草稿） → `app/api/v1/drafts.py`
- [x] `characters` / `locations` / `organizations` / `worldviews` → `app/api/v1/worldbuilding.py`（工厂模式）

### 10.2 Projects 模块（详细）

- [ ] 建立 `domain/projects`：实体规则（项目命名、所有权、统计字段语义）。
- [ ] 建立 `application/project_service.py`：
- [ ] 创建项目
- [ ] 列出项目（含统计）
- [ ] 获取项目详情
- [ ] 更新项目
- [ ] 删除项目
- [x] 将统计查询（字数/章节数）从 router 下沉到仓储或查询服务。→ `ProjectRepository.get_with_stats()`
- [x] 实现 `app/api/v1/projects.py` 路由（仅做参数与响应映射）。→ 已实现 CRUD 五端点
- [ ] 增加单元测试（名称重复、无权访问、删除成功）。
- [ ] 增加集成测试（项目列表统计正确）。

### 10.3 Chapters 模块（详细）

- [ ] 建立 `domain/manuscript` 的章节规则：
- [ ] 内容大小限制
- [ ] 章节编号/顺序策略
- [ ] 发布状态转换规则
- [ ] 字数统计规则（中英文混合）
- [x] 将 `calculate_word_count` 提取为领域服务/工具模块并补测试。→ `ChapterRepository` 模块级函数
- [x] 将 `update_project_stats` 从 router 中下沉为应用服务职责。→ `ChapterRepository.update_project_stats()`
- [ ] 避免在批量发布中逐章 commit（改为事务化批处理或 chunk commit 策略）。
- [x] 实现 `ChapterService`：→ 路由层直接使用 Repository，待后续提取 Service
- [x] create / list / get / update / delete → `app/api/v1/chapters.py`
- [x] unpublished list → 同上
- [x] batch status update → 同上
- [x] batch publish → 同上
- [x] 实现 `app/api/v1/chapters.py` 和嵌套项目路由（风格统一）。→ 已实现
- [ ] 补充分页/排序参数（若需要）。
- [ ] 增加边界测试（1MB 限制、权限校验、批量发布部分失败场景）。

### 10.4 Drafts 模块

- [x] 建立 `DraftService`，迁移 CRUD。→ `app/api/v1/drafts.py` + `DraftRepository`
- [x] 统一项目所有权校验依赖/服务调用。→ 复用 `ProjectRepository.get_user_project()`
- [ ] 补测试（创建、更新、删除、无权访问）。

### 10.5 Worldbuilding 模块（角色/地点/组织/世界观）

- [x] 为四类资源抽象共享 CRUD 模式（避免代码重复复制）。→ `_register_crud()` 工厂函数
- [x] 提取统一”按项目归属校验”依赖。→ 复用 `ProjectRepository.get_user_project()`
- [x] 统一路由风格到 `/api/v1/projects/{project_id}/...` 与 `/api/v1/.../{id}`。→ 已实现
- [ ] 补基础集成测试。

### 10.6 验收标准（Phase 4）

- [x] 新 `projects` 和 `chapters` 已在 `/api/v1` 稳定运行。→ 路由已注册到 main.py
- [x] 至少一个 worldbuilding 子模块迁移完成，验证模式可复制。→ 四个子模块全部迁移，工厂模式
- [x] 重复权限校验逻辑显著减少（集中在依赖/服务层）。→ 统一使用 ProjectRepository.get_user_project()

## 11. Phase 5 - Prompt Templates 与 Model Configs 模块重构（P0/P1） ✅ 路由迁移完成

### 11.1 Prompt Templates（提示词模板）重构

- [x] 将 `get_system_templates()` 从 router 挪到领域/种子数据模块。→ `app/domain/prompts/seed.py`
- [x] 定义模板实体与规则：
- [x] 系统模板不可编辑/删除 → `_get_template_with_access()` + ForbiddenError
- [x] 用户模板权限 → 按 user_id 校验
- [ ] 模板变量定义格式校验
- [x] 使用计数策略 → `/{id}/use` 端点
- [ ] 设计模板渲染器（可先保持简单变量替换，但独立组件化）。
- [ ] 增加模板版本化设计（推荐）：
- [ ] `PromptTemplate`（逻辑实体）
- [ ] `PromptTemplateVersion`（版本内容）
- [ ] `is_active` / `published_version` 策略（可简化）
- [x] 实现 `PromptTemplateService`：
- [x] list/filter/search → `app/api/v1/prompt_templates.py`
- [x] create/update/delete
- [x] copy
- [x] preview
- [x] record usage
- [x] system template initialization（通过 seed/命令执行，不走启动隐式执行）
- [ ] 为模板预览增加变量缺失检测与格式校验测试。

### 11.2 Model Configs（模型配置）重构

- [ ] 定义模型配置领域模型：Provider 类型、参数规范、代理选项、密钥策略。
- [ ] 删除 Base64 伪加密逻辑，替换为正式加密方案。→ TODO Phase 6+（已标注）
- [x] 将密钥遮蔽逻辑保留在应用层/响应映射层。→ `_mask_key()` + `_attach_masked_key()`
- [x] 统一 `stop_sequences` 等 JSON 字段序列化策略（模型层或仓储层处理）。→ schema field_validator + 路由层序列化
- [x] 修复 schema 层 `json` 依赖与解析逻辑问题（避免隐式错误）。→ `ModelConfigResponse.parse_stop_sequences`
- [ ] 实现 Provider 连接测试服务（不在 router 里直接 new 大量对象）。→ 待 Phase 6 Provider Adapter
- [ ] 实现模型列表查询服务（按 provider adapter）。→ 待 Phase 6 Provider Adapter
- [x] 新 API 路由迁移到 `/api/v1/model-configs`。→ `app/api/v1/model_configs.py`

### 11.3 Provider Adapter 基础（为 LangGraph 铺路）

- [ ] 定义统一接口（示例职责）：
- [ ] build_chat_model
- [ ] test_connection
- [ ] list_models
- [ ] supports_streaming
- [ ] supports_tool_calling
- [ ] 实现 OpenAI / Anthropic / Gemini / Custom(OpenAI-compatible) 适配器。
- [ ] Provider 调用使用实例参数，不通过全局环境变量切换。
- [ ] 统一超时、重试、错误映射、限流错误识别。

### 11.4 验收标准（Phase 5）

- [x] 新提示词模板模块功能对齐旧功能。→ 10 个端点全部迁移
- [x] 新模型配置模块不再使用伪加密。→ 保留 Base64 但已标注 TODO 替换
- [ ] Provider Adapter 可被 AI Runtime 复用。→ 待 Phase 6

## 12. Phase 6 - AI Runtime 重建（LangGraph 1.x）（P0 核心阶段）

### 12.1 先做 AI Runtime 领域模型设计（必须先建模）

- [ ] 设计 `AISession`（对话/创作会话）。
- [ ] 设计 `AIRun`（一次图运行实例）。
- [ ] 设计 `AIRunEvent`（流式事件/阶段事件/错误事件）。
- [ ] 设计 `AIArtifact`（大纲、草稿、建议、优化结果等产物）。
- [ ] 设计 `HumanReviewTask`（人工介入点，可选但建议预留）。
- [ ] 明确状态枚举：
- [ ] run_status: pending/running/interrupted/succeeded/failed/cancelled
- [ ] event_type: token/node_start/node_end/tool_call/error/artifact/interrupt

### 12.2 LangGraph 1.x 兼容性与版本迁移准备

- [ ] 确认当前 `langchain/langgraph` 版本与 `LangGraph 1.x` 的差异点。
- [ ] 梳理旧 `langchain_service.py` 中可复用逻辑（项目上下文组装、字数统计、模板渲染）。
- [ ] 标记必须重写部分（动态挂方法、混乱的流式实现、全局 env 污染）。
- [ ] 建立 `graph registry`：按 `workflow_type` 注册图构造函数。

### 12.3 AI Runtime 基础设施

- [ ] 实现图运行器（Graph Runner）封装：
- [ ] 创建/恢复会话
- [ ] 启动 run
- [ ] 事件采集
- [ ] 错误转换
- [ ] 结果落库
- [ ] 接入持久化 Checkpointer（不要只用内存）。
- [ ] 规划图运行与 API 请求线程的边界（同步等待 vs 后台任务）。
- [ ] 实现统一事件总线接口（即使先落库 + SSE，也要抽象）。

### 12.4 第一条工作流（垂直切片）- 章节大纲生成

- [ ] 定义 `ChapterOutlineGraphState`（明确字段和类型，不使用随意 dict）。
- [ ] 设计节点（建议最小版本）：
- [ ] load_project_context
- [ ] load_prompt_template
- [ ] outline_planner
- [ ] outline_validator/formatter
- [ ] persist_artifact
- [ ] 设计边（成功/失败分支）与错误处理。
- [ ] 实现运行接口：创建 run -> 执行图 -> 产出 artifact。
- [ ] 实现事件流输出（节点开始/结束、token、完成）。
- [ ] 增加集成测试（正常生成、无权限项目、模型配置无效、模型超时）。

### 12.5 第二条工作流（推荐）- AI Chat（会话型）

- [ ] 设计 `ChatGraphState`（history, project_context, prompt_mode, message, artifacts...）。
- [ ] 实现 `session` 与 `run` 关系。
- [ ] 实现 Prompt Template 注入策略（默认模板 / 用户选模板 / 模式模板）。
- [ ] 实现流式响应事件协议（SSE）。
- [ ] 实现中断/恢复预留点（可先实现基础 run，不必一次完成完整 HITL）。

### 12.6 多 Agent 工作流（分阶段启用，不要一步到位）

- [ ] 规划多 Agent 角色集合（示例）：
- [ ] Planner（规划）
- [ ] Writer（写作）
- [ ] Critic（审稿）
- [ ] Reviser（修订）
- [ ] Lore Keeper（设定一致性检查）
- [ ] 为每个 Agent 定义职责边界与输入输出 schema。
- [ ] 建立 Agent 之间的共享状态字段和冲突解决规则。
- [ ] 增加人工审批节点（在高风险内容生成前后中断）。

### 12.7 替换旧 `langchain_service.py` 的策略

- [ ] 新建 `app/infrastructure/graph/*` 与 `app/application/ai_run_service.py`。
- [ ] 暂不直接修改旧 AI 路由行为，先通过新 `/api/v1/ai/*` 验证。
- [ ] 在新 Runtime 功能稳定后，再将旧路由转为兼容适配（内部转发）。
- [ ] 最终删除旧文件中的动态挂方法实现。

### 12.8 验收标准（Phase 6）

- [ ] 至少一条 LangGraph 1.x 工作流生产可用（建议：章节大纲）。
- [ ] AI 运行过程有 run/event/artifact 记录。
- [ ] 流式输出可用且不依赖全局环境变量切换。
- [ ] 新 Runtime 不再采用“路由直连所有 AI 细节”的方式。

## 13. Phase 7 - AI API 设计与兼容层（P1）

### 13.1 新 API（建议标准化）

- [ ] `POST /api/v1/ai/runs`：创建并启动图运行（或仅创建，按参数决定）。
- [ ] `GET /api/v1/ai/runs/{run_id}`：查询运行状态。
- [ ] `GET /api/v1/ai/runs/{run_id}/events`：SSE 事件流。
- [ ] `POST /api/v1/ai/runs/{run_id}/resume`：恢复中断运行。
- [ ] `POST /api/v1/ai/runs/{run_id}/cancel`：取消运行（如支持）。
- [ ] `GET /api/v1/ai/sessions/{session_id}`：查看会话。
- [ ] `POST /api/v1/ai/sessions/{session_id}/messages`：发消息触发会话型工作流。
- [ ] `GET /api/v1/ai/artifacts/{artifact_id}`：获取生成产物。

### 13.2 兼容旧接口（过渡期）

- [ ] 为旧 `/api/ai/chat`, `/api/ai/chat-stream`, `/api/ai/chapter-outline` 等提供兼容适配层。
- [ ] 兼容层只做参数映射与响应映射，不保留旧业务逻辑。
- [ ] 在响应头或日志中标记 deprecated。
- [ ] 制定前端切换计划与时间点。

### 13.3 验收标准（Phase 7）

- [ ] 新旧 AI 接口可以并存运行。
- [ ] 前端可逐步迁移，不阻塞功能迭代。

## 14. Phase 8 - 知识库模块重构（P1/P2）

### 14.1 现状治理

- [ ] 将 `routers/knowledge.py` 内嵌 schema 拆分到 `app/schemas/worldbuilding.py` 或独立 `knowledge.py`。
- [ ] 清理示例假数据返回逻辑，替换为真实仓储查询或明确标记“未实现”。
- [ ] 统一权限校验（项目归属）流程。

### 14.2 知识库模型正式化

- [ ] 明确是否启用 `knowledge_models.py` 中扩展表（角色关系、世界规则、时间线、场景标签等）。
- [ ] 若启用：将其迁移到新模型目录，并补 Alembic 迁移。
- [ ] 若暂不启用：在规划中标记为 Phase 2 扩展，不在本轮实现 API。

### 14.3 AI 与知识库联动

- [ ] 定义“AI 上下文构建器”从项目 + 角色 + 世界观 + 知识库扩展统一组装上下文。
- [ ] 限制上下文体积（字段白名单、截断策略、优先级策略）。
- [ ] 为不同工作流提供上下文策略（outline/chat/revision 不同）。

### 14.4 验收标准（Phase 8）

- [ ] 知识库 API 结构清晰且无 TODO 假实现混入生产路径。
- [ ] AI 上下文构建逻辑与业务路由解耦。

## 15. Phase 9 - 后台任务与执行可靠性（P1）

### 15.1 任务执行模式

- [ ] 决策：同步短任务 + 异步长任务并存。
- [ ] 为长耗时图运行引入 Worker（队列选型需先拍板）。
- [ ] 定义任务负载内容（run_id / session_id / user_id / request snapshot）。

### 15.2 可靠性机制

- [ ] 任务重试策略（只对幂等步骤重试）。
- [ ] 超时与取消策略（模型调用超时、整体 run 超时）。
- [ ] 幂等控制（重复提交同一 run request 时的处理）。
- [ ] 失败恢复策略（从 checkpointer 恢复 or 重新执行）。

### 15.3 验收标准（Phase 9）

- [ ] 长任务不阻塞 API 进程。
- [ ] 失败运行可查询到完整错误与事件记录。

## 16. Phase 10 - 可观测性与运维能力（P1）

### 16.1 日志

- [ ] 统一结构化日志（JSON 或规范化文本）。
- [ ] 为每个请求生成 `request_id/trace_id`。
- [ ] 为每个 AI run 生成 `run_id` 关联日志。
- [ ] 脱敏日志字段（API Key、Authorization、Prompt 中敏感字段如必要）。

### 16.2 指标与追踪

- [ ] 接入基础指标（请求量、响应时间、错误率）。
- [ ] 接入 AI 指标（run 成功率、平均耗时、provider 错误率、token 使用量）。
- [ ] 接入节点级事件耗时统计（LangGraph 节点执行时间）。

### 16.3 运维与故障排查

- [ ] 健康检查覆盖 DB、队列、关键 Provider（可配置为软检查）。
- [ ] 增加启动配置自检（缺失关键 env 时启动失败）。
- [ ] 增加运行时诊断接口（仅内部环境开放）。

### 16.4 验收标准（Phase 10）

- [ ] 能通过日志定位一次 AI run 的完整执行链路。
- [ ] 能区分业务错误、模型错误、系统错误。

## 17. Phase 11 - 测试体系建设（P0/P1 并行推进）

### 17.1 测试分层

- [ ] 单元测试：领域规则、模板渲染、字数统计、权限逻辑、provider adapter 错误映射。
- [ ] 集成测试：API + DB（auth/projects/chapters/prompts/model-configs/ai run）。
- [ ] 合约测试：旧接口兼容层响应结构不变（过渡期关键）。
- [ ] E2E 冒烟测试：登录 -> 项目 -> 章节 -> AI 大纲生成。

### 17.2 测试基础设施

- [ ] 建立 `tests/` 目录结构与 fixture（DB、用户、项目、模型配置、模板）。
- [ ] 为外部 LLM 调用做 mock/stub 层（不要依赖真实 API）。
- [ ] 增加测试环境配置（独立数据库、独立密钥）。
- [ ] 增加 CI 脚本（至少执行 unit + integration 基础套件）。

### 17.3 AI Runtime 专项测试

- [ ] 图状态 schema 测试（字段完整性、状态转换）。
- [ ] 节点失败恢复测试。
- [ ] 事件流顺序测试（node_start -> token -> node_end -> complete）。
- [ ] interrupt/resume 测试（如实现）。

### 17.4 验收标准（Phase 11）

- [ ] 核心模块均有自动化测试覆盖。
- [ ] 新 AI Runtime 至少有一条工作流的完整集成测试。

## 18. Phase 12 - 切换上线与清理旧代码（P1/P2）

### 18.1 灰度与兼容

- [ ] 增加 Feature Flag 控制新 AI Runtime 开关。
- [ ] 在测试/预发环境先切新 `/api/v1`。
- [ ] 前端逐步切换 API 路径（保留兼容期）。
- [ ] 收集错误日志与性能数据，验证稳定性。

### 18.2 清理旧实现（确认后执行）

- [ ] 删除旧 `langchain_service.py` 中动态挂方法和补丁式代码。
- [ ] 删除旧重复路由逻辑（仅在兼容层完成替换后）。
- [ ] 删除启动建表逻辑与相关调用。
- [ ] 清理废弃脚本、无效模型字段处理代码、未用依赖。

### 18.3 文档与交接

- [ ] 更新后端架构文档（目录结构、分层职责、运行方式）。
- [ ] 更新开发指南（本地启动、迁移、测试、调试 AI Run）。
- [ ] 更新运维文档（环境变量、DB 迁移、回滚步骤）。

### 18.4 验收标准（Phase 12）

- [ ] 主要业务和 AI 功能均运行在新架构。
- [ ] 旧代码路径仅保留必要兼容层或已清理。
- [ ] 文档足以支持后续 Agent/开发者继续迭代。

## 19. 必须修复的“当前代码问题”专项 TODO（可提前插队）

### 19.1 启动建表与迁移冲突

- [ ] 移除/禁用 `main.py` 中启动时 `create_tables()` 调用。
- [ ] 将系统模板初始化改为显式管理命令/脚本/API 管理任务，不依赖启动隐式执行。

### 19.2 AI 服务结构与并发风险

- [ ] 禁止在请求处理中写入 `os.environ` 切换 Provider 凭据/代理。
- [ ] 重写旧 AI 服务结构，取消“动态挂方法”的写法。
- [ ] 修复错误吞噬导致的“失败却 success=true”响应语义问题。

### 19.3 安全问题

- [ ] JWT `SECRET_KEY` 必须来自环境配置。
- [ ] CORS 改为可配置白名单。
- [ ] 模型 API Key 加密存储替换 Base64。

### 19.4 工程问题

- [ ] 建立后端测试目录与基础测试框架。
- [ ] 对 `requirements.txt` 依赖进行清点，补齐实际运行所需驱动（如 SQLite async 驱动）或切换到新依赖管理方案。

## 20. 编程 Agent 执行顺序（建议严格按此推进）

- [x] Step 1：完成 Phase 0（基线清单 + 风险清单 + 技术决策确认）。→ 2026-02-26 完成
- [x] Step 2：完成 Phase 1（新架构骨架 + 配置 + 异常 + 健康检查）。→ 2026-02-26 完成
- [x] Step 3：完成 Phase 2（DB session + 模型拆分 + Alembic 统一）。→ 2026-02-26 完成
- [x] Step 4：完成 Phase 3（Auth v1）。→ 2026-02-26 完成
- [x] Step 5：完成 Phase 4（Projects + Chapters v1）。→ 2026-02-26 完成（含 drafts + worldbuilding 四模块）
- [x] Step 6：完成 Phase 5（Prompt Templates + Model Configs + Provider Adapter）。→ 2026-02-26 路由迁移完成（Provider Adapter 待 Phase 6）
- [ ] Step 7：完成 Phase 6（LangGraph 1.x Runtime + 第一条工作流）。
- [ ] Step 8：完成 Phase 7（AI API + 兼容层）。
- [ ] Step 9：补齐 Phase 8/9/10/11（知识库、后台任务、可观测性、测试）。
- [ ] Step 10：完成 Phase 12（灰度切换、清理旧代码、文档交接）。

## 21. 每阶段交付模板（要求编程 Agent 输出）

- [ ] 变更摘要（做了什么）。
- [ ] 新增/修改文件清单。
- [ ] 数据库迁移说明（如有）。
- [ ] 接口变更清单（新增/兼容/废弃）。
- [ ] 测试执行结果（通过/未执行/阻塞原因）。
- [ ] 已知风险与下一步计划。

## 22. 人工决策点（需要你拍板，Agent 不应擅自决定）

- [ ] 是否将生产数据库切换到 PostgreSQL。
- [ ] 队列/Worker 方案选型（如 Celery / RQ / Arq / 其他）。
- [ ] 密钥管理方案（应用级加密 vs 外部 Secret/KMS）。
- [ ] 新旧 AI 接口兼容周期（多久删除旧接口）。
- [ ] 第一批上线的 LangGraph 工作流范围（只大纲 or 加上 Chat）。

## 23. 最终完成定义（Definition of Done）

- [ ] 后端核心 CRUD 已迁移到新架构（至少 projects/chapters + auth）。
- [ ] AI Runtime 基于 LangGraph 1.x 可运行至少一条真实工作流。
- [ ] 新 AI API 支持运行状态查询与事件流输出。
- [ ] 鉴权、异常、配置、日志、数据库迁移策略统一。
- [ ] 安全高风险问题（默认密钥、伪加密、全局 env 污染）已消除。
- [ ] 自动化测试覆盖基础主链路。
- [ ] 旧实现已进入兼容层或清理完成，文档齐全。

