"""CharacterAIService 单元测试。"""

import json
from unittest.mock import AsyncMock

import pytest

from app.application.character_ai_service import CharacterAIService
from app.application.model_config_service import ModelConfigService
from app.application.project_service import ProjectService
from app.core.exceptions import ForbiddenError, ValidationError
from app.infrastructure.db.models.worldbuilding import Character, Location
from app.schemas.character_ai import (
    AIGenerateCharacterRequest,
    CharacterDraftBatch,
    CharacterDraftSchema,
    CharacterPlan,
    PlanItem,
    ReferenceItem,
)
from app.schemas.model_configs import ModelConfigCreate
from app.schemas.projects import ProjectCreate


class _FakeProvider:
    def __init__(self, chat_model):
        self.chat_model = chat_model

    def build_chat_model(self, _config):
        return self.chat_model


class _FakeChatModel:
    """Chat model fake that dispatches structured_output by schema class.

    两步流里 service 会调用 `with_structured_output(CharacterPlan)` 和
    `with_structured_output(CharacterDraftBatch)`，分别返回对应的 mock。
    旧的单 schema 测试通过 `default_model` 兜底。
    """

    def __init__(self, *, plan_model=None, batch_model=None, default_model=None):
        self.plan_model = plan_model
        self.batch_model = batch_model
        self.default_model = default_model
        self.structured_schemas: list = []
        self.structured_methods: list = []

    def with_structured_output(self, schema, method=None):
        self.structured_schemas.append(schema)
        self.structured_methods.append(method)
        if schema is CharacterPlan and self.plan_model is not None:
            return self.plan_model
        if schema is CharacterDraftBatch and self.batch_model is not None:
            return self.batch_model
        if self.default_model is not None:
            return self.default_model
        raise AssertionError(f"No mock configured for schema {schema!r}")


def _make_plan(slot_names: list[str], reasoning: str = "根据描述判断") -> CharacterPlan:
    """快速构造 CharacterPlan（按 slot_names 长度推断 count）。"""
    return CharacterPlan(
        count=len(slot_names),
        plan=[PlanItem(slot_name=n, brief=f"{n}的简介，用于差异化锚点") for n in slot_names],
        reasoning=reasoning,
    )


def _draft(name: str = "林晚", **overrides) -> CharacterDraftSchema:
    base = {
        "name": name,
        "description": "被流放的星港修理师，意外掌握古代舰船权限。",
        "personality": "冷静敏锐，嘴硬心软，对承诺极度认真。",
        "background": "出生于边境星港，幼年经历事故后被机械师收养。",
        "appearance": "银灰短发，常穿沾有机油的深色夹克，左眼有淡金义眼。",
        "age": "24",
        "species": "人类",
        "alignment": "混乱善良",
        "abilities": "机械维修、舰船驾驶、快速战术判断。",
        "weaknesses": "不擅长信任他人，义眼会被强电磁干扰。",
        "dimensions": {"智力": 88, "体力": 62, "魅力": 76},
    }
    base.update(overrides)
    return CharacterDraftSchema(**base)


def _build_two_step_chat_model(plan: CharacterPlan, drafts: list[CharacterDraftSchema]):
    """构造一个两步流的 chat_model，规划和批量生成各 mock 一次成功响应。"""
    plan_model = AsyncMock()
    plan_model.ainvoke = AsyncMock(return_value=plan)
    batch_model = AsyncMock()
    batch_model.ainvoke = AsyncMock(return_value=CharacterDraftBatch(characters=drafts))
    return _FakeChatModel(plan_model=plan_model, batch_model=batch_model), plan_model, batch_model


