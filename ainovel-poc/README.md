# AINovel Motia POC

## 项目概述

这是一个概念验证（POC）项目，旨在验证Motia框架在AI小说创作场景下的可行性。

## 功能特性

### 核心功能
- ✅ **项目管理**: 创建、查询项目信息
- ✅ **AI大纲生成**: 基于项目信息生成章节大纲
- ✅ **任务状态追踪**: 实时查询AI任务进度
- ✅ **事件驱动架构**: 使用Motia的事件驱动工作流

### 技术特性
- 🚀 **Motia框架**: 事件驱动的微服务架构
- 🤖 **AI集成**: OpenAI GPT-4模型集成
- 💾 **数据持久化**: SQLite数据库
- 🔄 **异步处理**: 支持并发AI任务
- 📊 **状态管理**: Motia内置状态管理

## 快速开始

### 环境要求
- Node.js >= 16
- Python >= 3.8
- OpenAI API Key

### 安装步骤

1. **克隆项目**
   ```bash
   git clone -b motia-migration-poc <repository-url>
   cd AINovel/ainovel-poc
   ```

2. **安装依赖**
   ```bash
   # 安装Node.js依赖
   npm install
   
   # 安装Python依赖
   pip install -r requirements.txt
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑.env文件，添加你的OpenAI API Key
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **访问Motia Workbench**
   打开浏览器访问: http://localhost:3000

## API接口

### 项目管理

#### 创建项目
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的小说项目",
    "description": "一个测试项目",
    "user_id": "user123"
  }'
```

#### 获取项目信息
```bash
curl http://localhost:3000/api/projects/{project_id}
```

### AI功能

#### 生成章节大纲
```bash
curl -X POST http://localhost:3000/api/ai/chapter-outline \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project123",
    "chapter_number": 1,
    "user_requirements": "主角遇到神秘人物"
  }'
```

#### 查询任务状态
```bash
curl http://localhost:3000/api/ai/status/{task_id}
```

## 项目结构

```
ainovel-poc/
├── steps/                    # Motia Steps
│   ├── api/                 # API Steps
│   │   ├── projects/        # 项目管理API
│   │   └── ai/              # AI功能API
│   ├── events/              # Event Steps
│   │   └── outline-generation/  # 大纲生成工作流
│   └── shared/              # 共享工具Steps
├── adapters/                # 数据适配器
│   ├── sqlite_adapter.py    # SQLite适配器
│   └── openai_adapter.py    # OpenAI适配器
├── services/                # 业务服务层
├── config/                  # 配置文件
├── tests/                   # 测试文件
├── requirements.txt         # Python依赖
├── package.json            # Node.js依赖
└── README.md               # 项目说明
```

## 核心组件

### API Steps
- **CreateProject**: 创建新项目
- **GetProject**: 获取项目信息
- **GenerateChapterOutline**: 启动AI大纲生成
- **GetTaskStatus**: 查询任务状态

### Event Steps
- **GenerateOutlineAI**: 处理AI大纲生成工作流

### 数据适配器
- **SQLiteAdapter**: 数据库操作适配器
- **OpenAIAdapter**: OpenAI API调用适配器

## 工作流程

### 1. 项目创建流程
```
用户请求 → CreateProject API Step → 保存到数据库 → 发送project.created事件
```

### 2. AI大纲生成流程
```
用户请求 → GenerateChapterOutline API Step → 创建任务 → 发送ai.outline.requested事件 → GenerateOutlineAI Event Step → 调用OpenAI API → 保存结果 → 发送ai.outline.generated事件
```

## 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "API Steps"
```

### 测试覆盖
- ✅ API Steps功能测试
- ✅ Event Steps集成测试
- ✅ 数据适配器单元测试
- ✅ 端到端测试

## 性能指标

### 目标性能
- API响应时间: < 3秒
- AI生成时间: < 30秒
- 并发任务数: 10个
- 系统可用性: > 99%

### 监控指标
- 任务完成率
- 平均响应时间
- 错误率
- 系统资源使用率

## 部署

### 本地部署
```bash
npm run dev
```

### Docker部署
```bash
# 构建镜像
docker build -t ainovel-poc .

# 运行容器
docker run -p 3000:3000 ainovel-poc
```

## 贡献指南

### 开发流程
1. 创建功能分支
2. 编写代码和测试
3. 提交Pull Request
4. 代码审查和合并

### 代码规范
- 使用Python类型提示
- 遵循PEP 8规范
- 编写单元测试
- 添加适当的注释

## 故障排除

### 常见问题

1. **OpenAI API调用失败**
   - 检查API Key是否正确
   - 确认网络连接正常
   - 查看API配额是否充足

2. **数据库连接失败**
   - 检查数据库文件权限
   - 确认SQLite版本兼容性

3. **Motia服务启动失败**
   - 检查端口是否被占用
   - 确认Node.js版本兼容性

### 日志查看
```bash
# 查看应用日志
npm run dev -- --verbose

# 查看Motia日志
tail -f logs/motia.log
```

## 后续计划

### Phase 1: 基础功能 ✅
- [x] 项目管理API
- [x] AI大纲生成
- [x] 任务状态追踪

### Phase 2: 扩展功能 🔄
- [ ] AI草稿生成
- [ ] 章节管理
- [ ] 用户认证

### Phase 3: 高级功能 📋
- [ ] 多模态AI支持
- [ ] 协作写作
- [ ] 实时预览

## 许可证

本项目采用MIT许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue
- 发送邮件至项目维护者
- 参与社区讨论

---

**注意**: 这是一个POC项目，仅用于技术验证，不建议在生产环境中使用。