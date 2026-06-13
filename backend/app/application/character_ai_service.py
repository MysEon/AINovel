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
    MAX_CHARACTERS_PER_BATCH,
    MAX_REFERENCES_PER_REQUEST,
    AIGenerateCharacterRequest,
    CharacterDraftBatch,
    CharacterDraftBatchResponse,
    CharacterDraftSchema,
    CharacterPlan,
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
    def _build_structured_model(chat_model, schema):
        """对任意 Pydantic schema 构造 structured-output chat model。"""
        try:
            return chat_model.with_structured_output(schema, method="json_mode")
        except TypeError:
            return chat_model.with_structured_output(schema)

    @staticmethod
    def _build_plan_messages(
        description: str,
        *,
        retry: bool = False,
        references_text: str = "",
    ):
        """Step 1：规划阶段 prompt——让 LLM 判断要生成几个角色，分别是谁。"""
        from langchain_core.messages import HumanMessage, SystemMessage

        system_prompt = f"""
你是一个小说角色编剧。任务是分析用户描述，判断需要生成几个独立角色，并给每个角色一个简短的「槽位画像」。

请严格按以下 JSON schema 输出：

{{
  "count": 整数（1~{MAX_CHARACTERS_PER_BATCH}），需要生成的角色数量,
  "plan": [
    {{
      "slot_name": "string，2~10 字的角色槽位短词，如『队长』『剑客』『母亲』『女儿』",
      "brief": "string，一句话简介（不超过 80 字），点明该角色与整体描述的关系和定位"
    }}
  ],
  "reasoning": "string（不超过 200 字），简短解释为什么是这个数量"
}}

判断准则（按优先级）：
1. 描述中含明确数量词（"三人小队"=3、"一对兄妹"=2、"四个室友"=4）→ 取明示数量
2. 模糊集合词（"一队/一伙/一个家庭/一群朋友"）→ 取 3~4 个
3. 描述围绕单一主体（"一个图书管理员"、"主角"、"我的角色"）→ 取 1
4. 数量明显超过 {MAX_CHARACTERS_PER_BATCH} → 截断到 {MAX_CHARACTERS_PER_BATCH} 并在 reasoning 里说明

要求：
- plan 列表长度必须等于 count
- 多角色之间应在槽位画像层面就有差异（不要"村民甲、村民乙、村民丙"这种没区分度的）
- 单角色场景下 plan 仍是长度 1 的列表
""".strip()

        if references_text:
            system_prompt += (
                "\n\n以下是用户在本项目中已建档的相关实体，作为参考。"
                "请在生成规划时考虑新角色与它们的潜在关系（亲属/敌对/归属/地缘等）。\n\n"
                f"{references_text}"
            )
        if retry:
            system_prompt += (
                "\n\n上次输出无法解析。请严格按上述 schema：count 必须是整数且 ≤ "
                f"{MAX_CHARACTERS_PER_BATCH}；plan 数组长度必须等于 count；"
                "每个 plan 项必须含 slot_name 和 brief。"
            )
        return [SystemMessage(content=system_prompt), HumanMessage(content=description)]

    @staticmethod
    def _build_batch_messages(
        description: str,
        plan: CharacterPlan,
        *,
        retry: bool = False,
        references_text: str = "",
    ):
        """Step 2：生成阶段 prompt——一次性输出 plan 所有槽位的完整角色档案。"""
        from langchain_core.messages import HumanMessage, SystemMessage

        plan_lines = "\n".join(
            f"  {idx + 1}. 【{item.slot_name}】{item.brief}"
            for idx, item in enumerate(plan.plan)
        )
        system_prompt = f"""
你是一个专业的小说角色档案生成器。本次需要根据用户描述与下方规划，**一次性**生成 {plan.count} 个完整角色档案。

【本批次规划】
{plan_lines}

请严格按以下 JSON schema 输出：

{{
  "characters": [
    {{
      "name": "string，角色姓名（必填）",
      "description": "string，一句话定位（区别于 personality 详述）",
      "personality": "string，性格特点详述",
      "background": "string，身世经历背景",
      "appearance": "string，外貌描述",
      "age": "string，年龄（即使是数字也用字符串，如 \\"17\\" 或 \\"永生\\"）",
      "species": "string，种族",
      "alignment": "string，阵营 / 立场",
      "abilities": "string，能力 / 技能",
      "weaknesses": "string，弱点 / 缺陷",
      "dimensions": {{"任意中文键名": 0-100 整数, ...}}（3-6 个为宜）,
      "extra_fields": {{
        "core_conflict": "string，核心冲突",
        "inner_monologue": "string，内心独白",
        "relationships": {{"father": "string", "mother": "string", ...}},
        "habits": "string",
        "catchphrase": "string",
        "dreams": "string",
        "tags": ["string", ...]
      }}
    }}
  ]
}}

要求：
- characters 数组长度必须等于 {plan.count}，顺序与上方规划一一对应
- 每个角色都要档案完整（name / personality / background / appearance 必填）
- 多角色之间必须**差异化**：性格、维度键名、外貌、口头禅都应避免雷同
- age 字段无论数字大小都要用字符串
- dimensions 的键名要贴合每个角色的特点（心理类用『焦虑』『自我认同』，战斗类用『武力』『敏捷』）
- extra_fields 内字段都是可选，不要平铺到顶层
""".strip()

        if references_text:
            system_prompt += (
                "\n\n以下是用户在本项目中已建档的相关实体，所有新角色都应保持与这些实体一致的家世/外貌/背景；"
                "若新角色与某个已知实体存在亲属、敌对、归属或地缘关系，必须在 extra_fields.relationships 中如实记录。\n\n"
                f"{references_text}"
            )
        if retry:
            system_prompt += (
                "\n\n上次输出无法解析。请严格按上述 schema："
                f"characters 数组长度必须等于 {plan.count}；"
                "age 必须是字符串；dimensions 的值是 0-100 整数；"
                "扩展字段必须嵌套在 extra_fields 对象内，不要平铺到顶层。"
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

    async def _run_planning(
        self,
        chat_model,
        description: str,
        references_text: str,
        *,
        project_id: int,
        model_config_id: int,
    ) -> CharacterPlan:
        """Step 1：规划阶段，独立 retry 2 次。失败抛 ValidationError。"""
        structured = self._build_structured_model(chat_model, CharacterPlan)

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                result = await structured.ainvoke(
                    self._build_plan_messages(
                        description,
                        retry=attempt > 0,
                        references_text=references_text,
                    )
                )
                plan = (
                    result if isinstance(result, CharacterPlan)
                    else CharacterPlan.model_validate(result)
                )

                # LLM 偶尔会让 count 与 plan 长度不一致，这里以实际 plan 长度为准
                actual = len(plan.plan)
                if plan.count != actual:
                    logger.warning(
                        "AI 角色生成 plan.count 与 plan 长度不符: count=%s actual=%s 已修正",
                        plan.count,
                        actual,
                    )
                    plan = plan.model_copy(update={"count": actual})
                return plan
            except _PARSE_EXCEPTIONS as exc:
                last_error = exc
                logger.warning(
                    "AI 角色生成规划阶段解析失败: attempt=%s project_id=%s model_config_id=%s error=%s",
                    attempt + 1,
                    project_id,
                    model_config_id,
                    exc,
                    exc_info=True,
                )

        raise ValidationError("AI 角色生成失败：规划阶段输出无法解析", detail=str(last_error))

    async def _run_batch_generation(
        self,
        chat_model,
        description: str,
        plan: CharacterPlan,
        references_text: str,
        *,
        project_id: int,
        model_config_id: int,
    ) -> list[CharacterDraftSchema]:
        """Step 2：批量生成阶段，独立 retry 2 次。失败抛 ValidationError。"""
        structured = self._build_structured_model(chat_model, CharacterDraftBatch)

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                result = await structured.ainvoke(
                    self._build_batch_messages(
                        description,
                        plan,
                        retry=attempt > 0,
                        references_text=references_text,
                    )
                )
                batch = (
                    result if isinstance(result, CharacterDraftBatch)
                    else CharacterDraftBatch.model_validate(result)
                )
                return batch.characters
            except _PARSE_EXCEPTIONS as exc:
                last_error = exc
                logger.warning(
                    "AI 角色生成批量阶段解析失败: attempt=%s project_id=%s model_config_id=%s plan_count=%s error=%s",
                    attempt + 1,
                    project_id,
                    model_config_id,
                    plan.count,
                    exc,
                    exc_info=True,
                )

        raise ValidationError("AI 角色生成失败：生成阶段输出无法解析为有效角色数组", detail=str(last_error))

    async def generate_drafts(
        self,
        project_id: int,
        user_id: int,
        body: AIGenerateCharacterRequest,
    ) -> CharacterDraftBatchResponse:
        """两步式生成多角色草稿：先规划（Step 1）再批量生成（Step 2）。

        - Step 1 / Step 2 各自独立 retry 2 次
        - references 上下文在两步中都注入，让 plan 和角色细节都参照已有实体
        - 单角色场景退化为长度 1 的 characters 数组（行为对前端透明）
        """
        await self.proj_service.require_user_project(project_id, user_id)
        _cfg, chat_model = await self._get_config_and_model(body.model_config_id, user_id)

        # 关联实体上下文：空列表 / 缺省 → 空文本，prompt 与单角色历史行为兼容
        normalized_refs = self._normalize_references(body.references)
        references_text = ""
        if normalized_refs:
            ctx_builder = AIContextBuilder(self.db)
            entities = await ctx_builder.get_referenced_entities(project_id, normalized_refs)
            references_text = AIContextBuilder.format_referenced_entities(entities)

        # Step 1：规划
        plan = await self._run_planning(
            chat_model,
            body.description,
            references_text,
            project_id=project_id,
            model_config_id=body.model_config_id,
        )
        logger.info(
            "AI 角色生成规划完成: project_id=%s count=%s slots=%s",
            project_id,
            plan.count,
            [item.slot_name for item in plan.plan],
        )

        # Step 2：批量生成
        characters = await self._run_batch_generation(
            chat_model,
            body.description,
            plan,
            references_text,
            project_id=project_id,
            model_config_id=body.model_config_id,
        )

        # LLM 偶尔会让 characters 长度与 plan.count 不一致；以 LLM 实际产出为准，但截断到上限
        if len(characters) > MAX_CHARACTERS_PER_BATCH:
            logger.warning(
                "AI 角色生成 characters 数量超限: count=%s max=%s 已截断",
                len(characters),
                MAX_CHARACTERS_PER_BATCH,
            )
            characters = characters[:MAX_CHARACTERS_PER_BATCH]

        return CharacterDraftBatchResponse(plan=plan, characters=characters)

    async def generate_draft(
        self,
        project_id: int,
        user_id: int,
        body: AIGenerateCharacterRequest,
    ) -> CharacterDraftSchema:
        """[Deprecated] 单角色生成入口——保留向后兼容，内部调用 generate_drafts 取首个。

        新代码应使用 `generate_drafts`。此方法将在前端切换至多角色 API 后移除。
        """
        response = await self.generate_drafts(project_id, user_id, body)
        return response.characters[0]
