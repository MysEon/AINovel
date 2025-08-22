# AINovel Motia POC 架构设计

## 📋 POC目标

验证Motia框架在AI小说创作场景下的可行性，重点验证：
1. **AI工作流能力**: 大纲生成、草稿创作的事件驱动处理
2. **API兼容性**: 与现有前端API的兼容性
3. **状态管理**: 复杂写作流程的状态追踪
4. **性能表现**: 响应时间和并发处理能力

## 🎯 POC范围

### 功能范围
- ✅ **项目基础管理**: 创建、查询、更新项目
- ✅ **AI章节大纲生成**: 基于项目信息生成章节大纲
- ✅ **AI章节草稿创作**: 基于大纲生成章节草稿
- ✅ **写作状态追踪**: 实时追踪AI写作进度

### 技术范围
- ✅ **Motia Steps**: API Steps + Event Steps
- ✅ **状态管理**: 项目状态 + AI工作流状态
- ✅ **AI集成**: OpenAI GPT-4模型
- ✅ **数据持久化**: SQLite数据库
- ✅ **前端兼容**: 保持现有API接口格式

## 🏗️ POC架构设计

### 整体架构
```
Frontend (React App)
    │
    ▼
API Gateway (Nginx/Route)
    │
    ├───────────┬───────────┐
    ▼           ▼           ▼
Motia API   Legacy API   Motia Workbench
Steps       (其他功能)    (监控和管理)
    │
    ▼
Motia Event Steps
(AI工作流处理)
    │
    ▼
State Manager + Database
```

### Motia组件设计

#### 1. Steps设计

**API Steps (HTTP接口)**
```python
# 1. 项目管理API
- POST /api/projects (创建项目)
- GET /api/projects/{id} (获取项目信息)
- PUT /api/projects/{id} (更新项目)

# 2. AI写作API
- POST /api/ai/chapter-outline (生成章节大纲)
- POST /api/ai/chapter-draft (生成章节草稿)
- GET /api/ai/status/{task_id} (查询任务状态)
```

**Event Steps (AI工作流)**
```python
# 1. 大纲生成工作流
- GenerateOutline (生成大纲)
- ValidateOutline (验证大纲质量)
- SaveOutline (保存大纲)

# 2. 草稿创作工作流
- GenerateDraft (生成草稿)
- RefineDraft (优化草稿)
- SaveDraft (保存草稿)
```

**Cron Steps (定时任务)**
```python
# 1. 清理任务
- CleanupOldTasks (清理过期任务)
- UpdateProjectStats (更新项目统计)
```

#### 2. Flows设计

```python
# 主要工作流
flows = {
    "project-management": [
        "CreateProject",
        "UpdateProject", 
        "DeleteProject"
    ],
    "ai-writing": [
        "GenerateChapterOutline",
        "ValidateOutline",
        "GenerateChapterDraft",
        "RefineDraft"
    ],
    "content-management": [
        "SaveChapter",
        "PublishChapter",
        "UpdateStats"
    ]
}
```

#### 3. 状态管理设计

```python
# 状态结构
state = {
    "projects": {
        "{project_id}": {
            "basic_info": {...},
            "stats": {
                "word_count": 0,
                "chapter_count": 0,
                "ai_tasks_count": 0
            },
            "ai_context": {
                "characters": [...],
                "locations": [...],
                "plot_summary": "..."
            }
        }
    },
    "ai_tasks": {
        "{task_id}": {
            "type": "outline|draft",
            "status": "pending|processing|completed|failed",
            "progress": 0.0,
            "result": {...},
            "error": null,
            "created_at": "2024-01-01T00:00:00Z",
            "completed_at": null
        }
    }
}
```

## 📦 技术实现

### 1. 项目结构
```
ainovel-poc/
├── steps/
│   ├── api/
│   │   ├── projects/
│   │   │   ├── create-project.step.py
│   │   │   ├── get-project.step.py
│   │   │   └── update-project.step.py
│   │   └── ai/
│   │       ├── generate-outline.step.py
│   │       ├── generate-draft.step.py
│   │       └── task-status.step.py
│   ├── events/
│   │   ├── outline-generation/
│   │   │   ├── generate-outline.step.py
│   │   │   ├── validate-outline.step.py
│   │   │   └── save-outline.step.py
│   │   └── draft-generation/
│   │       ├── generate-draft.step.py
│   │       ├── refine-draft.step.py
│   │       └── save-draft.step.py
│   └── shared/
│       ├── database-adapter.step.py
│       ├── ai-service.step.py
│       └── state-manager.step.py
├── services/
│   ├── ai_service.py
│   ├── database_service.py
│   └── validation_service.py
├── adapters/
│   ├── sqlite_adapter.py
│   └── openai_adapter.py
├── config/
│   ├── motia.yml
│   ├── ai_models.yml
│   └── database.yml
├── tests/
│   ├── test_api_steps.py
│   ├── test_event_steps.py
│   └── test_ai_services.py
├── package.json
├── requirements.txt
└── README.md
```

