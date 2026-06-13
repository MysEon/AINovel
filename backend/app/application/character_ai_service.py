"""角色 AI 生成 Application Service。"""

import json
import logging

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ai_context_builder import AIContextBuilder
from app.application.project_service import ProjectService
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.model_scenarios import DEFAULT_SCENARIOS, MODEL_SCENARIOS
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service
from app.schemas.character_ai import (
    MAX_REFERENCES_PER_REQUEST,
    AIGenerateCharacterRequest,
    CharacterDraftSchema,
    ReferenceItem,
)

logger = logging.getLogger(__name__)

_encryption_service = get_encryption_service()

try:
    from langchain_core.exceptions import OutputParserException
except ImportError:  # pragma: no cover - 兼容不同 langchain_core 版本
    _PARSE_EXCEPTIONS: tuple[type[Exception], ...] = (PydanticValidationError, ValueError)
else:
    _PARSE_EXCEPTIONS = (OutputParserException, PydanticValidationError, ValueError)


class CharacterAIService:
    """角色 AI 生成业务服务。"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.proj_service = ProjectService(db)

    @staticmethod
    def _parse_scenarios(raw: str | None) -> list[str]:
        if raw is None:
            return MODEL_SCENARIOS.copy()
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return DEFAULT_SCENARIOS.copy()
        return parsed if isinstance(parsed, list) else DEFAULT_SCENARIOS.copy()

    async def _get_model_config(self, config_id: int, user_id: int) -> ModelConfig:
        result = await self.db.execute(
            select(ModelConfig).where(
                ModelConfig.id == config_id,
                ModelConfig.user_id == user_id,
            )
        )
        cfg = result.scalar_one_or_none()
        if not cfg:
            raise NotFoundError("模型配置不存在或无权访问")
        return cfg

    async def _get_config_and_model(self, config_id: int, user_id: int):
        """获取已授权的模型配置并构建 ChatModel。"""
        from app.infrastructure.llm.provider_adapters import ProviderConfig, get_provider

        cfg = await self._get_model_config(config_id, user_id)
        scenarios = self._parse_scenarios(cfg.scenarios)
        if "character_generation" not in scenarios:
            raise ForbiddenError("该模型未授权用于角色生成场景")
        if not cfg.api_key:
            raise ForbiddenError("该模型配置没有保存 API 密钥")

        provider = get_provider(cfg.model_type)
        pcfg = ProviderConfig(
            api_key=_encryption_service.decrypt(cfg.api_key),
            model_name=cfg.model_name or "",
            temperature=float(cfg.temperature) if cfg.temperature else 0.7,
            max_tokens=cfg.max_tokens or 2000,
            top_p=float(cfg.top_p) if cfg.top_p else 1.0,
            api_url=cfg.api_url,
            proxy_url=cfg.proxy_url if cfg.enable_proxy else None,
            frequency_penalty=float(cfg.frequency_penalty) if cfg.frequency_penalty else 0.0,
            presence_penalty=float(cfg.presence_penalty) if cfg.presence_penalty else 0.0,
            stop_sequences=self._parse_stop_sequences(cfg.stop_sequences),
        )
        return cfg, provider.build_chat_model(pcfg)

    @staticmethod
    def _parse_stop_sequences(raw: str | None) -> list[str] | None:
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        return parsed if isinstance(parsed, list) else None

    @staticmethod
    def _build_structured_model(chat_model):
        try:
            return chat_model.with_structured_output(CharacterDraftSchema, method="json_mode")
        except TypeError:
            return chat_model.with_structured_output(CharacterDraftSchema)

    @staticmethod
    def _build_messages(
        description: str,
        *,
        retry: bool = False,
        references_text: str = "",
    ):
        from langchain_core.messages import HumanMessage, SystemMessage

        system_prompt = """
你是一个专业的小说角色档案生成器。根据用户描述，生成完整的中文角色档案。

请严格按以下 JSON schema 输出：

