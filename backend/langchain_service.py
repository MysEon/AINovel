"""
LangChain和LangGraph服务模块
提供AI辅助小说创作的核心功能
"""

import os
import json
from typing import Dict, List, Optional, Any, TypedDict
from datetime import datetime
from langchain.chat_models import init_chat_model
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sql_func

from models import User, Project, Chapter, Character, Location, Organization, Worldview, ModelConfig
from database import get_db


class NovelWritingState(TypedDict):
    """小说创作状态"""
    messages: List[BaseMessage]
    project_context: Optional[Dict[str, Any]]
    current_chapter: Optional[Dict[str, Any]]
    writing_mode: str  # 'outline', 'draft', 'revise', 'expand'
    word_count_goal: Optional[int]


class LangChainService:
    """LangChain服务类"""
    
    def __init__(self):
        self.models = {}
        self.prompts = {}
        self._initialize_prompts()
    
    def _initialize_prompts(self):
        """初始化提示词模板"""
        self.prompts = {
            'chapter_outline': ChatPromptTemplate.from_messages([
                SystemMessage(content="""你是一个专业的小说写作助手。根据项目信息和上下文，为指定章节创建详细的写作大纲。

你的任务：
1. 分析项目背景、角色、世界观等信息
2. 根据章节位置和前文内容，规划本章节的发展
3. 创建包含开头、发展、高潮、结尾的结构化大纲
4. 确保情节连贯性和角色发展

请返回JSON格式的大纲，包含：
- chapter_title: 章节标题
- summary: 章节概要
- key_events: 关键事件列表
- character_development: 角色发展要点
- word_count_estimate: 预估字数
- writing_tips: 写作建议"""),
                MessagesPlaceholder(variable_name="messages"),
            ]),
            
            'chapter_draft': ChatPromptTemplate.from_messages([
                SystemMessage(content="""你是一个创意写作专家。根据提供的大纲和项目信息，创作引人入胜的小说章节内容。

写作要求：
1. 严格按照大纲结构展开情节
2. 保持角色性格和语言风格的一致性
3. 注重场景描写和情感表达
4. 控制节奏，避免信息过载
5. 确保与前文和后文的连贯性

写作风格：
- 使用生动的描述和对话
- 保持适当的段落长度
- 注意情绪起伏和悬念设置
- 体现角色的内心活动

请直接返回章节正文内容，不要包含额外说明。"""),
                MessagesPlaceholder(variable_name="messages"),
            ]),
            
            'character_dialogue': ChatPromptTemplate.from_messages([
                SystemMessage(content="""你是一个对话写作专家。根据角色设定和情节需要，创作符合角色性格的自然对话。

对话要求：
1. 严格符合角色的性格特点、背景和教育水平
2. 体现角色之间的关系和情绪状态
3. 推动情节发展或揭示角色内心
4. 语言自然流畅，避免生硬
5. 适当使用非语言动作描述

请返回包含对话和必要动作描写的文本。"""),
                MessagesPlaceholder(variable_name="messages"),
            ]),
            
            'plot_suggestion': ChatPromptTemplate.from_messages([
                SystemMessage(content="""你是一个小说创作顾问。基于当前的故事进展，提供情节发展的建议。

分析要点：
1. 梳理当前的主要矛盾和悬念
2. 识别可能的发展方向
3. 考虑角色动机和成长空间
4. 建议合适的冲突和转折点
5. 保持整体故事的平衡和节奏

请提供3-5个具体的情节发展建议，每个建议包含：
- 建议标题
- 详细说明
- 预期效果
- 潜在风险"""),
                MessagesPlaceholder(variable_name="messages"),
            ])
        }
    
    async def get_model(self, config: ModelConfig) -> Any:
        """根据配置获取LangChain模型"""
        cache_key = f"{config.model_type}_{config.model_name}_{config.id}"
        
        if cache_key not in self.models:
            # 解密API密钥
            api_key = self._decrypt_api_key(config.api_key) if config.api_key else None
            
            if config.model_type.lower() == "openai":
                if api_key:
                    os.environ["OPENAI_API_KEY"] = api_key
                model = init_chat_model(f"openai:{config.model_name}")
            elif config.model_type.lower() == "claude":
                if api_key:
                    os.environ["ANTHROPIC_API_KEY"] = api_key
                model = init_chat_model(f"anthropic:{config.model_name}")
            elif config.model_type.lower() == "gemini":
                if api_key:
                    os.environ["GOOGLE_API_KEY"] = api_key
                model = init_chat_model(f"google:{config.model_name}")
            elif config.model_type.lower() == "custom":
                # 自定义模型配置
                model = init_chat_model(
                    f"openai:{config.model_name}",
                    openai_api_base=config.api_url,
                    openai_api_key=api_key
                )
            else:
                raise ValueError(f"不支持的模型类型: {config.model_type}")
            
            # 设置模型参数
            if hasattr(model, 'temperature'):
                model.temperature = float(config.temperature)
            if hasattr(model, 'max_tokens'):
                model.max_tokens = config.max_tokens
            
            self.models[cache_key] = model
        
        return self.models[cache_key]
    
    def _decrypt_api_key(self, encrypted_key: str) -> str:
        """解密API密钥"""
        import base64
        return base64.b64decode(encrypted_key.encode()).decode()
    
    async def generate_chapter_outline(
        self, 
        project_id: int, 
        chapter_number: int, 
        user_input: str,
        model_config: ModelConfig,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """生成章节大纲"""
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 获取模型
        model = await self.get_model(model_config)
        
        # 构建提示词
        prompt_messages = [
            HumanMessage(content=f"""
项目信息：{json.dumps(project_context, ensure_ascii=False, indent=2)}

章节编号：第{chapter_number}章
用户需求：{user_input}

请为这个章节创建详细的写作大纲。
""")
        ]
        
        # 生成大纲
        prompt = self.prompts['chapter_outline']
        chain = prompt | model
        result = await chain.ainvoke({"messages": prompt_messages})
        
        # 尝试解析JSON结果
        try:
            outline = json.loads(result.content)
            return outline
        except json.JSONDecodeError:
            # 如果不是JSON格式，返回文本结果
            return {
                "raw_content": result.content,
                "chapter_title": f"第{chapter_number}章",
                "summary": result.content[:500] + "..." if len(result.content) > 500 else result.content
            }
    
    async def generate_chapter_draft(
        self,
        project_id: int,
        chapter_outline: Dict[str, Any],
        model_config: ModelConfig,
        db: AsyncSession
    ) -> str:
        """生成章节草稿"""
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 获取模型
        model = await self.get_model(model_config)
        
        # 构建提示词
        prompt_messages = [
            HumanMessage(content=f"""
项目背景：{json.dumps(project_context.get('project', {}), ensure_ascii=False, indent=2)}

章节大纲：{json.dumps(chapter_outline, ensure_ascii=False, indent=2)}

请根据以上信息创作这个章节的完整内容。
""")
        ]
        
        # 生成草稿
        prompt = self.prompts['chapter_draft']
        chain = prompt | model
        result = await chain.ainvoke({"messages": prompt_messages})
        
        return result.content
    
    async def generate_character_dialogue(
        self,
        project_id: int,
        character_names: List[str],
        situation: str,
        model_config: ModelConfig,
        db: AsyncSession
    ) -> str:
        """生成角色对话"""
        # 获取角色信息
        characters_info = await self._get_characters_info(project_id, character_names, db)
        
        # 获取模型
        model = await self.get_model(model_config)
        
        # 构建提示词
        prompt_messages = [
            HumanMessage(content=f"""
角色信息：{json.dumps(characters_info, ensure_ascii=False, indent=2)}

场景情况：{situation}

请创作符合角色性格的对话内容。
""")
        ]
        
        # 生成对话
        prompt = self.prompts['character_dialogue']
        chain = prompt | model
        result = await chain.ainvoke({"messages": prompt_messages})
        
        return result.content
    
    async def get_plot_suggestions(
        self,
        project_id: int,
        current_chapter_content: str,
        model_config: ModelConfig,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """获取情节发展建议"""
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 获取模型
        model = await self.get_model(model_config)
        
        # 构建提示词
        prompt_messages = [
            HumanMessage(content=f"""
项目背景：{json.dumps(project_context, ensure_ascii=False, indent=2)}

当前章节内容：{current_chapter_content[:1000]}...

请基于以上信息提供情节发展建议。
""")
        ]
        
        # 生成建议
        prompt = self.prompts['plot_suggestion']
        chain = prompt | model
        result = await chain.ainvoke({"messages": prompt_messages})
        
        # 返回结果
        return {
            "suggestions": result.content,
            "generated_at": datetime.now().isoformat()
        }
    
    async def _get_project_context(self, project_id: int, db: AsyncSession) -> Dict[str, Any]:
        """获取项目上下文信息"""
        # 获取项目基本信息
        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise ValueError(f"项目 {project_id} 不存在")
        
        context = {
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description
            }
        }
        
        # 获取角色信息
        characters_result = await db.execute(
            select(Character).where(Character.project_id == project_id)
        )
        characters = characters_result.scalars().all()
        context["characters"] = [
            {
                "name": char.name,
                "personality": char.personality,
                "background": char.background,
                "appearance": char.appearance
            }
            for char in characters
        ]
        
        # 获取世界观信息
        worldviews_result = await db.execute(
            select(Worldview).where(Worldview.project_id == project_id)
        )
        worldviews = worldviews_result.scalars().all()
        context["worldviews"] = [
            {
                "name": wv.name,
                "rules": wv.rules,
                "magic_system": wv.magic_system,
                "technology": wv.technology
            }
            for wv in worldviews
        ]
        
        # 获取地点信息
        locations_result = await db.execute(
            select(Location).where(Location.project_id == project_id)
        )
        locations = locations_result.scalars().all()
        context["locations"] = [
            {
                "name": loc.name,
                "description": loc.description,
                "geography": loc.geography,
                "culture": loc.culture
            }
            for loc in locations
        ]
        
        return context
    
    async def _get_characters_info(
        self, 
        project_id: int, 
        character_names: List[str], 
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """获取指定角色的详细信息"""
        characters_result = await db.execute(
            select(Character).where(
                Character.project_id == project_id,
                Character.name.in_(character_names)
            )
        )
        characters = characters_result.scalars().all()
        
        return [
            {
                "name": char.name,
                "personality": char.personality,
                "background": char.background,
                "appearance": char.appearance
            }
            for char in characters
        ]


class LangGraphService:
    """LangGraph服务类"""
    
    def __init__(self):
        self.langchain_service = LangChainService()
        self.agents = {}
        self.checkpointers = {}
    
    async def create_novel_writing_agent(
        self, 
        project_id: int, 
        model_config: ModelConfig,
        db: AsyncSession
    ) -> Any:
        """创建小说写作智能体"""
        agent_key = f"novel_writing_{project_id}_{model_config.id}"
        
        if agent_key not in self.agents:
            # 获取模型
            model = await self.langchain_service.get_model(model_config)
            
            # 定义工具
            @tool
            async def get_project_context(project_id: int) -> str:
                """获取项目上下文信息"""
                context = await self.langchain_service._get_project_context(project_id, db)
                return json.dumps(context, ensure_ascii=False, indent=2)
            
            @tool
            async def generate_outline(chapter_number: int, requirements: str) -> str:
                """生成章节大纲"""
                try:
                    outline = await self.langchain_service.generate_chapter_outline(
                        project_id, chapter_number, requirements, model_config, db
                    )
                    return json.dumps(outline, ensure_ascii=False, indent=2)
                except Exception as e:
                    return f"生成大纲失败: {str(e)}"
            
            @tool
            async def write_chapter(outline: str) -> str:
                """根据大纲写章节"""
                try:
                    outline_dict = json.loads(outline)
                    content = await self.langchain_service.generate_chapter_draft(
                        project_id, outline_dict, model_config, db
                    )
                    return content
                except Exception as e:
                    return f"写作失败: {str(e)}"
            
            @tool
            async def suggest_plot(current_content: str) -> str:
                """提供情节建议"""
                try:
                    suggestions = await self.langchain_service.get_plot_suggestions(
                        project_id, current_content, model_config, db
                    )
                    return json.dumps(suggestions, ensure_ascii=False, indent=2)
                except Exception as e:
                    return f"提供建议失败: {str(e)}"
            
            # 创建智能体
            agent = create_react_agent(
                model=model,
                tools=[get_project_context, generate_outline, write_chapter, suggest_plot],
                checkpointer=MemorySaver()
            )
            
            self.agents[agent_key] = agent
        
        return self.agents[agent_key]
    
    async def run_writing_workflow(
        self,
        project_id: int,
        task: str,
        model_config: ModelConfig,
        db: AsyncSession,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """运行写作工作流"""
        # 创建智能体
        agent = await self.create_novel_writing_agent(project_id, model_config, db)
        
        # 准备输入
        messages = [HumanMessage(content=task)]
        
        # 运行智能体
        result = await agent.ainvoke(
            {"messages": messages},
            config=config or {"configurable": {"thread_id": f"project_{project_id}"}}
        )
        
        return {
            "result": result,
            "messages": result.get("messages", []),
            "generated_at": datetime.now().isoformat()
        }


# 全局服务实例
langchain_service = LangChainService()
langgraph_service = LangGraphService()