### 2. 关键组件实现

#### API Step示例
```python
# steps/api/ai/generate-outline.step.py
from motia import ApiRouteConfig, StepHandler
from typing import Dict, Any
import uuid

config: ApiRouteConfig = {
    "type": "api",
    "name": "GenerateChapterOutline",
    "path": "/api/ai/chapter-outline",
    "method": "POST",
    "emits": ["ai.outline.requested"],
    "flows": ["ai-writing"],
}

async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """生成章节大纲API入口"""
    try:
        # 验证请求数据
        project_id = req.get("project_id")
        chapter_number = req.get("chapter_number")
        user_requirements = req.get("user_requirements", "")
        
        if not project_id or not chapter_number:
            return {
                "status": 400,
                "body": {"error": "Missing required fields"}
            }
        
        # 创建任务ID
        task_id = str(uuid.uuid4())
        
        # 保存任务状态
        await ctx.state.set(task_id, "task_info", {
            "type": "outline",
            "project_id": project_id,
            "chapter_number": chapter_number,
            "user_requirements": user_requirements,
            "status": "pending",
            "progress": 0.0,
            "created_at": ctx.timestamp
        })
        
        # 发送事件触发AI工作流
        await ctx.emit({
            "topic": "ai.outline.requested",
            "data": {
                "task_id": task_id,
                "project_id": project_id,
                "chapter_number": chapter_number,
                "user_requirements": user_requirements
            }
        })
        
        return {
            "status": 202,
            "body": {
                "task_id": task_id,
                "message": "Outline generation started",
                "status": "pending"
            }
        }
        
    except Exception as e:
        return {
            "status": 500,
            "body": {"error": f"Failed to start outline generation: {str(e)}"}
        }
```

#### Event Step示例
```python
# steps/events/outline-generation/generate-outline.step.py
from motia import EventConfig, StepHandler
from typing import Dict, Any

config: EventConfig = {
    "type": "event",
    "name": "GenerateOutlineAI",
    "subscribes": ["ai.outline.requested"],
    "emits": ["ai.outline.generated", "ai.outline.failed"],
    "flows": ["ai-writing"],
}

async def handler(input_data: Dict[str, Any], ctx) -> None:
    """AI生成章节大纲"""
    try:
        task_id = input_data["task_id"]
        project_id = input_data["project_id"]
        chapter_number = input_data["chapter_number"]
        user_requirements = input_data["user_requirements"]
        
        # 更新任务状态为处理中
        await ctx.state.set(task_id, "task_info.status", "processing")
        await ctx.state.set(task_id, "task_info.progress", 0.2)
        
        # 获取项目上下文
        project_context = await ctx.state.get(project_id, "basic_info")
        
        # 构建AI提示词
        prompt = build_outline_prompt(
            project_context, 
            chapter_number, 
            user_requirements
        )
        
        # 调用AI模型
        ai_service = ctx.services.ai
        outline_result = await ai_service.generate_text(
            prompt=prompt,
            model="gpt-4",
            max_tokens=2000,
            temperature=0.7
        )
        
        # 更新进度
        await ctx.state.set(task_id, "task_info.progress", 0.8)
        
        # 解析和验证大纲
        outline = parse_outline(outline_result)
        
        # 保存结果
        await ctx.state.set(task_id, "task_info.result", {
            "outline": outline,
            "raw_response": outline_result
        })
        
        # 发送成功事件
        await ctx.emit({
            "topic": "ai.outline.generated",
            "data": {
                "task_id": task_id,
                "project_id": project_id,
                "chapter_number": chapter_number,
                "outline": outline
            }
        })
        
        # 更新任务状态
        await ctx.state.set(task_id, "task_info.status", "completed")
        await ctx.state.set(task_id, "task_info.progress", 1.0)
        await ctx.state.set(task_id, "task_info.completed_at", ctx.timestamp)
        
    except Exception as e:
        # 发送失败事件
        await ctx.emit({
            "topic": "ai.outline.failed",
            "data": {
                "task_id": task_id,
                "error": str(e)
            }
        })
        
        # 更新任务状态
        await ctx.state.set(task_id, "task_info.status", "failed")
        await ctx.state.set(task_id, "task_info.error", str(e))
```

