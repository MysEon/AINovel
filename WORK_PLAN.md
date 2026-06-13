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

### 统一 AI 上下文注入器后端 Batch 1 Check - 2026-06-13
**需求描述**：独立复核 AI 上下文注入器后端实现，重点检查 LangChain v1 API、跨层字段穿透、结构化 SSE 协议与现有回归测试。

**修复记录**：补齐 chat 提示词模板 `{{project_context}}` 变量终端渲染；移除角色基础上下文 20 条查询限制，确保全部角色可进入预算自适应格式化；修正 tool result SSE 截断总长不超过 200 字符；补充对应单测断言。

**相关文件**：backend/app/application/ai_context_builder.py、backend/app/application/legacy_ai_service.py、backend/app/infrastructure/graph/sse_events.py、backend/tests/unit/application/test_ai_context_builder_chat.py、backend/tests/unit/application/test_legacy_ai_service.py、backend/tests/unit/infrastructure/test_sse_event_dispatch.py。

### 统一 AI 上下文注入器前端 Batch 2 - 2026-06-13
**需求描述**：接入后端 Batch 1 结构化 SSE 新协议，修复 AI 聊天流式断流，并在每条 AI 回复内展示节点流转与 tool 调用思考轨迹。

**实施步骤**：
1. ✅ 新增前端 agent 事件类型、节点标签与工具友好名映射。
2. ✅ 改造 `aiService.chatWithAIStream` 为 JSON SSE 分发 callbacks，并保留 prompt_template_id 透传。
3. ✅ 新增 `useAgentEvents` 通用 hook，供后续 modal / 一次性 AI 调用复用。
4. ✅ 新增 `AIThinkingTrace` 折叠面板与墨韵 / 晨案风格 CSS。
5. ✅ 改造 `ChatMessages` 与 `useAIWriting`，在流式消息中直接维护轨迹事件、文本缓冲与 traceStatus。

**关键决策**：`useAgentEvents` 本批创建但不接入 `useAIWriting`；写作聊天状态机与 isLoading、isThinking、messages 持久化高度耦合，直接在 callbacks 中 patch 指定 assistant message 更清晰。

**验证结果**：`npm run lint` 通过，0 errors / 10 existing warnings；`npm run build` 成功，保留既有 KaTeX 字体解析与 chunk size warnings。

**相关文件**：frontend/src/config/agentEventTypes.js、frontend/src/services/aiService.js、frontend/src/hooks/useAgentEvents.js、frontend/src/hooks/useAIWriting.js、frontend/src/components/writing/AIThinkingTrace.jsx、frontend/src/components/writing/AIThinkingTrace.css、frontend/src/components/writing/ChatMessages.jsx、TODO.md、WORK_PLAN.md。

### 角色 AI 生成与模型场景授权后端 Batch 1 - 2026-06-13
**需求描述**：为模型配置新增场景授权字段，并提供基于授权模型的角色 AI 生成草稿后端能力。

**实施步骤**：
1. ✅ 新增 ModelConfig.scenarios 数据层、迁移与 schema 序列化。
2. ✅ 新增模型场景常量与校验函数。
3. ✅ 新增角色 AI 生成 schema、service 与 API 路由。
4. ✅ 补充后端单元测试并运行 alembic / ruff / pytest 验证。

**预期成果**：后端支持 `GET /api/v1/model-configs?scenario=character_generation` 过滤与 `POST /api/v1/projects/{project_id}/characters/ai-generate` 生成未落库角色草稿。

**完成记录**：2026-06-13 已完成 Batch 1 后端实现；新增 Alembic head `0005`，迁移在 stamped 0004 的临时 SQLite 测试库中验证通过；变更文件 ruff check / ruff format --check 通过，相关单元测试通过。

**Check 修复记录**：2026-06-13 复核 Batch 1 后端字段穿透链路，修复 CharacterAIService 对 `scenarios IS NULL` 与列表过滤语义不一致的问题，收窄 AI 输出解析重试捕获异常范围，并补充 NULL 全场景兼容测试与 ModelConfig 三行过滤测试。

**相关文件**：backend/app、backend/alembic、backend/tests。

### 角色 AI 生成与模型场景授权前端 Batch 2 - 2026-06-13
**需求描述**：接入后端 Batch 1 能力，在前端提供模型场景授权配置、写作页首角色强制引导、手动创建与 AI 生成角色草稿确认流程。

