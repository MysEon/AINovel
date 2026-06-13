"""CharacterAIService 单元测试。"""

from unittest.mock import AsyncMock

import pytest

from app.application.character_ai_service import CharacterAIService
from app.application.model_config_service import ModelConfigService
from app.application.project_service import ProjectService
from app.core.exceptions import ForbiddenError, ValidationError
from app.schemas.character_ai import AIGenerateCharacterRequest, CharacterDraftSchema
from app.schemas.model_configs import ModelConfigCreate
from app.schemas.projects import ProjectCreate


class _FakeProvider:
    def __init__(self, chat_model):
        self.chat_model = chat_model

    def build_chat_model(self, _config):
        return self.chat_model


class _FakeChatModel:
    def __init__(self, structured_model):
        self.structured_model = structured_model
        self.structured_schema = None
        self.structured_method = None

    def with_structured_output(self, schema, method=None):
        self.structured_schema = schema
        self.structured_method = method
        return self.structured_model


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

    def _draft(self, name="林晚"):
        return CharacterDraftSchema(
            name=name,
            description="被流放的星港修理师，意外掌握古代舰船权限。",
            personality="冷静敏锐，嘴硬心软，对承诺极度认真。",
            background="出生于边境星港，幼年经历事故后被机械师收养。",
            appearance="银灰短发，常穿沾有机油的深色夹克，左眼有淡金义眼。",
            age="24",
            species="人类",
            alignment="混乱善良",
            abilities="机械维修、舰船驾驶、快速战术判断。",
            weaknesses="不擅长信任他人，义眼会被强电磁干扰。",
            dimensions={"智力": 88, "体力": 62, "魅力": 76},
        )

    async def test_generate_draft_success(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(
            db_session,
            test_user.id,
            ["writing", "character_generation"],
        )
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        chat_model = _FakeChatModel(structured_model)
        provider = _FakeProvider(chat_model)
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个边境星港出身的女机械师主角", model_config_id=model_config.id),
        )

        assert result.name == "林晚"
        assert result.dimensions == {"智力": 88, "体力": 62, "魅力": 76}
        assert chat_model.structured_schema is CharacterDraftSchema
        assert chat_model.structured_method == "json_mode"
        structured_model.ainvoke.assert_awaited_once()

    async def test_generate_draft_age_int_coercion(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(
            return_value={
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
        )
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个十七岁的旧城少年侦探", model_config_id=model_config.id),
        )

        assert result.age == "17"
        assert isinstance(result.age, str)

    async def test_generate_draft_description_optional(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(
            return_value={
                "name": "林清",
                "personality": "谨慎敏感，习惯先观察再行动。",
                "background": "幼年卷入旧城失踪案，从此追查隐藏的真相。",
                "appearance": "黑发清瘦，常穿洗旧的灰色外套。",
                "age": "17",
                "species": "人类",
                "alignment": "守序善良",
                "abilities": "观察细节、推理、潜行。",
                "weaknesses": "体力不足，容易被过去的线索影响判断。",
                "dimensions": {"智力": 86, "体力": 45, "魅力": 68},
            }
        )
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个十七岁的旧城少年侦探", model_config_id=model_config.id),
        )

        assert result.description is None

    async def test_generate_draft_with_extra_fields(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(
            return_value={
                "name": "姜岚",
                "description": "被家族预言束缚的年轻术士。",
                "personality": "外表温和，内心长期与宿命感对抗。",
                "background": "出生在占星世家，从小被告知会引发灾厄。",
                "appearance": "黑发金瞳，常戴遮住星纹的手套。",
                "age": "19",
                "species": "人类",
                "alignment": "中立善良",
                "abilities": "星象占卜、结界术。",
                "weaknesses": "过度自责，施术会消耗记忆。",
                "dimensions": {"自我认同": 30, "焦虑": 80},
                "extra_fields": {
                    "core_conflict": "想摆脱预言却害怕真正自由后的空白。",
                    "inner_monologue": "如果灾厄因我而起，我是否还有资格爱别人？",
                    "relationships": {"father": "严厉的家族族长", "mother": "失踪的前任观星者"},
                    "habits": "紧张时会摩挲手套边缘。",
                    "tags": ["预言", "自我怀疑", "术士"],
                },
            }
        )
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个被预言束缚的年轻术士", model_config_id=model_config.id),
        )

        assert result.extra_fields["core_conflict"] == "想摆脱预言却害怕真正自由后的空白。"
        assert result.extra_fields["relationships"]["father"] == "严厉的家族族长"
        assert result.extra_fields["tags"] == ["预言", "自我怀疑", "术士"]

    async def test_generate_draft_dimensions_arbitrary_keys(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(
            return_value={
                "name": "许白",
                "description": "害怕人群却必须成为领袖的学生会长。",
                "personality": "克制、敏锐，对自身价值长期怀疑。",
                "background": "被推到台前后逐渐学会承担责任。",
                "appearance": "干净校服，永远整理得一丝不苟。",
                "age": "17",
                "species": "人类",
                "alignment": "守序中立",
                "abilities": "组织、演讲、危机协调。",
                "weaknesses": "社交焦虑，害怕被真正看穿。",
                "dimensions": {"自我认同": 30, "社交能力": 40, "焦虑": 80},
            }
        )
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个焦虑但负责的学生会长", model_config_id=model_config.id),
        )

        assert result.dimensions == {"自我认同": 30, "社交能力": 40, "焦虑": 80}

    async def test_generate_draft_dimensions_float_coerced(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(
            return_value={
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
        )
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

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
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft(name="沈照"))
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个守夜人主角，能听见城墙低语", model_config_id=model_config.id),
        )

        assert result.name == "沈照"
        structured_model.ainvoke.assert_awaited_once()

    async def test_generate_draft_retry_on_first_failure(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(side_effect=[ValueError("bad json"), self._draft(name="陆青")])
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(description="一个被古书选中的医者少年", model_config_id=model_config.id),
        )

        assert result.name == "陆青"
        assert structured_model.ainvoke.await_count == 2

    async def test_generate_draft_retry_exhausted(self, db_session, test_user, monkeypatch):
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])
        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(side_effect=[ValueError("bad json"), ValueError("still bad")])
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        with pytest.raises(ValidationError):
            await service.generate_draft(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(description="一个不稳定输出测试角色", model_config_id=model_config.id),
            )
        assert structured_model.ainvoke.await_count == 2
