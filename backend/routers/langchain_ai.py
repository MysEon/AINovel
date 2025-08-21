"""
LangChain和LangGraph相关的API路由
提供AI辅助小说创作的高级功能
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User, Project, ModelConfig
from schemas import (
    ChapterOutlineRequest, ChapterOutlineResponse,
    ChapterDraftRequest, ChapterDraftResponse,
    CharacterDialogueRequest, CharacterDialogueResponse,
    PlotSuggestionRequest, PlotSuggestionResponse,
    WritingWorkflowRequest, WritingWorkflowResponse,
    LangGraphAgentRequest, LangGraphAgentResponse,
    ChatRequest, ChatResponse,
    OptimizeContentRequest, OptimizeContentResponse,
    CreativeIdeasRequest, CreativeIdeasResponse,
    MessageResponse
)
from .auth import get_current_user_dependency
from langchain_service import langchain_service, langgraph_service

router = APIRouter(
    prefix="/api/ai",
    tags=["AI辅助：LangChain/LangGraph"],
    dependencies=[Depends(get_current_user_dependency)]
)


async def get_model_config_for_user(config_id: int, user_id: int, db: AsyncSession) -> ModelConfig:
    """获取用户的模型配置"""
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id,
            ModelConfig.user_id == user_id
        )
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模型配置不存在或无权访问"
        )
    
    return config


async def get_project_for_user(project_id: int, user_id: int, db: AsyncSession) -> Project:
    """获取用户的项目"""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在或无权访问"
        )
    
    return project


@router.post("/chapter-outline", response_model=ChapterOutlineResponse, status_code=status.HTTP_201_CREATED)
async def generate_chapter_outline(
    request: ChapterOutlineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """生成章节大纲"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 生成大纲
        outline = await langchain_service.generate_chapter_outline(
            request.project_id,
            request.chapter_number,
            request.user_requirements,
            model_config,
            db
        )
        
        return ChapterOutlineResponse(
            success=True,
            outline=outline,
            message="章节大纲生成成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成章节大纲失败: {str(e)}"
        )


@router.post("/chapter-draft", response_model=ChapterDraftResponse, status_code=status.HTTP_201_CREATED)
async def generate_chapter_draft(
    request: ChapterDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """生成章节草稿"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 生成草稿
        content = await langchain_service.generate_chapter_draft(
            request.project_id,
            request.chapter_outline,
            model_config,
            db
        )
        
        # 计算字数
        word_count = len(content)
        
        return ChapterDraftResponse(
            success=True,
            content=content,
            message="章节草稿生成成功",
            word_count=word_count,
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成章节草稿失败: {str(e)}"
        )


@router.post("/character-dialogue", response_model=CharacterDialogueResponse, status_code=status.HTTP_201_CREATED)
async def generate_character_dialogue(
    request: CharacterDialogueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """生成角色对话"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 生成对话
        dialogue = await langchain_service.generate_character_dialogue(
            request.project_id,
            request.character_names,
            request.situation,
            model_config,
            db
        )
        
        return CharacterDialogueResponse(
            success=True,
            dialogue=dialogue,
            message="角色对话生成成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成角色对话失败: {str(e)}"
        )


@router.post("/plot-suggestions", response_model=PlotSuggestionResponse, status_code=status.HTTP_201_CREATED)
async def get_plot_suggestions(
    request: PlotSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取情节发展建议"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 获取建议
        suggestions = await langchain_service.get_plot_suggestions(
            request.project_id,
            request.current_chapter_content,
            model_config,
            db
        )
        
        return PlotSuggestionResponse(
            success=True,
            suggestions=suggestions,
            message="情节建议生成成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取情节建议失败: {str(e)}"
        )


@router.post("/writing-workflow", response_model=WritingWorkflowResponse, status_code=status.HTTP_201_CREATED)
async def run_writing_workflow(
    request: WritingWorkflowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """运行写作工作流"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 运行工作流
        result = await langgraph_service.run_writing_workflow(
            request.project_id,
            request.task,
            model_config,
            db
        )
        
        return WritingWorkflowResponse(
            success=True,
            result=result,
            workflow_type=request.workflow_type,
            message="写作工作流执行成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"运行写作工作流失败: {str(e)}"
        )


@router.post("/agent-chat", response_model=LangGraphAgentResponse, status_code=status.HTTP_201_CREATED)
async def chat_with_agent(
    request: LangGraphAgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """与LangGraph智能体对话"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 获取或创建智能体
        agent = await langgraph_service.create_novel_writing_agent(
            request.project_id,
            model_config,
            db
        )
        
        # 准备配置
        config = {"configurable": {"thread_id": request.thread_id or f"project_{request.project_id}"}}
        
        # 运行智能体
        from langchain_core.messages import HumanMessage
        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=request.message)]},
            config=config
        )
        
        # 提取回复
        response_text = ""
        messages = []
        
        for msg in result.get("messages", []):
            messages.append({
                "role": msg.type if hasattr(msg, 'type') else "unknown",
                "content": msg.content
            })
            if hasattr(msg, 'type') and msg.type == "ai":
                response_text = msg.content
        
        return LangGraphAgentResponse(
            success=True,
            response=response_text,
            messages=messages,
            thread_id=config["configurable"]["thread_id"],
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"智能体对话失败: {str(e)}"
        )