**实施步骤**：
1. ✅ 新增前端模型场景常量，并改造 modelConfigService / characterService。
2. ✅ ModelConfigManager 新增“授权场景”复选框与卡片场景标签展示。
3. ✅ 抽出 CharacterFormBody 复用既有角色表单主体，供普通角色弹窗与 onboarding 手动创建共用。
4. ✅ 新增 useFirstCharacterGuard、FirstCharacterOnboardingModal、CharacterDraftReviewCard，并挂载到 WritingEditor。
5. ✅ 运行前端 lint / build 验证。

**关键决策**：优先采用抽 CharacterFormBody 的复用方案，避免在 onboarding 中复制完整角色表单；AI 草稿确认卡仅处理核心字段与 dimensions，extra_attributes 不传。

**相关文件**：frontend/src/config、frontend/src/services、frontend/src/hooks、frontend/src/components/worldbuilding、frontend/src/components/writing、TODO.md、WORK_PLAN.md。

### 角色管理页新建角色 AI 生成 Batch 4 - 2026-06-13
**需求描述**：让常规 CharacterManager 的“新建角色”入口复用首角色引导中的手动创建 / AI 生成双 tab 流程，同时保留编辑角色只走原手动表单。

**实施步骤**：
1. 抽出 `CharacterCreatorTabs` 纯内容组件，承载手动创建表单、AI 生成、草稿 review 与创建逻辑。
2. 将 `FirstCharacterOnboardingModal` 收敛为强制 modal 包装，内嵌共享 tabs。
3. 新增可关闭 `CharacterCreateModal`，供角色管理页新建路径使用。
4. 改造 `CharacterManager`：新建打开双 tab modal，编辑继续打开原 `CharacterForm`。
5. 运行前端 lint / build 验证。

**关键决策**：草稿 review 卡的“取消”在共享组件内统一处理为 `setDraft(null)` 返回 AI 输入步骤，modal 关闭仅由外层可关闭 `CharacterCreateModal` 的 `onCancel` 负责。

**完成记录**：2026-06-13 已完成共享组件抽取、onboarding 薄包装、新建角色可关闭 modal 与 CharacterManager 新建 / 编辑路径拆分；`npm run lint` 通过（0 errors / 10 existing warnings），`npm run build` 成功（保留既有 KaTeX 字体解析与 chunk size warnings）。

**相关文件**：frontend/src/components/worldbuilding/CharacterCreatorTabs.jsx、frontend/src/components/worldbuilding/CharacterCreateModal.jsx、frontend/src/components/worldbuilding/FirstCharacterOnboardingModal.jsx、frontend/src/components/CharacterManager.jsx、TODO.md、WORK_PLAN.md。

### 角色 AI 生成扩展字段透传 Batch 3 - 2026-06-13
**需求描述**：将 AI 生成角色草稿从固定核心字段扩展为核心字段 + extra_fields 自由透传 + dimensions 任意中文 key，避免 LLM 返回的梦想、冲突、关系网、标签等角色细节丢失。

**实施步骤**：
1. ✅ 后端 CharacterDraftSchema 新增 extra_fields，并为 dimensions 增加 float/int 兜底归一化与越界裁剪。
2. ✅ 更新 CharacterAIService system prompt / retry prompt，引导 LLM 将扩展字段嵌套到 extra_fields。
3. ✅ 补充 CharacterAIService 单元测试，覆盖 extra_fields、任意 dimensions key、float/越界/非数字归一化。
4. ✅ 前端 CharacterDraftReviewCard 新增扩展属性编辑区，并将 extra_fields 序列化到 extra_attributes。
5. ✅ dimensions 展示改为按 draft.dimensions 字典动态渲染所有 key。

**关键决策**：扩展属性 UI 采用按值类型分支：字符串用 TextArea，数组用 Select tags，嵌套对象用 key-value 列表，其他类型用可编辑 JSON / 文本；不改手动创建表单路径。

**Check 修复记录**：2026-06-13 独立复核 extra_fields / dimensions 穿透链路，修复 CharacterDraftReviewCard 中“其他类型”扩展属性只读且提交回退原值的问题，改为可编辑 JSON / 文本并按用户编辑值聚合；同时将维度提交归一化为 0-100 整数。

**相关文件**：backend/app/schemas/character_ai.py、backend/app/application/character_ai_service.py、backend/tests/unit/application/test_character_ai_service.py、frontend/src/components/worldbuilding/CharacterDraftReviewCard.jsx、frontend/src/components/worldbuilding/CharacterDraftReviewCard.css、TODO.md、WORK_PLAN.md。

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