{
  "name": "string，角色姓名（必填）",
  "description": "string，一句话定位（区别于 personality 详述）",
  "personality": "string，性格特点详述",
  "background": "string，身世经历背景",
  "appearance": "string，外貌描述",
  "age": "string，年龄（即使是数字也用字符串，如 \"17\" 或 \"永生\"）",
  "species": "string，种族",
  "alignment": "string，阵营 / 立场",
  "abilities": "string，能力 / 技能",
  "weaknesses": "string，弱点 / 缺陷",
  "dimensions": {"任意中文键名": 0-100 整数, ...}（如自我认同、社交能力、焦虑、智力、体力、魅力等，3-6 个为宜）,
  "extra_fields": {
    "core_conflict": "string，核心冲突",
    "inner_monologue": "string，内心独白",
    "relationships": {"father": "string", "mother": "string", ...},
    "habits": "string",
    "catchphrase": "string",
    "dreams": "string",
    "tags": ["string", ...]
  }
}

注意：
- age 字段无论数字大小都要用字符串
- dimensions 的键名要贴合角色特点（如心理类角色用"焦虑"、"自我认同"，战斗类用"武力"、"敏捷"）
- extra_fields 内的字段都是可选，但能丰富角色就尽量填；这些字段会作为额外属性存入角色档案
- 不要把 extra_fields 里的字段平铺到顶层
""".strip()
        if references_text:
            system_prompt += (
                "\n\n以下是用户在本项目中已建档的相关实体，作为生成参考。"
                "请根据用户描述自行判断新角色与它们的关系，并保持新角色的家世/外貌/背景/关系等信息与已记载内容一致；"
                "若新角色与某个已知实体存在亲属、敌对、归属或地缘关系，必须在 extra_fields.relationships 中如实记录。\n\n"
                f"{references_text}"
            )
        if retry:
            system_prompt += (
                "\n\n上次输出无法解析。请严格按上述 schema：age 必须是字符串；"
                "dimensions 的值是 0-100 整数；扩展字段必须嵌套在 extra_fields 对象内，不要平铺到顶层。"
            )
        return [SystemMessage(content=system_prompt), HumanMessage(content=description)]

    @staticmethod
    def _normalize_references(refs: list[ReferenceItem]) -> list[dict]:
        """
        归一化用户提交的 references：
        - 截断到 MAX_REFERENCES_PER_REQUEST 上限并打 warning 日志
        - 同 (type, id) 去重，保留首次出现顺序
        - 输出适配 AIContextBuilder.get_referenced_entities 的纯 dict 形式
        """
        if not refs:
            return []

        if len(refs) > MAX_REFERENCES_PER_REQUEST:
            logger.warning(
                "AI 角色生成 references 数量超限: count=%s max=%s，已截断为前 %s 个",
                len(refs),
                MAX_REFERENCES_PER_REQUEST,
                MAX_REFERENCES_PER_REQUEST,
            )
            refs = refs[:MAX_REFERENCES_PER_REQUEST]

        seen: set[tuple[str, int]] = set()
        normalized: list[dict] = []
        for ref in refs:
            key = (ref.type, ref.id)
            if key in seen:
                continue
            seen.add(key)
            normalized.append({"type": ref.type, "id": ref.id})
        return normalized

    async def generate_draft(
        self,
        project_id: int,
        user_id: int,
        body: AIGenerateCharacterRequest,
    ) -> CharacterDraftSchema:
        """生成未落库角色草稿。"""
        await self.proj_service.require_user_project(project_id, user_id)
        _cfg, chat_model = await self._get_config_and_model(body.model_config_id, user_id)
        structured_model = self._build_structured_model(chat_model)

        # 关联实体上下文：空列表/缺省 → 空文本，prompt 与历史行为完全等价
        normalized_refs = self._normalize_references(body.references)
        references_text = ""
        if normalized_refs:
            ctx_builder = AIContextBuilder(self.db)
            entities = await ctx_builder.get_referenced_entities(project_id, normalized_refs)
            references_text = AIContextBuilder.format_referenced_entities(entities)

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                result = await structured_model.ainvoke(
                    self._build_messages(
                        body.description,
                        retry=attempt > 0,
                        references_text=references_text,
                    )
                )
                if isinstance(result, CharacterDraftSchema):
                    return result
                return CharacterDraftSchema.model_validate(result)
            except _PARSE_EXCEPTIONS as exc:
                last_error = exc
                logger.warning(
                    "AI 角色生成输出解析失败: attempt=%s project_id=%s model_config_id=%s error=%s",
                    attempt + 1,
                    project_id,
                    body.model_config_id,
                    exc,
                    exc_info=True,
                )

        raise ValidationError("AI 角色生成失败：模型输出无法解析为有效角色 JSON", detail=str(last_error))
