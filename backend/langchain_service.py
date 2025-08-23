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
            
            # 设置代理环境变量（如果配置了代理）
            if config.proxy_url:
                os.environ["HTTP_PROXY"] = config.proxy_url
                os.environ["HTTPS_PROXY"] = config.proxy_url
            else:
                # 清除代理环境变量
                os.environ.pop("HTTP_PROXY", None)
                os.environ.pop("HTTPS_PROXY", None)
            
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
                
                # 允许通过环境变量设置代理/自定义端点
                api_base = os.environ.get("GEMINI_API_BASE")
                if api_base:
                    os.environ["GOOGLE_API_ENDPOINT"] = api_base
                
                model_kwargs = {}
                if config.proxy_url:
                    model_kwargs["proxy"] = config.proxy_url

                model = init_chat_model(config.model_name, model_provider="google_genai", model_kwargs=model_kwargs)
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

    async def test_model_connection(self, test_data: Any) -> bool:
        """
        通过尝试初始化模型来测试连接。
        如果成功，返回 True。如果失败，则会引发异常。
        """
        # 创建一个临时的、符合ModelConfig结构的对象用于测试
        class TempConfig:
            def __init__(self, data, service):
                self.model_type = data.model_type
                self.model_name = data.model_name
                # 使用服务中的加密方法
                self.api_key = service._encrypt_api_key(data.api_key) if data.api_key else None
                self.api_url = data.api_url
                self.proxy_url = getattr(data, 'proxy_url', None)
                # 对于连接测试，使用固定的默认值
                self.temperature = 0.7
                self.max_tokens = 100
                self.id = "test_connection" # 唯一的缓存键

        temp_config = TempConfig(test_data, self)
        
        # get_model会处理所有的初始化和认证逻辑
        # 如果这里出现问题，它会抛出异常，这正是我们想要的
        await self.get_model(temp_config)
        
        # 如果没有异常，说明连接成功
        return True

    def _encrypt_api_key(self, key: str) -> str:
        """加密API密钥"""
        import base64
        return base64.b64encode(key.encode()).decode()

    async def list_available_models(self, model_type: str, api_key: str, proxy_url: Optional[str] = None) -> List[Dict[str, str]]:
        """根据API密钥和模型类型获取可用的模型列表"""
        try:
            # 设置代理环境变量
            if proxy_url:
                os.environ["HTTP_PROXY"] = proxy_url
                os.environ["HTTPS_PROXY"] = proxy_url
            else:
                os.environ.pop("HTTP_PROXY", None)
                os.environ.pop("HTTPS_PROXY", None)
            
            if model_type == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                models = client.models.list()
                return [{"value": model.id, "label": model.id} for model in models]
            
            elif model_type == "anthropic":
                return [
                    {"value": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet"},
                    {"value": "claude-3-5-haiku-20241022", "label": "Claude 3.5 Haiku"},
                    {"value": "claude-3-opus-20240229", "label": "Claude 3 Opus"},
                    {"value": "claude-3-sonnet-20240229", "label": "Claude 3 Sonnet"},
                    {"value": "claude-3-haiku-20240307", "label": "Claude 3 Haiku"},
                ]

            elif model_type == "gemini":
                import google.generativeai as genai
                
                # 允许通过环境变量设置代理/自定义端点
                api_base = os.environ.get("GEMINI_API_BASE")
                if api_base:
                    # google-auth 库会自动使用这个环境变量
                    os.environ["GOOGLE_API_ENDPOINT"] = api_base

                # 代理已经通过环境变量HTTP_PROXY和HTTPS_PROXY设置了
                # 这里直接配置API密钥即可
                genai.configure(api_key=api_key)

                models = genai.list_models()
                return [{"value": m.name, "label": m.display_name} for m in models if 'generateContent' in m.supported_generation_methods]

            else:
                raise ValueError(f"Unsupported model type: {model_type}")

        except Exception as e:
            raise ValueError(f"Failed to fetch models for {model_type}: {str(e)}")
    
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
    
    async def chat_with_ai_stream_with_context(
        self,
        project_context: dict,
        message: str,
        history: List[dict],
        model_config: ModelConfig,
        selected_template = None
    ):
        """与AI助手对话 - 流式输出（使用预先获取的上下文数据）"""
        try:
            # 初始化模型
            model = await self.get_model(model_config)
            
            # 准备对话历史
            messages = []
            
            # 添加系统提示
            system_prompt = f"""你是一个专业的AI小说写作助手。请根据以下项目信息来帮助用户：

项目信息：
- 项目名称：{project_context['project']['name']}
- 项目描述：{project_context['project']['description']}

角色信息：
{json.dumps(project_context['characters'], ensure_ascii=False, indent=2)}

世界观信息：
{json.dumps(project_context['worldviews'], ensure_ascii=False, indent=2)}

地点信息：
{json.dumps(project_context['locations'], ensure_ascii=False, indent=2)}

请以专业、友好的语调回答用户的问题，并提供有关小说创作的建议和帮助。"""
            
            messages.append(SystemMessage(content=system_prompt))
            
            # 添加历史消息
            for hist_msg in history:
                if hist_msg['role'] == 'user':
                    messages.append(HumanMessage(content=hist_msg['content']))
                elif hist_msg['role'] == 'assistant':
                    messages.append(AIMessage(content=hist_msg['content']))
            
            # 添加当前消息
            messages.append(HumanMessage(content=message))
            
            # 检查是否支持流式输出
            if hasattr(model, 'astream'):
                print(f"使用流式输出，模型类型: {type(model)}")
                try:
                    # 使用流式输出
                    chunk_count = 0
                    valid_chunk_count = 0
                    accumulated_content = ""
                    
                    async for chunk in model.astream(messages):
                        chunk_count += 1
                        
                        # 调试：打印前几个chunk的详细信息
                        if chunk_count <= 5:
                            print(f"Debug chunk {chunk_count}: type={type(chunk)}, content='{getattr(chunk, 'content', 'NO_CONTENT')}', str={str(chunk)[:100]}")
                        
                        # 检查chunk是否有content属性且内容不为空
                        if hasattr(chunk, 'content') and chunk.content is not None:
                            # 对于非空内容，直接yield，不过滤空字符串
                            if chunk.content:  # 只过滤完全为空的内容
                                valid_chunk_count += 1
                                accumulated_content += chunk.content
                                yield chunk.content
                            # 即使内容为空字符串，也不过滤，因为可能是有意义的空格
                            elif chunk.content == "":  # 空字符串也要保留
                                valid_chunk_count += 1
                                yield chunk.content
                        # 如果chunk本身就是字符串且不为空，直接yield
                        elif isinstance(chunk, str):
                            valid_chunk_count += 1
                            accumulated_content += chunk
                            yield chunk
                        # 不处理没有实际content的chunk对象
                        # 基于你的输出，这些chunk有id但content为空，应该被过滤掉
                    
                    print(f"流式输出完成，共处理了 {chunk_count} 个chunk，其中有效chunk {valid_chunk_count} 个")
                    print(f"累积内容总长度: {len(accumulated_content)}, 最后20个字符: '{accumulated_content[-20:] if accumulated_content else 'N/A'}'")
                    
                    # 如果没有有效chunks，回退到非流式
                    if valid_chunk_count == 0:
                        print("没有接收到有效chunks，回退到非流式输出")
                        response = await model.ainvoke(messages)
                        if hasattr(response, 'content') and response.content:
                            yield response.content
                        else:
                            yield str(response)
                            
                except Exception as stream_error:
                    print(f"流式输出失败，回退到非流式: {str(stream_error)}")
                    # 流式输出失败，回退到非流式
                    response = await model.ainvoke(messages)
                    if hasattr(response, 'content') and response.content:
                        yield response.content
                    else:
                        yield str(response)
            else:
                # 不支持流式输出，返回完整响应
                print("模型不支持流式输出，使用非流式")
                response = await model.ainvoke(messages)
                if hasattr(response, 'content') and response.content:
                    yield response.content
                else:
                    yield str(response)
            
        except Exception as e:
            print(f"AI对话失败: {str(e)}")
            import traceback
            traceback.print_exc()
            yield f"抱歉，AI服务暂时不可用: {str(e)}"
    
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

# 添加缺少的方法到LangChainService
async def chat_with_ai(
    self,
    project_id: int,
    message: str,
    history: List[dict],
    model_config: ModelConfig,
    db: AsyncSession,
    prompt_template_id: Optional[int] = None
) -> str:
    """与AI助手对话"""
    try:
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 初始化模型
        model = await self.get_model(model_config)
        
        # 准备对话历史
        messages = []
        
        # 获取系统提示：优先使用用户选择的模板，否则使用默认模板
        system_prompt = await self._get_system_prompt_from_template(
            prompt_template_id, project_context, db
        )
        
        messages.append(SystemMessage(content=system_prompt))
        
        # 添加历史消息
        for hist_msg in history:
            if hist_msg['role'] == 'user':
                messages.append(HumanMessage(content=hist_msg['content']))
            elif hist_msg['role'] == 'assistant':
                messages.append(AIMessage(content=hist_msg['content']))
        
        # 添加当前消息
        messages.append(HumanMessage(content=message))
        
        # 生成回复
        response = await model.ainvoke(messages)
        
        return response.content
        
    except Exception as e:
        print(f"AI对话失败: {str(e)}")
        return f"抱歉，AI服务暂时不可用: {str(e)}"

    async def _get_system_prompt_from_template(
        self,
        template_id: Optional[int],
        project_context: dict,
        db: AsyncSession
    ) -> str:
        """从模板获取系统提示，如果模板不存在则使用默认提示"""
        if template_id:
            try:
                from models import PromptTemplate
                from sqlalchemy.future import select
                
                result = await db.execute(
                    select(PromptTemplate).where(PromptTemplate.id == template_id)
                )
                template = result.scalar_one_or_none()
                
                if template:
                    # 准备模板变量
                    template_variables = {
                        'project_name': project_context['project']['name'],
                        'project_description': project_context['project']['description'],
                        'project_info': json.dumps(project_context['project'], ensure_ascii=False, indent=2),
                        'history': '',  # 将在实际使用中填充
                        'message': '',  # 将在实际使用中填充
                        'current_chapter': '',  # 可以根据需要添加
                        'current_content': '',  # 可以根据需要添加
                        'user_message': ''  # 将在实际使用中填充
                    }
                    
                    # 渲染模板
                    rendered_template = template.template
                    for key, value in template_variables.items():
                        rendered_template = rendered_template.replace(f'{{{{{key}}}}}', str(value))
                    
                    return rendered_template
            except Exception as e:
                print(f"获取模板失败: {str(e)}")
        
        # 默认提示
        return f"""你是一个专业的AI小说写作助手。请根据以下项目信息来帮助用户：

项目信息：
- 项目名称：{project_context['project']['name']}
- 项目描述：{project_context['project']['description']}

角色信息：
{json.dumps(project_context['characters'], ensure_ascii=False, indent=2)}

世界观信息：
{json.dumps(project_context['worldviews'], ensure_ascii=False, indent=2)}

地点信息：
{json.dumps(project_context['locations'], ensure_ascii=False, indent=2)}

请以专业、友好的语调回答用户的问题，并提供有关小说创作的建议和帮助。"""

async def optimize_content(
    self,
    project_id: int,
    content: str,
    optimization_type: str,
    model_config: ModelConfig,
    db: AsyncSession
) -> str:
    """优化内容"""
    try:
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 初始化模型
        model = await self.get_model(model_config)
        
        # 准备优化提示
        optimization_prompt = f"""请优化以下小说内容：

项目信息：
- 项目名称：{project_context['project']['name']}
- 项目描述：{project_context['project']['description']}

优化类型：{optimization_type}

原内容：
{content}

请提供优化后的内容，要求：
1. 保持原意和核心情节
2. 改进语言表达和文字流畅度
3. 增强文学性和可读性
4. 符合项目的整体风格和设定"""
        
        messages = [
            SystemMessage(content="你是一个专业的小说编辑和内容优化专家。"),
            HumanMessage(content=optimization_prompt)
        ]
        
        # 生成优化内容
        response = await model.ainvoke(messages)
        
        return response.content
        
    except Exception as e:
        print(f"内容优化失败: {str(e)}")
        return f"内容优化失败: {str(e)}"

async def generate_creative_ideas(
    self,
    project_id: int,
    prompt: str,
    category: str,
    model_config: ModelConfig,
    db: AsyncSession
) -> dict:
    """生成创意想法"""
    try:
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 初始化模型
        model = await self.get_model(model_config)
        
        # 准备创意生成提示
        creative_prompt = f"""请为以下小说项目生成创意想法：

项目信息：
- 项目名称：{project_context['project']['name']}
- 项目描述：{project_context['project']['description']}

角色信息：
{json.dumps(project_context['characters'], ensure_ascii=False, indent=2)}

世界观信息：
{json.dumps(project_context['worldviews'], ensure_ascii=False, indent=2)}

地点信息：
{json.dumps(project_context['locations'], ensure_ascii=False, indent=2)}

用户需求：{prompt}

创意类别：{category}

请提供有创意、有深度的想法，要求：
1. 符合项目的整体设定和风格
2. 具有创新性和独特性
3. 能够推动故事发展或丰富角色塑造
4. 具有可实施性

请以JSON格式返回，包含以下字段：
- ideas: 创意想法列表
- category: 类别
- difficulty: 实施难度（1-5）
- impact: 对故事的影响（1-5）"""
        
        messages = [
            SystemMessage(content="你是一个富有创造力的小说写作专家，擅长提供独特的创意想法。"),
            HumanMessage(content=creative_prompt)
        ]
        
        # 生成创意想法
        response = await model.ainvoke(messages)
        
        # 尝试解析JSON响应
        try:
            ideas_json = json.loads(response.content)
            return ideas_json
        except json.JSONDecodeError:
            # 如果不是JSON格式，返回原始内容
            return {
                "ideas": [response.content],
                "category": category,
                "difficulty": 3,
                "impact": 3
            }
        
    except Exception as e:
        print(f"创意想法生成失败: {str(e)}")
        return {
            "ideas": [f"创意想法生成失败: {str(e)}"],
            "category": category,
            "difficulty": 1,
            "impact": 1
        }

async def chat_with_ai_stream(
    self,
    project_id: int,
    message: str,
    history: List[dict],
    model_config: ModelConfig,
    db: AsyncSession
):
    """与AI助手对话 - 流式输出"""
    try:
        # 获取项目上下文
        project_context = await self._get_project_context(project_id, db)
        
        # 初始化模型
        model = await self.get_model(model_config)
        
        # 准备对话历史
        messages = []
        
        # 获取系统提示：优先使用模板，否则使用默认提示
        if selected_template:
            # 准备模板变量
            template_variables = {
                'project_name': project_context['project']['name'],
                'project_description': project_context['project']['description'],
                'project_info': json.dumps(project_context['project'], ensure_ascii=False, indent=2),
                'history': json.dumps(history, ensure_ascii=False, indent=2) if history else '',
                'message': message,
                'current_chapter': '',  # 可以根据需要添加
                'current_content': '',  # 可以根据需要添加
                'user_message': message
            }
            
            # 渲染模板
            system_prompt = selected_template.template
            for key, value in template_variables.items():
                system_prompt = system_prompt.replace(f'{{{{{key}}}}}', str(value))
        else:
            # 默认系统提示
            system_prompt = f"""你是一个专业的AI小说写作助手。请根据以下项目信息来帮助用户：

项目信息：
- 项目名称：{project_context['project']['name']}
- 项目描述：{project_context['project']['description']}

角色信息：
{json.dumps(project_context['characters'], ensure_ascii=False, indent=2)}

世界观信息：
{json.dumps(project_context['worldviews'], ensure_ascii=False, indent=2)}

地点信息：
{json.dumps(project_context['locations'], ensure_ascii=False, indent=2)}

请以专业、友好的语调回答用户的问题，并提供有关小说创作的建议和帮助。"""
        
        messages.append(SystemMessage(content=system_prompt))
        
        # 添加历史消息
        for hist_msg in history:
            if hist_msg['role'] == 'user':
                messages.append(HumanMessage(content=hist_msg['content']))
            elif hist_msg['role'] == 'assistant':
                messages.append(AIMessage(content=hist_msg['content']))
        
        # 添加当前消息
        messages.append(HumanMessage(content=message))
        
        # 检查是否支持流式输出
        if hasattr(model, 'astream'):
            print(f"使用流式输出，模型类型: {type(model)}")
            try:
                # 使用流式输出
                chunk_count = 0
                valid_chunk_count = 0
                accumulated_content = ""
                
                async for chunk in model.astream(messages):
                    chunk_count += 1
                    
                    # 调试：打印前几个chunk的详细信息
                    if chunk_count <= 5:
                        print(f"Debug chunk {chunk_count}: type={type(chunk)}, content='{getattr(chunk, 'content', 'NO_CONTENT')}', str={str(chunk)[:100]}")
                    
                    # 检查chunk是否有content属性且内容不为空
                    if hasattr(chunk, 'content') and chunk.content is not None:
                        # 对于非空内容，直接yield，不过滤空字符串
                        if chunk.content:  # 只过滤完全为空的内容
                            valid_chunk_count += 1
                            accumulated_content += chunk.content
                            yield chunk.content
                        # 即使内容为空字符串，也不过滤，因为可能是有意义的空格
                        elif chunk.content == "":  # 空字符串也要保留
                            valid_chunk_count += 1
                            yield chunk.content
                    # 如果chunk本身就是字符串且不为空，直接yield
                    elif isinstance(chunk, str):
                        valid_chunk_count += 1
                        accumulated_content += chunk
                        yield chunk
                    # 不处理没有实际content的chunk对象
                    # 基于你的输出，这些chunk有id但content为空，应该被过滤掉
                
                print(f"流式输出完成，共处理了 {chunk_count} 个chunk，其中有效chunk {valid_chunk_count} 个")
                print(f"累积内容总长度: {len(accumulated_content)}, 最后20个字符: '{accumulated_content[-20:] if accumulated_content else 'N/A'}'")
                
                # 如果没有有效chunks，回退到非流式
                if valid_chunk_count == 0:
                    print("没有接收到有效chunks，回退到非流式输出")
                    response = await model.ainvoke(messages)
                    if hasattr(response, 'content') and response.content:
                        yield response.content
                    else:
                        yield str(response)
                        
            except Exception as stream_error:
                print(f"流式输出失败，回退到非流式: {str(stream_error)}")
                # 流式输出失败，回退到非流式
                response = await model.ainvoke(messages)
                if hasattr(response, 'content') and response.content:
                    yield response.content
                else:
                    yield str(response)
        else:
            # 不支持流式输出，返回完整响应
            print("模型不支持流式输出，使用非流式")
            response = await model.ainvoke(messages)
            if hasattr(response, 'content') and response.content:
                yield response.content
            else:
                yield str(response)
        
    except Exception as e:
        print(f"AI对话失败: {str(e)}")
        import traceback
        traceback.print_exc()
        yield f"抱歉，AI服务暂时不可用: {str(e)}"

# 将方法添加到LangChainService类
LangChainService.chat_with_ai = chat_with_ai
LangChainService.optimize_content = optimize_content
LangChainService.generate_creative_ideas = generate_creative_ideas
LangChainService.chat_with_ai_stream = chat_with_ai_stream