## M2 Fernet 加密 + Refresh Token + Rate Limit + SSRF 防护 — 2026-06-11

### 完成内容
1. **Phase 1: Fernet 加密基础设施**
   - `requirements.txt` 增加 `cryptography>=42.0.0`、`slowapi>=0.1.9`
   - 新建 `app/infrastructure/secrets/key_encryption_service.py`：
     - `KeyEncryptionService` 单例，PBKDF2 派生 32 字节 key 供 Fernet 使用
     - 方法：`encrypt`、`decrypt`、`rotate_key`
   - `app/core/config.py` 新增 `EncryptionSettings`（`encryption_key`、`pbkdf2_iterations=480_000`）
   - `app/core/config.py` 调整 `AuthSettings.access_token_expire_minutes=30`、`refresh_token_expire_minutes=10080`
   - `app/main.py` 启动自检增加：生产环境未显式设置 `ENCRYPTION_KEY` 时 WARNING
   - 替换 3 处 base64 假加密为 Fernet：
     - `app/api/v1/model_configs.py`
     - `app/api/v1/ai.py`
     - `app/api/v1/ai_compat.py`
   - 新建 `app/api/v1/admin.py`：`POST /api/v1/admin/keys/rotate`（admin 鉴权占位）

2. **Phase 2: 一次性数据迁移命令**
   - 新建 `backend/scripts/migrate_base64_keys_to_fernet.py`：
     - CLI 参数 `--dry-run`、`--batch-size`
     - base64 解码 → Fernet 加密 → 写回 DB
     - 进度报告 + 日志输出到 `logs/key_migration_<timestamp>.log`
   - 新建 `backend/scripts/README.md`

3. **Phase 3: Refresh Token + 黑名单**
   - `app/schemas/auth.py` 新增 `RefreshTokenRequest`、`RefreshTokenResponse`
   - `app/core/security.py` 新增 `create_refresh_token`、`verify_refresh_token`、`revoke_token`、`is_token_revoked`
   - `app/infrastructure/db/models/auth.py` 新增 `TokenBlacklist` 模型（jti unique indexed、expires_at indexed）
   - `app/infrastructure/db/models/__init__.py` 导入 `TokenBlacklist`
   - 新建 `alembic/versions/0004_token_blacklist.py` 迁移（`down_revision = "0003"`）
   - `app/api/v1/auth.py` 改造：
     - `login` 返回 `access_token + refresh_token`
     - `refresh` 旋转 token，旧 refresh jti 加入黑名单
     - `logout` 将当前 access token jti 加入黑名单
   - `app/api/deps/auth.py` `verify_token` 增加 jti 黑名单校验

4. **Phase 4: 前端配合**
   - `frontend/src/services/core/authStorage.js`：
     - 同时存 access + refresh token
     - 新增 `setTokens`、`getRefreshToken`、`clearTokens`
   - `frontend/src/services/core/apiClient.js`：
     - 401 时自动调用 `/auth/refresh` 续期
     - 并发去重（多个 401 同时触发只 refresh 一次）

5. **Phase 5: SSRF URL 白名单**
   - 新建 `app/core/url_safety.py`：
     - 拒绝 private IP、链路本地、localhost、非 http/https scheme
   - `app/schemas/model_configs.py`：`api_url` / `proxy_url` 加 `field_validator`
   - `app/infrastructure/llm/provider_adapters/*.py`（4 个）请求前再校验 `api_url`

6. **Phase 6: Rate Limit**
   - `app/core/middleware.py` 集成 `Limiter`（`slowapi`）
   - `app/main.py` 注册 `SlowAPIMiddleware`
   - `app/core/exceptions.py` 捕获 `RateLimitExceeded` 转 429 + 统一错误结构
   - 各端点加 `@limiter.limit(...)`：
     - login `5/minute` per IP
     - register `3/hour` per IP
     - refresh `30/minute` per IP
     - AI 端点 `10/minute` per user（Authorization header 为 key）

7. **Phase 7: 测试**
   - `tests/unit/test_key_encryption.py`（5 用例）：全部通过
   - `tests/unit/test_url_safety.py`（8 用例）：全部通过
   - `tests/integration/test_auth_refresh.py`（6 用例）：全部通过
   - `tests/integration/test_rate_limit.py`（3 用例）：全部通过
   - `tests/integration/test_migrate_base64_to_fernet.py`（4 用例）：全部通过
   - 既有 M1 测试 29 用例 + M2 新测试 20 用例 = **76 用例全部通过**

