"""旧 AI 接口兼容层 Application Service

职责：
- chat / chat_stream：消息历史构建、role 映射、system prompt 注入
- 章节分层注入：L1 当前章全文 / L2 近 3 章详细 / L3 更早 ≤6 章简要（共 ≤10 章）
- context 超限三段渐进降级（保最新内容优先）
- simple_generate：通用单轮生成（6 个遗留端点共用）
"""

import logging
import re
from collections.abc import AsyncIterator
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service

from .project_service import ProjectService

logger = logging.getLogger(__name__)

_encryption_service = get_encryption_service()


# Context 超限渐进降级 stage：
# stage 0: L1 全文，保留 L2
# stage 1: L1 截断到最后 1 万字，保留 L2
# stage 2: L1 截断到最后 5 千字，丢 L2 仅保留 L3
DEGRADATION_STAGES: list[dict] = [
    {"l1_tail_chars": None, "include_l2": True, "label": "full"},
    {"l1_tail_chars": 10000, "include_l2": True, "label": "trim-l1-10k"},
    {"l1_tail_chars": 5000, "include_l2": False, "label": "trim-l1-5k+drop-l2"},
]

# Context 超限错误关键词：匹配 LLM provider 常见 token-limit 文案
_CONTEXT_LIMIT_KEYWORDS = (
    "context length",
    "maximum context",
    "context window",
    "token limit",
    "context_length_exceeded",
    "prompt is too long",
    "request too large",
    "input length",
)


