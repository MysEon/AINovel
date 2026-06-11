# 工作规划文件 (Work Planning File)

## 工作记录

### 2025-08-21
- 创建工作规划文件 (WORK_PLAN.md)
- 添加工作规划规则到 CLAUDE.md
- 更新 WORK_PLAN.md 记录本次工作
- 添加大型项目需求分析规划到 WORK_PLAN.md
- 在 CLAUDE.md 中添加大型项目需求分析规则

## 规则
每次编写代码时都要更新此工作规划文件，记录：
1. 工作日期
2. 完成的任务
3. 修改的文件
4. 重要的决策或变更

## 大型项目需求分析规划

### 大型项目处理流程
1. **需求分析** - 深入理解项目需求，确定功能范围
2. **步骤划分** - 将大型需求分解为可执行的步骤
3. **写入规划** - 在此文件中记录完整的项目规划
4. **逐步实施** - 按照规划的步骤进行实施
5. **持续更新** - 每完成一个步骤都要更新此文件

### 大型项目规划模板
```
### [项目名称] - [开始日期]
**需求描述**：[详细描述项目需求]

**实施步骤**：
1. [步骤1描述]
2. [步骤2描述]
3. [步骤3描述]
...

**预期成果**：[描述项目完成后的预期成果]

**相关文件**：[列出项目涉及的主要文件]
```

### 当前大型项目规划

### Markdown渲染系统优化 - 2025-08-22
**需求描述**：参考Cherry Studio的成熟markdown处理思想，优化AINovel项目的markdown渲染系统。重点改进流式渲染的平滑性、增强格式化智能度、扩展插件支持，同时保持langchain框架不变。

**实施步骤**：
1. ✅ 创建新分支 `markdown-rendering-optimization`
2. ✅ 读取Cherry Studio的markdown处理流程分析报告
3. ✅ 分析当前AINovel项目的markdown处理流程
4. ✅ 研究Cherry Studio的关键实现特性
5. ✅ 设计优化方案（保持langchain框架）
6. ✅ 实现平滑流式渲染Hook (useSmoothStream)
7. ✅ 增强markdown插件系统
8. ✅ 优化AI响应格式化处理
9. ✅ 实现自定义markdown组件
10. ✅ 集成性能优化（RAF、缓存等）
11. ✅ 集成所有优化到WritingEditor组件
12. ✅ 测试和验证改进效果 - 构建成功，无错误

### 工作成果总结 - 2025-08-22
**已完成的优化**：
- ✅ 创建了 `useSmoothStream` Hook，实现字符级平滑渲染
- ✅ 开发了 `EnhancedMarkdown` 组件，支持多种插件和自定义组件
- ✅ 实现了智能AI响应格式化工具 (`aiResponseFormatter.js`)
- ✅ 集成了性能优化工具集 (`performanceOptimizer.js`)
- ✅ 创建了自定义markdown组件：CodeBlock、Table、Link、Quote、MathBlock
- ✅ 升级了WritingEditor组件，集成所有新功能
- ✅ 安装了必要的依赖：remark-math、rehype-katex、katex、rehype-raw
- ✅ 构建测试通过，无错误

**技术亮点**：
- 保持了原有langchain框架完整性
- 基于Cherry Studio的成熟设计理念
- 智能的流式文本处理和安全拼接
- RAF优化的平滑渲染效果
- 丰富的markdown语法支持（数学公式、表格、代码高亮等）
- LRU缓存和智能更新策略
- 完整的性能监控和优化工具

**问题修复 - 2025-08-22 晚间**：
🐛 **修复过度分行问题**
- 问题：AI回复渲染时出现过多不必要的换行，影响阅读体验
- 原因：`enhancedFormatAIResponse` 函数的分段规则过于激进
- 解决方案：
  - 调整中文句子分割阈值（从10字符提升到20字符）
  - 更精确的列表项匹配（增加15字符最小长度限制）
  - 禁用加粗文本的强制分行
  - 更保守的引用块和关键词处理
  - 新增单独换行清理规则，将不必要的换行合并为空格
  - 严格控制最大连续换行数（不超过2个）
- 结果：✅ 构建通过，渲染格式显著改善