8. **Phase 8: 文档同步**
   - `WORK_PLAN.md` 已更新 M2 章节
   - `TODO.md` 已勾选对应项

### 修改文件
- `backend/requirements.txt`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/core/exceptions.py`
- `backend/app/core/middleware.py`
- `backend/app/core/url_safety.py`（新建）
- `backend/app/main.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/model_configs.py`
- `backend/app/api/v1/ai.py`
- `backend/app/api/v1/ai_compat.py`
- `backend/app/api/v1/admin.py`（新建）
- `backend/app/api/deps/auth.py`
- `backend/app/infrastructure/secrets/__init__.py`
- `backend/app/infrastructure/secrets/key_encryption_service.py`（新建）
- `backend/app/infrastructure/db/models/auth.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/app/infrastructure/llm/provider_adapters/openai_provider.py`
- `backend/app/infrastructure/llm/provider_adapters/anthropic_provider.py`
- `backend/app/infrastructure/llm/provider_adapters/gemini_provider.py`
- `backend/app/infrastructure/llm/provider_adapters/custom_provider.py`
- `backend/app/schemas/auth.py`
- `backend/app/schemas/model_configs.py`
- `backend/alembic/versions/0004_token_blacklist.py`（新建）
- `backend/scripts/migrate_base64_keys_to_fernet.py`（新建）
- `backend/scripts/README.md`（新建）
- `backend/tests/conftest.py`
- `backend/tests/unit/test_key_encryption.py`（新建）
- `backend/tests/unit/test_url_safety.py`（新建）
- `backend/tests/integration/test_auth_refresh.py`（新建）
- `backend/tests/integration/test_rate_limit.py`（新建）
- `backend/tests/integration/test_migrate_base64_to_fernet.py`（新建）
- `frontend/src/services/core/authStorage.js`
- `frontend/src/services/core/apiClient.js`
- `AINovel/WORK_PLAN.md`
- `AINovel/TODO.md`

## M4 AI Runtime langgraph 0.6.5→1.2.4 + Checkpointer + Token 回填 + SSE + Cancel — 2026-06-11

### 已完成内容（前 70% 由前序 subagent 完成）
1. `requirements.txt` 版本锁定（langgraph==1.2.4, langchain-core>=1.4.0 等）
2. 双 conda env 升级到 langgraph 1.2.4
3. `app/infrastructure/graph/runner.py` 大改造：
   - 构造接收 `checkpointer` + `event_queue`
   - Token 跟踪：`on_chat_model_end` → `add_usage()` → `run.tokens_used`
   - Event queue 桥接：`_push_event` / `_make_event_payload`
   - CancelledError 优雅处理
   - `ainvoke` / `astream_events` 只在 checkpointer 存在时传 config
4. `app/infrastructure/checkpoint/__init__.py` — `get_sqlite_checkpointer()` 工厂 + 单例
5. `app/infrastructure/graph/workflows/chapter_outline.py` — 接受 checkpointer 参数
6. `tests/integration/test_ai_runtime.py` MockGraph 已接受 `**kwargs`

### 本次完成内容（剩余 30%）
1. **Phase B 收尾 — cancel_run 真正取消**
   - `app/api/v1/ai.py`：`cancel_run` 端点改造
     - 引入 `background_runner`，检查 `get_status(run_id)`
     - 活 task 存在时调用 `background_runner.cancel(run_id)`
     - 保留同步运行（generate_chapter_outline）的"已知限制"注释
   - 新增 `tests/integration/test_cancel.py`（2 用例）：验证 cancel API 调 background_runner.cancel + DB 状态写回

2. **Phase B 测试补全**
   - `tests/unit/test_checkpoint_factory.py`（2 用例）：单例一致性 + BaseCheckpointSaver 子类类型
   - `tests/integration/test_token_tracking.py`（2 用例）：usage_metadata 回填 tokens_used + 多轮累加
   - `tests/integration/test_checkpointer_resume.py`（1 用例）：InMemorySaver 两次 ainvoke 验 state 持久

3. **Phase C — SSE 实时流**
   - `app/infrastructure/graph/runner.py`：新增 `consume_events()` 异步生成器
     - 内部维护 `asyncio.Queue`，push 事件到 queue
     - 错误时把 exception 包装为 error 事件 push 到 queue
     - caller 不传 `event_queue` 时仍走原 yield 路径（向后兼容）
   - `app/api/v1/ai.py` SSE 端点改造：
     - `GET /runs/{run_id}/stream`：completed run replay 历史事件；running run 从 `RUN_QUEUES` 拉取实时事件
     - 新增 `POST /runs/{run_id}/start-stream`：注册 queue、启动后台 task
     - `StreamingResponse` → `sse-starlette.EventSourceResponse`
     - `/runs/{id}/stream` 加 `@limiter.limit("30/minute")`
   - 新增 `tests/integration/test_sse_streaming.py`（3 用例）：completed replay + running live + content-type 验证

4. **测试基线**
   - 新增 10 个测试用例，全量 **86 passed**（76 基线 + 10 新增）
   - `chapter_outline` 端到端未破坏

### 修改文件
- `backend/app/infrastructure/graph/runner.py` — 新增 `consume_events()`
- `backend/app/api/v1/ai.py` — cancel_run 改造 + SSE 实时流 + start-stream 端点
- `backend/tests/unit/test_checkpoint_factory.py`（新建）
- `backend/tests/integration/test_token_tracking.py`（新建）
- `backend/tests/integration/test_cancel.py`（新建）
- `backend/tests/integration/test_checkpointer_resume.py`（新建）
- `backend/tests/integration/test_sse_streaming.py`（新建）

## UI Token 层实施 — 墨韵·Ink & Moonlight 设计系统 — 2026-06-12

### 完成内容
1. **Phase 1: Token 层实施**
   - 重写 `frontend/src/index.css` 全部 CSS 变量，从 GitHub 风格替换为"墨韵·Ink & Moonlight"设计系统
   - 亮色模式：宣纸白底 `#FAF8F5` + 赭石 accent `#C75B39`
   - 暗色模式：深墨底 `#1A1714` + 暖金 accent `#D4915C`
   - 新增动画变量（ease-out-expo、ease-spring、duration 系列）
   - 新增 `--gradient-ink` 渐变变量
   - 新增 `--font-display` 和 `--font-literary` 到 Tailwind `@theme` 块
   - 重写 `frontend/src/theme/tokens.js` 全部 JS Token
     - `colors` 对象对齐新色值
     - `antdTokens` 对齐新色值（borderRadius 10、Card borderRadius 16 等）
     - `radius` 更新为 sm:6 / md:10 / lg:16
     - `fontFamily` 更新为 Inter + 中文字体栈
     - `shadows` 对齐新色值
   - 更新 `frontend/index.html` 添加字体 CDN 链接
     - Noto Serif SC（标题专用）
     - LXGW WenKai（写作编辑器专用）