def _is_context_length_error(exc: Exception) -> bool:
    """判断 LLM 抛出的异常是否属于 context 超限。"""
    msg = str(exc).lower()
    return any(kw in msg for kw in _CONTEXT_LIMIT_KEYWORDS)


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

    async def _build_chat_system_prompt(
        self,
        project,
        history: list | None,
        message: str,
        user_id: int,
        prompt_template_id: int | None,
    ) -> str | None:
        """构建 legacy chat system prompt，支持可选提示词模板渲染。"""
        if prompt_template_id is None:
            return None

        from app.application.ai_context_builder import AIContextBuilder
        from app.application.prompt_template_service import PromptTemplateService

        template = await PromptTemplateService(self.db).get_template(prompt_template_id, user_id)
        context_builder = AIContextBuilder(self.db)
        project_context = context_builder.format_for_chat_with_budget(
            await context_builder.get_project_context(project.id, mode="chat")
        )
        recent_history = history[-10:] if history else []
        history_lines = [
            f"助手: {msg.get('content', '')}" if msg.get("role") == "assistant" else f"用户: {msg.get('content', '')}"
            for msg in recent_history
        ]
        history_text = "\n".join(history_lines)
        if history_text:
            history_text += "\n"
        variables = {
            "project_info": f"{project.name} - {project.description or ''}".rstrip(),
            "project_context": project_context,
            "history": history_text,
            "message": message,
        }

        rendered = template.template
        for key, value in variables.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", str(value))

        leftovers = re.findall(r"\{\{[^{}]+\}\}", rendered)
        if leftovers:
            logger.warning(
                "prompt template %s has unresolved variables: %s",
                prompt_template_id,
                leftovers,
            )
        return rendered

    async def _record_prompt_template_usage(self, template_id: int, user_id: int) -> None:
        """记录提示词模板使用次数，失败不影响主流程。"""
        from app.application.prompt_template_service import PromptTemplateService

        try:
            await PromptTemplateService(self.db).record_usage(template_id, user_id)
        except Exception:
            logger.warning("failed to record prompt template usage: %s", template_id, exc_info=True)

    def _get_session_factory(self):
        """获取供 LangGraph tool 独立开 session 使用的 session factory。"""
        from app.infrastructure.db.session import get_session_factory

        return get_session_factory()

    def _build_chat_messages(self, message: str, history: list | None):
        from langchain_core.messages import AIMessage, HumanMessage

        messages = []
        if history:
            for msg in history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "assistant":
                    messages.append(AIMessage(content=content))
                else:
                    messages.append(HumanMessage(content=content))
        messages.append(HumanMessage(content=message))
        return messages

    async def _load_tiered_chapter_segment(
        self,
        project_id: int,
        current_chapter_id: int | None,
        chat_model,
        *,
        stage: dict,
    ) -> str | None:
        """获取分层章节上下文并按 stage 渲染为 prompt 段。

        无 current_chapter_id 时返回 None（向后兼容旧无章节注入路径）。
        摘要生成失败的章节在渲染段中标记『（摘要生成失败，本章已跳过）』，
        不致命；只有 LLM context 超限错误才会冒出到外层降级链。
        """
        if not current_chapter_id:
            return None
        from app.application.ai_context_builder import AIContextBuilder

        builder = AIContextBuilder(self.db)
        tiered = await builder.get_tiered_chapter_context(
            project_id=project_id,
            current_chapter_id=current_chapter_id,
            chat_model=chat_model,
        )
        return AIContextBuilder.render_tiered_chapter_segment(
            tiered,
            l1_tail_chars=stage["l1_tail_chars"],
            include_l2=stage["include_l2"],
        )

    async def chat(
        self,
        project_id: int,
        model_config_id: int,
        message: str,
        history: list | None,
        user_id: int,
        prompt_template_id: int | None = None,
        current_chapter_id: int | None = None,
    ) -> dict:
        """兼容旧 /api/ai/chat — 非流式对话，含章节分层注入与三段渐进降级。"""
        project = await self.proj_service.require_user_project(project_id, user_id)
        model = await self._get_config_and_model(model_config_id, user_id)

        import app.infrastructure.graph.workflows  # noqa: F401
        from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext
        from app.infrastructure.graph.registry import graph_registry

        injected_system_prompt = await self._build_chat_system_prompt(
            project=project,
            history=history,
            message=message,
            user_id=user_id,
            prompt_template_id=prompt_template_id,
        )

        graph = graph_registry.get("chat_assistant")(model=model)
        last_error: Exception | None = None
        for stage in DEGRADATION_STAGES:
            chapter_segment = await self._load_tiered_chapter_segment(
                project_id, current_chapter_id, model, stage=stage
            )
            context = ChatAssistantContext(
                project_id=project_id,
                session_factory=self._get_session_factory(),
                injected_system_prompt=injected_system_prompt,
                chapter_context_segment=chapter_segment,
            )
            try:
                result = await graph.ainvoke(
                    {"messages": self._build_chat_messages(message, history)},
                    context=context,
                )
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if not _is_context_length_error(exc):
                    raise
                logger.warning(
                    "chat 触发 context 超限降级 stage=%s project_id=%s chapter_id=%s error=%s",
                    stage["label"],
                    project_id,
                    current_chapter_id,
                    exc,
                )
        else:
            raise ValidationError(
                "当前章节内容过长，请考虑分章后再使用 AI 助手",
                detail=str(last_error),
            )

        if prompt_template_id is not None:
            await self._record_prompt_template_usage(prompt_template_id, user_id)
        response = result["messages"][-1].content
        return {
            "success": True,
            "response": response,
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
        prompt_template_id: int | None = None,
        current_chapter_id: int | None = None,
    ) -> AsyncIterator[str]:
        """兼容旧 /api/ai/chat-stream — SSE 流式对话，含章节分层注入与三段渐进降级。"""
        project = await self.proj_service.require_user_project(project_id, user_id)
        model = await self._get_config_and_model(model_config_id, user_id)

        import app.infrastructure.graph.workflows  # noqa: F401
        from app.infrastructure.graph.chat_assistant_types import ChatAssistantContext
        from app.infrastructure.graph.registry import graph_registry
        from app.infrastructure.graph.sse_events import stream_agent_events

        injected_system_prompt = await self._build_chat_system_prompt(
            project=project,
            history=history,
            message=message,
            user_id=user_id,
            prompt_template_id=prompt_template_id,
        )

        graph = graph_registry.get("chat_assistant")(model=model)

        # 流式场景：先尝试每个 stage 的"准备阶段"——因为 SSE 一旦开始 yield 就无法回滚，
        # 这里只是把章节段渲染为 stage[0] 默认值；如果整个 ainvoke 在第一个 chunk 之前抛
        # context 错，外层 generate() 仍可在迭代器内捕获并切换到下一 stage。
        async def generate():
            last_error: Exception | None = None
            for stage in DEGRADATION_STAGES:
                chapter_segment = await self._load_tiered_chapter_segment(
                    project_id, current_chapter_id, model, stage=stage
                )
                context = ChatAssistantContext(
                    project_id=project_id,
                    session_factory=self._get_session_factory(),
                    injected_system_prompt=injected_system_prompt,
                    chapter_context_segment=chapter_segment,
                )
                input_state = {"messages": self._build_chat_messages(message, history)}
                stage_started = False
                try:
                    async for event in stream_agent_events(graph, input_state, context=context):
                        stage_started = True
                        yield event
                    if prompt_template_id is not None:
                        await self._record_prompt_template_usage(prompt_template_id, user_id)
                    return
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    # 已经开始 yield 了无法重试，直接抛
                    if stage_started or not _is_context_length_error(exc):
                        raise
                    logger.warning(
                        "chat_stream 触发 context 超限降级 stage=%s project_id=%s chapter_id=%s error=%s",
                        stage["label"],
                        project_id,
                        current_chapter_id,
                        exc,
                    )
            raise ValidationError(
                "当前章节内容过长，请考虑分章后再使用 AI 助手",
                detail=str(last_error),
            )

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