**Streamdown理念融合 - 2025-08-22 深夜**：
🚀 **成功融合Streamdown的核心设计理念**
- 背景：发现Streamdown开源项目，专门为AI流式渲染设计的markdown组件
- 问题：由于Windows防御系统误报，无法直接安装streamdown包
- 解决方案：
  - 深度分析Streamdown源码，提取核心设计理念
  - 创建 `incompleteMarkdownHandler.js` - 专门处理不完整markdown语法
  - 集成块级解析功能 - 将markdown分解为独立块渲染
  - 增强EnhancedMarkdown组件，支持不完整markdown自动补全
  - 实现智能格式标记补全（`**`, `*`, `__`, `` ` ``, `~~`, `$`, `$$`等）
  - 添加不完整链接和图片的智能处理
- 新功能亮点：
  - ✅ 自动补全未闭合的格式标记，避免渲染错误
  - ✅ 智能识别代码块边界，防止误处理
  - ✅ 块级独立渲染，提升流式输入性能
  - ✅ 完全兼容现有架构，无破坏性变更
**Streamdown官方集成 - 2025-08-22 最终版**：
🎯 **成功集成官方Streamdown包**
- 背景：在处理杀毒软件问题后，最终选择使用官方Streamdown包
- 优势：获得专业团队维护的完整功能和持续更新
- 集成内容：
  - ✅ 安装streamdown@1.0.12官方包
  - ✅ 替换自制组件为官方Streamdown组件
  - ✅ 配置专属CSS样式优化聊天界面显示
  - ✅ 保持原有的流式文本处理逻辑
  - ✅ 启用不完整markdown自动处理功能
- 技术特性：
  - 🚀 专业的AI流式markdown渲染
  - 🔄 自动处理不完整的格式标记
  - 🎨 Shiki代码高亮支持
  - 📊 GitHub风格markdown全支持
  - 🔢 KaTeX数学公式渲染
  - 🛡️ 内置安全性保护

**Streamdown完全替换 - 2025-08-23 最终版**：
🚀 **成功完全替换为官方Streamdown**
- 背景：按照Streamdown官方README文档规范，完全替换项目中的markdown渲染系统
- 替换范围：
  - ✅ 移除所有自制markdown组件：EnhancedMarkdown、CodeBlock、Table、Link、Quote、MathBlock等
  - ✅ 删除自制工具：useSmoothStream Hook、incompleteMarkdownHandler、performanceOptimizer
  - ✅ 清理不再需要的依赖：react-markdown、rehype-*、remark-*、highlight.js、katex等9个包
  - ✅ 简化aiResponseFormatter.js，只保留基本的流式文本拼接功能
- 官方API集成：
  - ✅ 使用标准的Streamdown组件：`<Streamdown parseIncompleteMarkdown={true} className="ai-chat-content streamdown-chat" shikiTheme="github-light">`
  - ✅ 启用不完整markdown自动解析：`parseIncompleteMarkdown={true}`
  - ✅ 配置GitHub Light主题：`shikiTheme="github-light"`
  - ✅ 应用专属CSS类名：`className="ai-chat-content streamdown-chat"`
  - ✅ 修正导入方式：使用命名导入 `import { Streamdown } from 'streamdown';`
- 功能特性：
  - 🔄 专业的AI流式markdown渲染（官方专业实现）
  - 🎨 自动处理不完整格式标记（`**`、`*`、`` ` ``、`~~`、`$`等）
  - 📊 完整GitHub风格markdown支持（表格、任务列表、删除线）
  - 🔢 KaTeX数学公式渲染（LaTeX方程式）
  - 🎯 Shiki代码语法高亮（美观的代码块）
  - 🛡️ harden-react-markdown安全保护（内置安全防护）
  - ⚡ 记忆化渲染优化（高效更新性能）
- 简化架构：
  - 📦 依赖大幅减少：从17个markdown相关依赖减少到1个streamdown
  - 🗂️ 代码结构简化：删除6个自制组件文件和3个工具文件
  - 🔧 维护成本降低：使用专业团队维护的成熟方案
  - 🚀 性能提升：官方优化的渲染引擎

**Streamdown流式渲染问题完全解决 - 2025-08-23**：
🎉 **成功解决AI流式回复显示原始markdown的根本问题**
- 问题定位：通过调试发现AI返回内容包含未闭合的代码块标记(```),导致Streamdown将整个内容识别为代码块
- 根本原因：流式传输特性导致代码块的开始标记(```)先传输,结束标记后传输,中间状态造成markdown解析错误
- 解决方案：
  - ✅ 检测代码块标记数量：`(content.match(/```/g) || []).length`
  - ✅ 自动补全未闭合代码块：如果标记数量为奇数,自动添加结束标记`\n```'`
  - ✅ 应用到正式渲染：集成到Streamdown组件的content处理逻辑中
