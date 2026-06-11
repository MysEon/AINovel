# 前后端联调清单

> 配合后端 FastAPI + LangGraph 1.x 重构，前端适配层联调验证。
> 每条链路标注：✅ 通过 / ❌ 失败 / ⏳ 未测

## 1. Auth 链路

| 链路         | 前端入口                         | 后端端点                       | 状态 |
| ------------ | -------------------------------- | ------------------------------ | ---- |
| 登录         | `authService.login()`          | `POST /api/v1/auth/login`    | ✅   |
| 注册         | `authService.register()`       | `POST /api/v1/auth/register` | ✅   |
| 获取当前用户 | `authService.getCurrentUser()` | `GET /api/v1/auth/me`        | ✅   |
| Token 刷新   | `authService.refreshToken()`   | `POST /api/v1/auth/refresh`  | ✅   |
| 401 自动登出 | `apiClient → onUnauthorized`  | 任意 401 响应                  | ✅   |

## 2. Projects 链路

| 链路     | 前端入口                           | 后端端点                          | 状态 |
| -------- | ---------------------------------- | --------------------------------- | ---- |
| 项目列表 | `projectService.getProjects()`   | `GET /api/v1/projects/`         | ⏳   |
| 创建项目 | `projectService.createProject()` | `POST /api/v1/projects/`        | ⏳   |
| 获取项目 | `projectService.getProject(id)`  | `GET /api/v1/projects/{id}/`    | ⏳   |
| 更新项目 | `projectService.updateProject()` | `PUT /api/v1/projects/{id}/`    | ⏳   |
| 删除项目 | `projectService.deleteProject()` | `DELETE /api/v1/projects/{id}/` | ⏳   |

## 3. Chapters 链路

| 链路       | 前端入口                                    | 后端端点                                           | 状态 |
| ---------- | ------------------------------------------- | -------------------------------------------------- | ---- |
| 章节列表   | `chapterService.getChapters()`            | `GET /api/v1/projects/{id}/chapters`             | ⏳   |
| 创建章节   | `chapterService.createChapter()`          | `POST /api/v1/projects/{id}/chapters`            | ⏳   |
| 获取章节   | `chapterService.getChapter()`             | `GET /api/v1/chapters/{id}`                      | ⏳   |
| 更新章节   | `chapterService.updateChapter()`          | `PUT /api/v1/chapters/{id}`                      | ⏳   |
| 删除章节   | `chapterService.deleteChapter()`          | `DELETE /api/v1/chapters/{id}`                   | ⏳   |
| 发布章节   | `chapterService.publishChapter()`         | `PUT /api/v1/chapters/{id}`                      | ⏳   |
| 批量发布   | `chapterService.batchPublishChapters()`   | `POST /api/v1/chapters/batch-publish`            | ⏳   |
| 未发布列表 | `chapterService.getUnpublishedChapters()` | `GET /api/v1/projects/{id}/chapters/unpublished` | ⏳   |

## 4. Model Configs 链路

| 链路         | 前端入口                                | 后端端点                                       | 状态 |
| ------------ | --------------------------------------- | ---------------------------------------------- | ---- |
| 配置列表     | `modelConfigService.getConfigs()`     | `GET /api/v1/model-configs/`                 | ⏳   |
| 创建配置     | `modelConfigService.createConfig()`   | `POST /api/v1/model-configs/`                | ⏳   |
| 测试连接     | `modelConfigService.testConnection()` | `POST /api/v1/model-configs/test-connection` | ⏳   |
| 获取模型列表 | `modelConfigService.listModels()`     | `POST /api/v1/model-configs/list-models`     | ⏳   |

## 5. Prompt Templates 链路

| 链路           | 前端入口                                      | 后端端点                                                      | 状态 |
| -------------- | --------------------------------------------- | ------------------------------------------------------------- | ---- |
| 模板列表       | `promptService.getTemplates()`              | `GET /api/v1/prompt-templates/`                             | ⏳   |
| 分类列表       | `promptService.getCategories()`             | `GET /api/v1/prompt-templates/categories`                   | ⏳   |
| 预览模板       | `promptService.previewTemplate()`           | `GET /api/v1/prompt-templates/{id}/preview`                 | ⏳   |
| 初始化系统模板 | `promptService.initializeSystemTemplates()` | `POST /api/v1/prompt-templates/initialize-system-templates` | ⏳   |