#### 状态查询API
```python
# steps/api/ai/task-status.step.py
from motia import ApiRouteConfig, StepHandler
from typing import Dict, Any

config: ApiRouteConfig = {
    "type": "api",
    "name": "GetTaskStatus",
    "path": "/api/ai/status/{task_id}",
    "method": "GET",
    "flows": ["ai-writing"],
}

async def handler(req: Dict[str, Any], ctx) -> Dict[str, Any]:
    """查询AI任务状态"""
    try:
        task_id = req.get("path_params", {}).get("task_id")
        
        if not task_id:
            return {
                "status": 400,
                "body": {"error": "Missing task_id"}
            }
        
        # 获取任务信息
        task_info = await ctx.state.get(task_id, "task_info")
        
        if not task_info:
            return {
                "status": 404,
                "body": {"error": "Task not found"}
            }
        
        return {
            "status": 200,
            "body": {
                "task_id": task_id,
                "type": task_info.get("type"),
                "status": task_info.get("status"),
                "progress": task_info.get("progress", 0.0),
                "result": task_info.get("result") if task_info.get("status") == "completed" else None,
                "error": task_info.get("error"),
                "created_at": task_info.get("created_at"),
                "completed_at": task_info.get("completed_at")
            }
        }
        
    except Exception as e:
        return {
            "status": 500,
            "body": {"error": f"Failed to get task status: {str(e)}"}
        }
```

### 3. 数据适配器

#### SQLite适配器
```python
# adapters/sqlite_adapter.py
import sqlite3
import json
from typing import Dict, Any, List
from contextlib import asynccontextmanager

class SQLiteAdapter:
    def __init__(self, db_path: str = "ainovel_poc.db"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    user_id TEXT NOT NULL,
                    word_count INTEGER DEFAULT 0,
                    chapter_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS ai_tasks (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress REAL DEFAULT 0.0,
                    project_id TEXT,
                    result TEXT,
                    error TEXT,
                    created_at TEXT,
                    completed_at TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            ''')
    
    @asynccontextmanager
    async def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    async def save_project(self, project_data: Dict[str, Any]) -> bool:
        """保存项目信息"""
        try:
            with self.get_connection() as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO projects 
                    (id, name, description, user_id, word_count, chapter_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_data["id"],
                    project_data["name"],
                    project_data.get("description", ""),
                    project_data["user_id"],
                    project_data.get("word_count", 0),
                    project_data.get("chapter_count", 0),
                    project_data["created_at"],
                    project_data["updated_at"]
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving project: {e}")
            return False
    
    async def get_project(self, project_id: str) -> Dict[str, Any]:
        """获取项目信息"""
        try:
            with self.get_connection() as conn:
                row = conn.execute(
                    'SELECT * FROM projects WHERE id = ?',
                    (project_id,)
                ).fetchone()
                
                if row:
                    return dict(row)
                return None
        except Exception as e:
            print(f"Error getting project: {e}")
            return None
```

### 4. AI服务适配器

#### OpenAI适配器
```python
# adapters/openai_adapter.py
import openai
from typing import Dict, Any, Optional
import asyncio

class OpenAIAdapter:
    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(api_key=api_key)
    
    async def generate_text(
        self,
        prompt: str,
        model: str = "gpt-4",
        max_tokens: int = 2000,
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        """生成文本"""
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是一个专业的小说写作助手。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating text: {e}")
            raise e
    
    async def generate_outline(
        self,
        project_context: Dict[str, Any],
        chapter_number: int,
        user_requirements: str
    ) -> str:
        """生成章节大纲"""
        prompt = f"""
        基于以下项目信息，为第{chapter_number}章生成详细的章节大纲：
        
        项目名称：{project_context.get('name', '')}
        项目描述：{project_context.get('description', '')}
        
        用户要求：{user_requirements}
        
        请生成一个结构化的章节大纲，包括：
        1. 章节标题
        2. 主要情节要点
        3. 角色发展
        4. 场景设置
        5. 冲突和解决
        
        格式要求：
        - 使用JSON格式返回
        - 包含title, plot_points, character_development, setting, conflicts字段
        """
        
        return await self.generate_text(
            prompt=prompt,
            model="gpt-4",
            max_tokens=2000,
            temperature=0.7
        )
    
    async def generate_draft(
        self,
        outline: Dict[str, Any],
        project_context: Dict[str, Any]
    ) -> str:
        """生成章节草稿"""
        prompt = f"""
        基于以下章节大纲，生成完整的章节草稿：
        
        大纲：{json.dumps(outline, ensure_ascii=False)}
        
        项目背景：{project_context.get('description', '')}
        
        写作要求：
        1. 保持风格一致性
        2. 注重细节描写
        3. 推动情节发展
        4. 体现角色特点
        
        请生成一个完整的章节草稿，约2000-3000字。
        """
        
        return await self.generate_text(
            prompt=prompt,
            model="gpt-4",
            max_tokens=3000,
            temperature=0.8
        )
```