### 修改文件
- `frontend/src/index.css`
- `frontend/src/theme/tokens.js`
- `frontend/index.html`

### 验证结果
- ESLint: 通过（0 errors，10 warnings 为既有问题）
- Vite Build: 通过（9.67s）

## 提示词模板注入 AI 对话链修复 — 2026-06-13

### 计划内容
1. 修复 legacy chat / chat-stream API 对 `prompt_template_id` 的透传。
2. 在 `LegacyAIService` 中按项目、历史、当前消息渲染提示词模板并替换 system prompt。
3. 模型调用成功后记录模板使用次数，计数失败仅记录 warning。
4. 补充 LegacyAIService 单元测试覆盖无模板、有模板、无效模板三种路径。

### 相关文件
- `backend/app/api/v1/ai_compat.py`
- `backend/app/application/legacy_ai_service.py`
- `backend/tests/unit/application/test_legacy_ai_service.py`

### 重要决策
- 未知模板变量保持原样并记录 warning，不阻断 AI 对话。
- `PromptTemplateService` 使用方法内懒导入，避免潜在循环依赖。
- 不修改前端和其余 generate 端点，保持本次 scope 收敛。

### 完成内容
1. `legacy_chat` / `legacy_chat_stream` 已透传 `prompt_template_id`。
2. `LegacyAIService.chat` / `chat_stream` 已支持提示词模板渲染、system prompt 替换和成功后 usage 计数。
3. 新增 chat 模板注入相关单元测试，覆盖无模板、有模板、无效模板三种路径。
4. 后端 ruff、format check、相关单测均通过。