class TestCharacterAIService:
    async def _create_project(self, db_session, user_id, name="角色 AI 项目"):
        return await ProjectService(db_session).create(ProjectCreate(name=name), user_id)

    async def _create_model_config(self, db_session, user_id, scenarios):
        return await ModelConfigService(db_session).create(
            ModelConfigCreate(
                name="角色生成模型",
                model_type="openai",
                api_key="sk-test-character-ai",
                scenarios=scenarios,
            ),
            user_id,
        )

    # ── 单角色路径（兼容入口 generate_draft）─────────────────────────────

    async def test_generate_draft_single_character_success(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(
            db_session, test_user.id, ["writing", "character_generation"]
        )
        chat_model, _plan_m, _batch_m = _build_two_step_chat_model(
            _make_plan(["主角"]), [_draft("林晚")]
        )
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个边境星港出身的女机械师主角",
                model_config_id=model_config.id,
            ),
        )

        # 兼容入口仍返回单 CharacterDraftSchema
        assert isinstance(result, CharacterDraftSchema)
        assert result.name == "林晚"
        # structured_output 被两次以不同 schema 调用：CharacterPlan 与 CharacterDraftBatch
        assert chat_model.structured_schemas == [CharacterPlan, CharacterDraftBatch]
        assert chat_model.structured_methods == ["json_mode", "json_mode"]

    async def test_generate_draft_age_int_coercion(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        # batch 阶段返回原始 dict，CharacterDraftBatch 验证时把 age=17 强转为 "17"
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(return_value=_make_plan(["少年侦探"]))
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(
            return_value={
                "characters": [
                    {
                        "name": "林清",
                        "description": "在旧城边缘长大的少年侦探。",
                        "personality": "谨慎敏感，习惯先观察再行动。",
                        "background": "幼年卷入旧城失踪案，从此追查隐藏的真相。",
                        "appearance": "黑发清瘦，常穿洗旧的灰色外套。",
                        "age": 17,
                        "species": "人类",
                        "alignment": "守序善良",
                        "abilities": "观察细节、推理、潜行。",
                        "weaknesses": "体力不足，容易被过去的线索影响判断。",
                        "dimensions": {"智力": 86, "体力": 45, "魅力": 68},
                    }
                ]
            }
        )
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个十七岁的旧城少年侦探", model_config_id=model_config.id
            ),
        )
        assert result.age == "17"
        assert isinstance(result.age, str)

    async def test_generate_draft_dimensions_float_coerced(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(return_value=_make_plan(["半妖盗贼"]))
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(
            return_value={
                "characters": [
                    {
                        "name": "唐墨",
                        "description": "以魅惑术闯荡王都的半妖盗贼。",
                        "personality": "狡黠自信，关键时刻会保护弱者。",
                        "background": "从地下街逃出后加入情报组织。",
                        "appearance": "紫色眼瞳，披着暗纹斗篷。",
                        "age": "26",
                        "species": "半妖",
                        "alignment": "混乱中立",
                        "abilities": "潜行、开锁、幻术。",
                        "weaknesses": "怕强光，不信任权威。",
                        "dimensions": {"智力": 80.7, "体力": 105, "魅力": "abc"},
                    }
                ]
            }
        )
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个半妖盗贼", model_config_id=model_config.id),
        )
        assert result.dimensions == {"智力": 81, "体力": 100}

    async def test_generate_draft_unauthorized_scenario(self, db_session, test_user):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["writing", "chat"])
        service = CharacterAIService(db_session)

        with pytest.raises(ForbiddenError):
            await service.generate_draft(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(
                    description="一个边境星港出身的女机械师主角", model_config_id=model_config.id
                ),
            )

    async def test_generate_draft_null_scenarios_are_compatible(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["writing"])
        model_config.scenarios = None
        await db_session.commit()
        chat_model, _p, _b = _build_two_step_chat_model(_make_plan(["守夜人"]), [_draft("沈照")])
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个守夜人主角，能听见城墙低语", model_config_id=model_config.id
            ),
        )
        assert result.name == "沈照"

    # ── 多角色路径（generate_drafts，新主入口）────────────────────────────

    async def test_generate_drafts_multi_characters(self, db_session, test_user, monkeypatch):
        """复数描述 → plan.count > 1，batch 返回多角色。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan = _make_plan(
            ["队长", "剑客", "医师", "斥候"],
            reasoning="描述提到『四人小队』，按明示数量取 4 个槽位",
        )
        drafts = [
            _draft("陆宴", description="队长，沉稳寡言"),
            _draft("白鸢", description="剑客，性格张扬"),
            _draft("沈青", description="医师，温和内敛"),
            _draft("江墨", description="斥候，机敏多疑"),
        ]
        chat_model, _p, _b = _build_two_step_chat_model(plan, drafts)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        response = await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一队由队长、剑客、医师、斥候组成的小队",
                model_config_id=model_config.id,
            ),
        )

        assert response.plan.count == 4
        assert [item.slot_name for item in response.plan.plan] == ["队长", "剑客", "医师", "斥候"]
        assert "四人" in response.plan.reasoning
        assert len(response.characters) == 4
        assert {c.name for c in response.characters} == {"陆宴", "白鸢", "沈青", "江墨"}

    async def test_generate_drafts_single_character_returns_length_one(self, db_session, test_user, monkeypatch):
        """单角色描述 → plan.count == 1，characters 数组长度 1。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        chat_model, _p, _b = _build_two_step_chat_model(
            _make_plan(["图书管理员"], reasoning="单数描述，取 1 个角色"),
            [_draft("许白")],
        )
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        response = await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个内向的图书管理员，秘密拥有读心术",
                model_config_id=model_config.id,
            ),
        )

        assert response.plan.count == 1
        assert len(response.characters) == 1
        assert response.characters[0].name == "许白"

    async def test_generate_drafts_planning_retry_then_success(self, db_session, test_user, monkeypatch):
        """Step 1 第一次解析失败，第二次成功；Step 2 一次成功。总 retry 应是 plan=2 + batch=1。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(
            side_effect=[ValueError("bad plan json"), _make_plan(["主角"])]
        )
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(
            return_value=CharacterDraftBatch(characters=[_draft("陆青")])
        )
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        response = await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个被古书选中的医者少年", model_config_id=model_config.id),
        )

        assert response.characters[0].name == "陆青"
        assert plan_model.ainvoke.await_count == 2
        assert batch_model.ainvoke.await_count == 1

    async def test_generate_drafts_batch_retry_then_success(self, db_session, test_user, monkeypatch):
        """Step 1 一次成功；Step 2 第一次失败，第二次成功。Step 1 不应被重跑。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(return_value=_make_plan(["剑客", "医师"]))
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(
            side_effect=[
                ValueError("bad batch json"),
                CharacterDraftBatch(characters=[_draft("白鸢"), _draft("沈青")]),
            ]
        )
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        response = await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="生成一对剑客和医师", model_config_id=model_config.id),
        )

        assert len(response.characters) == 2
        assert plan_model.ainvoke.await_count == 1, "Step 1 不应因 Step 2 失败被重跑"
        assert batch_model.ainvoke.await_count == 2

    async def test_generate_drafts_planning_exhausted_raises(self, db_session, test_user, monkeypatch):
        """Step 1 两次都失败 → ValidationError，Step 2 不应被调用。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(side_effect=[ValueError("bad"), ValueError("still bad")])
        batch_model = AsyncMock()
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        with pytest.raises(ValidationError):
            await service.generate_drafts(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(description="一个测试角色", model_config_id=model_config.id),
            )
        assert plan_model.ainvoke.await_count == 2
        batch_model.ainvoke.assert_not_called()

    async def test_generate_drafts_batch_exhausted_raises(self, db_session, test_user, monkeypatch):
        """Step 2 两次都失败 → ValidationError，Step 1 不应被重跑。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(return_value=_make_plan(["主角"]))
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(side_effect=[ValueError("bad"), ValueError("still bad")])
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        with pytest.raises(ValidationError):
            await service.generate_drafts(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(description="一个测试角色", model_config_id=model_config.id),
            )
        assert plan_model.ainvoke.await_count == 1
        assert batch_model.ainvoke.await_count == 2

    async def test_generate_drafts_count_mismatch_corrected(self, db_session, test_user, monkeypatch, caplog):
        """LLM 返回 count=3 但 plan 长度=2 时，service 以实际 plan 长度修正并打 warning。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        # 直接构造合法的 CharacterPlan（count=3, plan 长度也是 3），然后 monkeypatch 模拟"返回长度不匹配"的场景
        # 因为 Pydantic 校验本身会防止 count != len(plan) 的"非法"对象进来——但 LLM 可能本来就返回有效的对象
        # 所以这里我们用 model_construct 跳过验证来构造 mismatch
        bad_plan = CharacterPlan.model_construct(
            count=3,
            plan=[
                PlanItem(slot_name="A", brief="A 的简介"),
                PlanItem(slot_name="B", brief="B 的简介"),
            ],
            reasoning="LLM 返回了不一致的 count",
        )
        plan_model = AsyncMock()
        plan_model.ainvoke = AsyncMock(return_value=bad_plan)
        batch_model = AsyncMock()
        batch_model.ainvoke = AsyncMock(
            return_value=CharacterDraftBatch(characters=[_draft("A"), _draft("B")])
        )
        chat_model = _FakeChatModel(plan_model=plan_model, batch_model=batch_model)
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        with caplog.at_level("WARNING", logger="app.application.character_ai_service"):
            response = await service.generate_drafts(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(description="生成两个角色", model_config_id=model_config.id),
            )
        assert response.plan.count == 2  # 已被修正为实际 plan 长度
        assert any("count 与 plan 长度不符" in rec.message for rec in caplog.records)

    # ── References 与多角色生成的正交性 ─────────────────────────────────

    async def test_generate_drafts_with_references_in_both_steps(self, db_session, test_user, monkeypatch):
        """references 应同时注入 Step 1 和 Step 2 的 system prompt。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        existing = Character(
            project_id=project.id,
            name="苏清",
            description="孤身追查家族秘密的少女剑客",
            personality="坚毅而克制",
            background="八岁亲历家族灭门后被剑庄收养",
            appearance="黑发束起，腰悬青锋",
            extra_attributes=json.dumps(
                {"relationships": {"father": "已故的剑庄主人苏远"}}, ensure_ascii=False
            ),
        )
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)

        chat_model, plan_model, batch_model = _build_two_step_chat_model(
            _make_plan(["母亲", "姐姐"], reasoning="生成苏清的母亲和姐姐两个角色"),
            [_draft("苏母"), _draft("苏姐")],
        )
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="生成苏清的母亲和姐姐",
                model_config_id=model_config.id,
                references=[ReferenceItem(type="character", id=existing.id)],
            ),
        )

        # 检查 Step 1 system prompt 含关联实体
        plan_sys = plan_model.ainvoke.await_args_list[0].args[0][0].content
        assert "【已知项目实体（仅供参考）】" in plan_sys
        assert "苏清" in plan_sys

        # 检查 Step 2 system prompt 含关联实体 + 完整 plan
        batch_sys = batch_model.ainvoke.await_args_list[0].args[0][0].content
        assert "【已知项目实体（仅供参考）】" in batch_sys
        assert "extra_fields.relationships" in batch_sys
        assert "【母亲】" in batch_sys  # plan 槽位被注入
        assert "【姐姐】" in batch_sys

    async def test_generate_drafts_empty_references_keeps_clean_prompt(self, db_session, test_user, monkeypatch):
        """references=[] 时两步 prompt 都不应出现关联段。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        chat_model, plan_model, batch_model = _build_two_step_chat_model(
            _make_plan(["主角"]), [_draft("林晚")]
        )
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个边境星港的机械师", model_config_id=model_config.id, references=[]
            ),
        )

        plan_sys = plan_model.ainvoke.await_args_list[0].args[0][0].content
        batch_sys = batch_model.ainvoke.await_args_list[0].args[0][0].content
        assert "【已知项目实体（仅供参考）】" not in plan_sys
        assert "【已知项目实体（仅供参考）】" not in batch_sys

    async def test_generate_drafts_with_multi_type_references(self, db_session, test_user, monkeypatch):
        """references 含角色 + 地点时，两步都看到混合上下文。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        char = Character(
            project_id=project.id,
            name="林时",
            description="守夜人队长",
            personality="沉默寡言",
            background="出身边陲军户",
            appearance="灰袍佩刀",
        )
        loc = Location(
            project_id=project.id,
            name="北境哨塔",
            description="冰原最前沿的瞭望据点",
        )
        db_session.add_all([char, loc])
        await db_session.commit()
        await db_session.refresh(char)
        await db_session.refresh(loc)

        chat_model, plan_model, _b = _build_two_step_chat_model(
            _make_plan(["新兵"]), [_draft("赵渊")]
        )
        monkeypatch.setattr(
            "app.infrastructure.llm.provider_adapters.get_provider",
            lambda _model_type: _FakeProvider(chat_model),
        )

        service = CharacterAIService(db_session)
        await service.generate_drafts(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="生成一个守夜人新兵",
                model_config_id=model_config.id,
                references=[
                    ReferenceItem(type="character", id=char.id),
                    ReferenceItem(type="location", id=loc.id),
                ],
            ),
        )

        plan_sys = plan_model.ainvoke.await_args_list[0].args[0][0].content
        assert "角色《林时》" in plan_sys
        assert "地点《北境哨塔》" in plan_sys