- 技术实现：
  ```javascript
  {(() => {
    let content = message.content || '';
    const codeBlockCount = (content.match(/```/g) || []).length;
    if (codeBlockCount % 2 === 1) {
      content = content + '\n```';
    }
    return content;
  })()}
  ```
- 测试结果：✅ 完美解决
  - markdown标题、粗体、列表正确渲染
  - Python代码块有完整语法高亮
  - 不再将整个内容误判为代码块
- 最终配置：
  ```jsx
  <Streamdown 
    key={message.id}
    parseIncompleteMarkdown={true}
    className="ai-chat-content streamdown-chat"
    shikiTheme="github-light"
  >
  ```

**彻底简化处理逻辑 - 2025-08-23**：
🔥 **移除所有中间处理，完全原始数据给Streamdown**
- 问题：用户强调AI回复仍显示原始markdown，质疑是否做了多余处理
- 用户要求：所有AI回复不处理直接给Streamdown
- 简化行动：
  - ✅ 移除aiResponseFormatter导入：不再导入processStreamChunk
  - ✅ 移除所有相关注释和说明
  - ✅ 简化React key：从动态key改为固定message.id
  - ✅ 移除parseIncompleteMarkdown选项：让Streamdown使用默认行为
  - ✅ 确认流式逻辑：chunk直接拼接，无任何额外处理
- 当前流式逻辑：
  ```javascript
  currentContentRef.current = isFirstChunk ? chunk : currentContentRef.current + chunk;
  ```
- Streamdown组件：
  ```jsx
  <Streamdown key={message.id} className="ai-chat-content streamdown-chat" shikiTheme="github-light">
    {message.content}
  </Streamdown>
  ```
- 状态：🔄 极简版本已部署，等待测试

**Tailwind CSS PostCSS修复 - 2025-08-23**：
🔧 **解决Tailwind CSS v4 PostCSS插件错误**
- 问题：PostCSS错误提示需要安装`@tailwindcss/postcss`插件
- 原因：Tailwind CSS v4将PostCSS插件分离到独立包中
- 解决方案：
  - ✅ 安装正确的PostCSS插件：`npm install -D @tailwindcss/postcss`
  - ✅ 更新postcss.config.js使用新插件：`'@tailwindcss/postcss': {}`
  - ✅ 移除旧的`tailwindcss: {}`配置
- 结果：✅ 开发服务器成功启动，无PostCSS错误

**Tailwind CSS集成 - 2025-08-23**：
🎨 **添加Tailwind CSS支持以正确使用Streamdown**
- 背景：Streamdown推荐使用`@source`指令导入CSS，但该指令仅在Tailwind CSS项目中有效
- 用户要求：添加Tailwind CSS支持以获得完整的Streamdown功能
- 实施步骤：
  - ✅ 安装Tailwind CSS依赖：`npm install -D tailwindcss postcss autoprefixer`
  - ✅ 创建tailwind.config.js配置文件
  - ✅ 创建postcss.config.js配置文件
  - ✅ 更新index.css添加Tailwind指令：`@tailwind base; @tailwind components; @tailwind utilities;`
  - ✅ 添加正确的Streamdown CSS导入：`@source "../node_modules/streamdown/dist/index.js";`
  - ✅ 备份原有CSS文件（index.css.backup）
- 技术配置：
  - Tailwind CSS v4.1.12（最新版本）
  - PostCSS + Autoprefixer自动处理
  - Vite自动识别和处理Tailwind指令
  - 保留Antd和KaTeX的CSS导入
- 兼容性：
  - 保持现有组件样式不受影响
  - Antd组件继续正常工作
  - 现有CSS文件保持兼容
- 状态：✅ 开发服务器成功启动，无CSS错误

**流式渲染修复 - 2025-08-23**：
🔧 **解决AI流式回复显示原始markdown问题**
- 问题：用户反馈AI的流式输出显示为原始markdown源码而不是渲染后的格式
- 分析：静态消息能正确渲染，但流式更新的内容无法被Streamdown正确处理
- 原因：React组件在频繁内容更新时，Streamdown可能没有正确重新渲染
- 解决方案：
  - ✅ 恢复简洁的默认消息，避免复杂测试内容干扰
  - ✅ 添加动态key属性：`key={streamdown-${message.id}-${message.content?.length || 0}}`
  - 策略：基于消息ID和内容长度生成唯一key，强制React在内容变化时重新创建Streamdown组件
- 技术细节：
  - 每次流式内容更新时，content.length变化会触发组件重新挂载
  - 重新挂载确保Streamdown能正确解析最新的markdown内容
  - 保持parseIncompleteMarkdown={true}以处理流式输入的不完整语法
- 状态：🔄 等待测试 - 需要验证流式AI回复是否能正确渲染markdown

**Streamdown CSS导入修复 - 2025-08-23**：
🔧 **修正CSS导入问题**
- 问题：用户反馈Streamdown仍显示为纯文本，代码块语法错误
- 发现：README中提到的`@source`指令只适用于Tailwind CSS项目
- 解决方案：
  - ✅ 移除无效的`@source`指令（非Tailwind项目不支持）
  - ✅ 添加KaTeX CSS导入：`@import 'katex/dist/katex.min.css';`
  - ✅ 确保Streamdown组件正确配置：
    - parseIncompleteMarkdown={true}
    - className="ai-chat-content streamdown-chat"  
    - shikiTheme="github-light"
- 技术细节：
  - 项目未使用Tailwind CSS，因此不需要特殊的@source指令
  - Streamdown内置了所有必要的样式和组件
  - KaTeX CSS导入确保数学公式正确渲染
- 状态：🔄 测试中 - 需要验证markdown渲染和代码块语法是否正确

**预期成果**：
- 平滑的字符级流式渲染效果
- 智能的AI回复格式化
- 丰富的markdown语法支持（数学公式、表格、引用等）
- 更好的用户体验和渲染性能
- 保持与现有langchain架构的兼容性

**相关文件**：
- `frontend/src/services/aiService.js` - AI服务层
- `frontend/src/components/writing/WritingEditor.jsx` - 写作编辑器
- `frontend/src/hooks/` - 新增平滑渲染Hook
- `frontend/src/components/markdown/` - 新增markdown组件目录
- `markdown处理流程分析报告.md` - 参考分析报告

### 提示词管理功能开发 - 2025-08-23

**需求描述**：实现用户可自定义的提示词管理功能，让用户完全控制AI写作助手的各种prompt模板，包括大纲生成、建议提供、优化改进、创意生成等功能的提示词。

**功能范围分析**：
1. **当前系统prompt使用情况**：
   - 章节大纲生成 (generateChapterOutline)
   - 情节发展建议 (getPlotSuggestions) 
   - 内容优化 (optimizeContent)
   - 创意生成 (generateCreativeIdeas)
   - AI聊天对话 (chatWithAI)
   - 写作建议 (getWritingSuggestions)
   - 辅助优化型/全面接管型模式

2. **需要实现的功能**：
   - 提示词模板的CRUD操作
   - 分类管理（大纲、建议、优化、创意、对话等）
   - 模板变量支持（项目信息、章节内容等）
   - 用户个人模板库
   - 默认系统模板
   - 模板预览和测试功能

**实施步骤**：
1. ✅ 分析现有PromptTemplate表结构
2. ✅ 创建prompt-management特性分支
3. ✅ 扩展数据库模型，支持更完善的提示词管理
4. ✅ 实现后端提示词管理API
5. ✅ 创建前端提示词管理组件
6. ✅ 集成到模型参数选择界面
7. ✅ 修改为正常页面形式而非弹窗模式
8. ✅ 测试提示词管理功能

**技术实现要点**：
- 数据库：扩展PromptTemplate表，增加is_system、is_active、usage_count、variables、tags等字段
- 后端API：完整的CRUD操作，支持系统模板和用户模板分离，模板复制和预览功能
- 前端组件：采用正常页面形式，提供搜索、分类过滤、批量操作等功能
- 变量系统：支持{{变量名}}格式的模板变量定义和替换
- 权限控制：系统模板只读，用户模板可编辑删除

**功能特色**：
- 6个预定义系统模板：章节大纲生成、情节发展建议、内容优化改进、创意灵感生成、AI写作助手对话、写作技巧建议
- 支持模板复制、预览、使用次数统计
- 分类管理和标签系统
- 变量化模板支持，可以根据项目信息动态填充
- 用户友好的界面，支持搜索和筛选

**相关文件**：
- backend/models.py (扩展PromptTemplate模型)
- backend/routers/prompt_templates.py (新建API路由)
- frontend/src/components/PromptManager.jsx (新建管理组件)
- frontend/src/services/aiService.js (修改AI服务支持自定义模板)
- frontend/src/components/ProjectEditor.jsx (集成到项目界面)

## M1 数据库地基 + AI Runtime 表迁移 + 外键索引 + N+1 防护 — 2026-06-11

### 完成内容
1. **Phase 1: Alembic 基线迁移**
   - 新建 `alembic/versions/0001_baseline_schema.py`，含 13 张核心表的 `create_table`
   - 旧迁移（95ec18802f56 / a8f033bea24c / b3e7a1c9d042 / d9f7c1b2e4aa）upgrade/downgrade 置空，down_revision 接链到 0001
   - 解决新环境 `alembic upgrade head` 无法建表的问题（DL-001）

2. **Phase 2: AI Runtime 5 张表迁移**
   - 新建 `alembic/versions/0002_ai_runtime_tables.py`
   - 创建 `ai_runs`、`ai_run_events`、`ai_generated_content`、`langgraph_workflows`、`langgraph_sessions`
   - `down_revision` 指向旧链末端 `d9f7c1b2e4aa`（AI-001）

3. **Phase 3: 外键索引**
   - 新建 `alembic/versions/0003_foreign_key_indexes.py`
   - 为 projects / characters / locations / organizations / worldviews / chapters / model_configs / prompt_templates / ai_generated_content 的高频外键列加索引
   - 增加 chapters 复合索引 `(project_id, status, order_index)`（DL-002）

4. **Phase 4: 小型清理**
   - `manuscript.py`: `Text(1000000)` → `Text`，`Text(50000)` → `Text`（DL-005）
   - `ai_runtime.py`: `server_default="now()"` → `server_default=func.now()`（DL-009）
   - `models/__init__.py`: 补导入 `AIRun`、`AIRunEvent`

5. **Phase 5: conftest 修复**
   - 修正 `tests/conftest.py` 错误导入路径（DL-013）
   - 修正 `test_user` fixture 字段名 `hashed_password` → `password_hash`
   - `auth_headers` 改为独立注册/登录，避免跨测试用户冲突

6. **Phase 6: N+1 防护**
   - `BaseRepository.get_all` 增加可选 `load_options` 参数
   - `ProjectScopedRepository.get_by_project` 增加可选 `load_options`
   - `ProjectRepository.get_user_project` 默认 `selectinload(Project.chapters)`
   - `ChapterRepository.get_by_project` 默认 `selectinload(Chapter.project)`（DL-006）

7. **Phase 7: 测试**
   - `test_alembic_migration.py`（5 用例）：空 DB upgrade head、AI Runtime 表存在、外键索引存在、downgrade base、幂等性
   - `test_projects.py`（7 用例）：CRUD + 跨用户权限 + 字数统计
   - `test_chapters.py`（7 用例）：CRUD + 批量发布单事务回滚验证 + 项目字数自动更新
   - `test_ai_runtime.py`（3 用例）：AIRun 创建查询、chapter_outline mock 工作流、事件顺序
   - 既有 `test_auth.py` 修复 3 处错误断言/字段
   - **全部 29 个集成测试通过**

8. **事务一致性修复**
   - `app/api/v1/chapters.py:batch_publish_chapters` 移除循环内逐章 commit，改为单事务统一 flush + commit，异常时 rollback（DL-003 最痛点收敛）

### 修改文件
- `app/infrastructure/db/models/__init__.py`
- `app/infrastructure/db/models/manuscript.py`
- `app/infrastructure/db/models/ai_runtime.py`
- `app/infrastructure/db/repositories/base.py`
- `app/infrastructure/db/repositories/project.py`
- `app/infrastructure/db/repositories/chapter.py`
- `app/api/v1/chapters.py`
- `tests/conftest.py`
- `tests/integration/test_auth.py`
- `alembic/versions/0001_baseline_schema.py`（新建）
- `alembic/versions/0002_ai_runtime_tables.py`（新建）
- `alembic/versions/0003_foreign_key_indexes.py`（新建）
- `alembic/versions/95ec18802f56_initial_migration.py`
- `alembic/versions/a8f033bea24c_扩展prompttemplate表支持提示词管理功能.py`
- `alembic/versions/b3e7a1c9d042_扩展character表新增角色参数字段.py`
- `alembic/versions/d9f7c1b2e4aa_扩展character表新增extra_attributes字段.py`

## 待办事项
- [ ] 设置工作规划模板
- [ ] 定义工作记录格式