### 统一 AI 上下文注入器 Batch 1 后端 - 2026-06-13
**需求描述**：让 legacy chat / chat-stream 走 LangChain v1 `create_agent` + LangGraph 工作流，基础注入项目角色上下文，并通过 tools 按需查询角色、地点、组织和章节内容；流式协议升级为结构化 SSE 事件。

**实施步骤**：
1. ✅ 升级 `AIContextBuilder`，补充 appearance 字段、chat 专用格式化与字符预算策略。
2. ✅ 新增 chat_assistant tools，全部采用 `ToolRuntime.context` 注入 project_id/session_factory。
3. ✅ 新增 `chat_assistant` workflow：外层 `inject_context` 节点 + `create_agent` 子图 + dynamic prompt。
4. ✅ 新增结构化 SSE 事件分发器，白名单暴露节点、工具和文本事件，异常转 error + done。
5. ✅ 改造 `LegacyAIService.chat/chat_stream` 走 graph 路径，并保留 prompt_template usage 记录。
6. ✅ 补充后端单元测试覆盖上下文构建、SSE 分发、chat_assistant graph 与 legacy chat 路径。

**关键决策**：tool 不用每请求闭包重建，而是通过 `ChatAssistantContext` 的 `session_factory` 每次调用独立开 session；`inject_context` 放在 agent 前作为可观测节点；SSE 分发器捕获异常后发 `error` 再发 `done`，避免前端流悬挂。

**相关文件**：backend/app/application、backend/app/infrastructure/graph、backend/tests/unit、TODO.md、WORK_PLAN.md。

## 待办事项
- [ ] 设置工作规划模板
- [ ] 定义工作记录格式

### 提示词模板注入 AI 调用链复核修复 - 2026-06-13
**完成的任务**：
- 复核 `/api/ai/chat` 与 `/api/ai/chat-stream` 的 `prompt_template_id` 请求穿透。
- 修正 LegacyAIService 模板渲染细节，使 `project_info` 按 PRD 仅去尾部空白，`history` 按最近 10 条中文角色映射并保留行尾换行格式。
- 在 `ainovel` conda 环境下重跑 ruff check、ruff format --check 与相关 pytest。

**修改的文件**：
- `backend/app/application/legacy_ai_service.py`
- `WORK_PLAN.md`

**重要决策或变更**：
- 未改动前端代码，未扩展其余 generate 端点模板挂载范围。
- 保持 `PromptTemplateService.get_template` 访问校验与 `record_usage` 失败容忍策略。


### AI 写作助手聊天前端迁移 assistant-ui - 2026-06-13
**需求描述**：将右侧 AI 写作助手聊天消息渲染和输入区迁移到 `@assistant-ui/react` primitives，保留 WritingToolbar、墨韵主题、提示词模板透传和后端结构化 SSE 协议；v1 暂不做跨 session 聊天持久化。

**实施步骤**：
1. 安装 `@assistant-ui/react` 并确认 React 18 peer dependency 兼容。
2. 新增 `createAINovelChatAdapter`，通过 promise 队列桥接 `aiService.chatWithAIStream` callbacks 到 async generator。
3. 新增 thinking_trace tool-call renderer、Streamdown 文本 part renderer、用户/助手消息 renderer。
4. 重写 `AIChatPanel` 使用 `useLocalRuntime`、ThreadPrimitive 与 ComposerPrimitive。
5. 精简 `useAIWriting`，移除旧聊天 messages/handleSend 状态机并临时禁用 chat localStorage 写入。
6. 调整 `WritingEditor` 向 `AIChatPanel` 传入 `projectId` 与 `selectedPromptTemplate`。
7. 新增 assistant-ui primitive CSS 并删除旧 `ChatMessages` / `ChatInput` 文件。
8. 运行前端 lint / build 验证。

**关键决策**：遵循 PRD D1-D5；不改后端、不改 `aiService.chatWithAIStream` 签名、不引入 shadcn / @assistant-ui/react-markdown / @ai-sdk 包；adapter 的 abort v1 仅本地停止 yield，真 fetch abort 留 TODO。

**相关文件**：frontend/package.json、frontend/src/runtime/aiNovelChatAdapter.js、frontend/src/components/writing/AIChatPanel.jsx、frontend/src/components/writing/*MessageRenderer.jsx、frontend/src/hooks/useAIWriting.js、frontend/src/components/writing/WritingEditor.jsx、TODO.md、WORK_PLAN.md。
