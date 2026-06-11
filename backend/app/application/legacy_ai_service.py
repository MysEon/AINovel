"""旧 AI 接口兼容层 Application Service

职责：
- chat / chat_stream：消息历史构建、role 映射、system prompt 注入
- simple_generate：通用单轮生成（6 个遗留端点共用）
"""

import logging
from collections.abc import AsyncIterator
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service

from .project_service import ProjectService

logger = logging.getLogger(__name__)

_encryption_service = get_encryption_service()


class LegacyAIService:
    """旧 AI 接口兼容业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.proj_service = ProjectService(db)

    async def _get_config_and_model(self, config_id: int, user_id: int):
        """获取模型配置并构建 ChatModel"""
        from app.infrastructure.llm.provider_adapters import ProviderConfig, get_provider

        result = await self.db.execute(
            select(ModelConfig).where(
                ModelConfig.id == config_id,
                ModelConfig.user_id == user_id,
            )
        )
        cfg = result.scalar_one_or_none()
        if not cfg:
            raise NotFoundError("模型配置不存在或无权访问")
        if not cfg.api_key:
            raise ForbiddenError("该模型配置没有保存 API 密钥")

        provider = get_provider(cfg.model_type)
        decrypted_key = _encryption_service.decrypt(cfg.api_key)
        pcfg = ProviderConfig(
            api_key=decrypted_key,
            model_name=cfg.model_name or "",
            temperature=float(cfg.temperature) if cfg.temperature else 0.7,
            max_tokens=cfg.max_tokens or 2000,
            api_url=cfg.api_url,
            proxy_url=cfg.proxy_url if cfg.enable_proxy else None,
        )
        return provider.build_chat_model(pcfg)

    async def chat(
        self,
        project_id: int,
        model_config_id: int,
        message: str,
        history: list | None,
        user_id: int,
    ) -> dict:
        """兼容旧 /api/ai/chat — 非流式对话"""
        project = await self.proj_service.require_user_project(project_id, user_id)
        model = await self._get_config_and_model(model_config_id, user_id)

        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=f"你是一个专业的小说写作助手。当前项目：{project.name}"),
        ]
        if history:
            for msg in history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "assistant":
                    from langchain_core.messages import AIMessage

                    messages.append(AIMessage(content=content))
                else:
                    messages.append(HumanMessage(content=content))
        messages.append(HumanMessage(content=message))

        resp = await model.ainvoke(messages)
        return {
            "success": True,
            "response": resp.content,
            "message": "AI对话成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def chat_stream(
        self,
        project_id: int,
        model_config_id: int,
        message: str,
        history: list | None,
        user_id: int,
    ) -> AsyncIterator[str]:
        """兼容旧 /api/ai/chat-stream — SSE 流式对话"""
        project = await self.proj_service.require_user_project(project_id, user_id)
        model = await self._get_config_and_model(model_config_id, user_id)

        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=f"你是一个专业的小说写作助手。当前项目：{project.name}"),
        ]
        if history:
            for msg in history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "assistant":
                    messages.append(AIMessage(content=content))
                else:
                    messages.append(HumanMessage(content=content))
        messages.append(HumanMessage(content=message))

        async def generate():
            try:
                async for chunk in model.astream(messages):
                    if chunk.content:
                        yield f"data: {chunk.content}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.exception("legacy chat-stream error")
                yield f"data: 抱歉，AI服务暂时不可用: {str(e)}\n\n"
                yield "data: [DONE]\n\n"

        return generate()

    async def simple_generate(
        self,
        project_id: int,
        model_config_id: int,
        user_id: int,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """通用单轮生成：构建消息 → 调用模型 → 返回文本"""
        await self.proj_service.require_user_project(project_id, user_id)

        model = await self._get_config_and_model(model_config_id, user_id)

        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        resp = await model.ainvoke(messages)
        return resp.content

    async def chapter_outline(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/chapter-outline"""
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt="你是一个专业的小说写作助手。请为指定章节创建详细的写作大纲，返回JSON格式。",
            user_prompt=f"第{body.chapter_number or 1}章大纲。"
            + (f"要求：{body.user_requirements}" if body.user_requirements else ""),
        )
        return {
            "success": True,
            "outline": text,
            "message": "章节大纲生成成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def chapter_draft(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/chapter-draft"""
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt="你是一个专业的小说写作助手。请根据大纲生成章节草稿内容。",
            user_prompt=f"大纲：{body.chapter_outline or '无'}",
        )
        return {
            "success": True,
            "content": text,
            "message": "章节草稿生成成功",
            "word_count": len(text),
            "generated_at": datetime.now().isoformat(),
        }

    async def character_dialogue(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/character-dialogue"""
        names = ", ".join(body.character_names) if body.character_names else "角色"
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt="你是一个专业的小说写作助手。请根据角色和场景生成对话。",
            user_prompt=f"角色：{names}\n场景：{body.situation or '无'}",
        )
        return {
            "success": True,
            "dialogue": text,
            "message": "角色对话生成成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def plot_suggestions(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/plot-suggestions"""
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt="你是一个专业的小说写作助手。请提供情节发展建议。",
            user_prompt=body.user_requirements or "请给出下一步情节建议",
        )
        return {
            "success": True,
            "suggestions": text,
            "message": "情节建议生成成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def optimize_content(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/optimize-content"""
        opt_type = body.optimization_type or "polish"
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt=f"你是一个专业的小说写作助手。请对以下内容进行{opt_type}优化。",
            user_prompt=body.content or "",
        )
        return {
            "success": True,
            "optimized_content": text,
            "message": "内容优化成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def creative_ideas(self, body, user_id: int) -> dict:
        """兼容旧 /api/ai/creative-ideas"""
        category = body.category or "general"
        text = await self.simple_generate(
            project_id=body.project_id,
            model_config_id=body.model_config_id,
            user_id=user_id,
            system_prompt=f"你是一个专业的小说写作助手。请围绕'{category}'类别生成创意想法。",
            user_prompt=body.prompt or "请给出创意想法",
        )
        return {
            "success": True,
            "ideas": text,
            "message": "创意想法生成成功",
            "generated_at": datetime.now().isoformat(),
        }

    async def get_project_context(self, project_id: int, user_id: int) -> dict:
        """获取项目上下文"""
        project = await self.proj_service.require_user_project(project_id, user_id)
        return {
            "success": True,
            "context": {
                "project_name": project.name,
                "project_description": project.description or "",
            },
            "message": "项目上下文获取成功",
        }

    def available_models(self) -> dict:
        """兼容旧模型列表"""
        return {
            "success": True,
            "models": [
                {"provider": "openai", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]},
                {"provider": "anthropic", "models": ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"]},
                {"provider": "gemini", "models": ["gemini-2.0-flash", "gemini-1.5-pro"]},
            ],
            "message": "请使用 GET /api/v1/model-configs/list-models 获取实时模型列表",
        }