## 6. Knowledge 链路

| 链路       | 前端入口                                     | 后端端点                                             | 状态 |
| ---------- | -------------------------------------------- | ---------------------------------------------------- | ---- |
| 项目上下文 | `knowledgeService.getProjectContext()`     | `GET /api/v1/knowledge/projects/{id}/context`      | ⏳   |
| 上下文文本 | `knowledgeService.getProjectContextText()` | `GET /api/v1/knowledge/projects/{id}/context/text` | ⏳   |
| 兼容旧接口 | `knowledgeService.getKnowledgeModule()`    | 内部调用 `getProjectContext`                       | ⏳   |

## 7. AI 旧接口兼容链路（compat layer → `/api/ai/*`）

| 链路        | 前端入口                               | 后端端点                          | 状态 |
| ----------- | -------------------------------------- | --------------------------------- | ---- |
| AI 对话     | `aiService.chat()`                   | `POST /api/ai/chat`             | ⏳   |
| AI 流式对话 | `aiService.chatStream()`             | `POST /api/ai/chat-stream`      | ⏳   |
| 章节大纲    | `aiService.generateChapterOutline()` | `POST /api/ai/chapter-outline`  | ⏳   |
| 章节草稿    | `aiService.generateChapterDraft()`   | `POST /api/ai/chapter-draft`    | ⏳   |
| 内容优化    | `aiService.optimizeContent()`        | `POST /api/ai/optimize-content` | ⏳   |
| 创意点子    | `aiService.getCreativeIdeas()`       | `POST /api/ai/creative-ideas`   | ⏳   |

## 8. AI Runtime 新链路（v1 → `/api/v1/ai/*`）

| 链路          | 前端入口                                  | 后端端点                             | 状态 |
| ------------- | ----------------------------------------- | ------------------------------------ | ---- |
| 工作流类型    | `aiRuntimeService.getWorkflowTypes()`   | `GET /api/v1/ai/workflow-types`    | ⏳   |
| 创建 Run      | 章节大纲等触发                            | `POST /api/v1/ai/chapter-outline`  | ⏳   |
| 查询 Run      | `aiRuntimeService.getRun()`             | `GET /api/v1/ai/runs/{id}`         | ⏳   |
| Run 列表      | `aiRuntimeService.listRuns()`           | `GET /api/v1/ai/runs`              | ⏳   |
| 取消 Run      | `aiRuntimeService.cancelRun()`          | `POST /api/v1/ai/runs/{id}/cancel` | ⏳   |
| SSE 事件流    | `aiRuntimeService.subscribeRunStream()` | `GET /api/v1/ai/runs/{id}/stream`  | ⏳   |
| 获取 Session  | `aiRuntimeService.getSession()`         | `GET /api/v1/ai/sessions/{id}`     | ⏳   |
| 获取 Artifact | `aiRuntimeService.getArtifact()`        | `GET /api/v1/ai/artifacts/{id}`    | ⏳   |

## 9. 错误场景验证

| 场景              | 预期行为                                          | 状态 |
| ----------------- | ------------------------------------------------- | ---- |
| Token 过期 → 401 | 自动登出，跳转登录页                              | ⏳   |
| 后端 500 错误     | `normalizeApiError` 提取 trace_id，显示友好提示 | ⏳   |
| 网络断开          | 显示网络错误提示                                  | ⏳   |
| 模型配置错误      | AI 接口返回明确错误信息                           | ⏳   |
| SSE 连接中断      | `onError` 回调触发，前端可重试                  | ⏳   |

## 10. 联调问题记录

| # | 接口 | 问题描述       | 归属           | 状态 |
| - | ---- | -------------- | -------------- | ---- |
| - | -    | （联调时填写） | 前端/后端/契约 | -    |