## 🧪 测试策略

### 1. 单元测试
```python
# tests/test_api_steps.py
import pytest
from steps.api.ai.generate_outline import handler

@pytest.mark.asyncio
async def test_generate_outline_api():
    """测试大纲生成API"""
    request_data = {
        "project_id": "test-project-1",
        "chapter_number": 1,
        "user_requirements": "主角遇到神秘人物"
    }
    
    # 模拟上下文
    mock_ctx = MockContext()
    
    result = await handler(request_data, mock_ctx)
    
    assert result["status"] == 202
    assert "task_id" in result["body"]
    assert result["body"]["status"] == "pending"
```

### 2. 集成测试
```python
# tests/test_ai_workflow.py
import pytest
from steps.events.outline_generation.generate_outline import handler

@pytest.mark.asyncio
async def test_outline_generation_workflow():
    """测试大纲生成工作流"""
    input_data = {
        "task_id": "test-task-1",
        "project_id": "test-project-1",
        "chapter_number": 1,
        "user_requirements": "主角遇到神秘人物"
    }
    
    # 模拟上下文和服务
    mock_ctx = MockContext()
    mock_ctx.services.ai = MockAIService()
    
    await handler(input_data, mock_ctx)
    
    # 验证任务状态更新
    task_info = await mock_ctx.state.get("test-task-1", "task_info")
    assert task_info["status"] == "completed"
    assert task_info["progress"] == 1.0
```

### 3. 端到端测试
```python
# tests/test_e2e.py
import pytest
import httpx

@pytest.mark.asyncio
async def test_e2e_outline_generation():
    """端到端测试大纲生成"""
    async with httpx.AsyncClient() as client:
        # 1. 创建项目
        project_response = await client.post(
            "http://localhost:3000/api/projects",
            json={
                "name": "测试项目",
                "description": "用于POC测试的项目"
            }
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["project_id"]
        
        # 2. 生成大纲
        outline_response = await client.post(
            "http://localhost:3000/api/ai/chapter-outline",
            json={
                "project_id": project_id,
                "chapter_number": 1,
                "user_requirements": "主角遇到神秘人物"
            }
        )
        assert outline_response.status_code == 202
        task_id = outline_response.json()["task_id"]
        
        # 3. 查询任务状态
        await asyncio.sleep(5)  # 等待处理完成
        
        status_response = await client.get(
            f"http://localhost:3000/api/ai/status/{task_id}"
        )
        assert status_response.status_code == 200
        
        task_info = status_response.json()
        assert task_info["status"] == "completed"
        assert "outline" in task_info["result"]
```

## 📊 成功指标

### 技术指标
- **功能完整性**: POC功能100%实现
- **API兼容性**: 与现有前端100%兼容
- **响应时间**: API响应时间 < 3秒
- **AI生成时间**: 大纲生成 < 30秒，草稿生成 < 60秒
- **并发处理**: 支持10个并发AI任务
- **错误率**: < 1%

### 业务指标
- **用户体验**: 用户操作流程保持一致
- **功能质量**: AI生成内容质量达到预期
- **系统稳定性**: 7天无故障运行
- **开发效率**: 新功能开发时间减少30%

## 📅 POC时间规划

### 第1周：环境搭建
- Day 1-2: Motia环境安装和配置
- Day 3-4: 项目结构和基础组件开发
- Day 5: 数据库适配器开发

### 第2周：核心功能开发
- Day 1-2: API Steps开发
- Day 3-4: Event Steps开发
- Day 5: AI服务集成

### 第3周：测试和优化
- Day 1-2: 单元测试和集成测试
- Day 3-4: 端到端测试和性能优化
- Day 5: 文档整理和演示准备

## 🎯 下一步计划

1. **立即开始**: 搭建Motia开发环境
2. **第1周目标**: 完成基础架构和API Steps
3. **第2周目标**: 完成AI工作流和Event Steps
4. **第3周目标**: 完成测试和性能优化
5. **最终交付**: POC演示和评估报告

通过这个POC，我们将验证Motia框架在AI小说创作场景下的可行性，为后续的全面迁移提供技术依据和经验积累。