@router.get("/models/available", response_model=List[dict])
async def get_available_ai_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取用户可用的AI模型列表"""
    try:
        result = await db.execute(
            select(ModelConfig).where(ModelConfig.user_id == current_user.id)
        )
        configs = result.scalars().all()
        
        available_models = []
        for config in configs:
            available_models.append({
                "id": config.id,
                "name": config.name,
                "model_type": config.model_type,
                "model_name": config.model_name,
                "created_at": config.created_at
            })
        
        return available_models
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取可用模型失败: {str(e)}"
        )


@router.get("/project-context/{project_id}", response_model=dict)
async def get_project_ai_context(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取项目的AI上下文信息"""
    try:
        # 验证项目权限
        await get_project_for_user(project_id, current_user.id, db)
        
        # 获取项目上下文
        context = await langchain_service._get_project_context(project_id, db)
        
        return {
            "success": True,
            "context": context,
            "message": "项目上下文获取成功"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取项目上下文失败: {str(e)}"
        )


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def chat_with_ai(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """与AI助手对话"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 使用LangChain服务进行对话
        response = await langchain_service.chat_with_ai(
            request.project_id,
            request.message,
            request.history,
            model_config,
            db
        )
        
        return ChatResponse(
            success=True,
            response=response,
            message="AI对话成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI对话失败: {str(e)}"
        )


@router.post("/optimize-content", response_model=OptimizeContentResponse, status_code=status.HTTP_201_CREATED)
async def optimize_content(
    request: OptimizeContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """优化内容"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 优化内容
        optimized_content = await langchain_service.optimize_content(
            request.project_id,
            request.content,
            request.optimization_type,
            model_config,
            db
        )
        
        return OptimizeContentResponse(
            success=True,
            optimized_content=optimized_content,
            message="内容优化成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"内容优化失败: {str(e)}"
        )


@router.post("/creative-ideas", response_model=CreativeIdeasResponse, status_code=status.HTTP_201_CREATED)
async def generate_creative_ideas(
    request: CreativeIdeasRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """生成创意想法"""
    try:
        # 验证项目权限
        await get_project_for_user(request.project_id, current_user.id, db)
        
        # 获取模型配置
        model_config = await get_model_config_for_user(request.model_config_id, current_user.id, db)
        
        # 生成创意想法
        ideas = await langchain_service.generate_creative_ideas(
            request.project_id,
            request.prompt,
            request.category,
            model_config,
            db
        )
        
        return CreativeIdeasResponse(
            success=True,
            ideas=ideas,
            message="创意想法生成成功",
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创意想法生成失败: {str(e)}"
        )