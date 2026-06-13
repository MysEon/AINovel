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
    CharacterDraftSchema,
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

    # ── References (关联已有实体) ─────────────────────────────────────────

    @staticmethod
    def _captured_system_prompt(structured_model: AsyncMock) -> str:
        """从 ainvoke 的 mock 中取出最后一次传入的 system prompt 文本。"""
        assert structured_model.ainvoke.await_count >= 1
        last_call_args = structured_model.ainvoke.await_args_list[-1].args[0]
        # _build_messages 返回 [SystemMessage, HumanMessage]
        return last_call_args[0].content

    async def test_generate_draft_with_character_reference(self, db_session, test_user, monkeypatch):
        """选中已有角色 A，prompt 中应出现 A 的核心字段与 relationships。"""
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
                {"relationships": {"father": "已故的剑庄主人苏远", "mentor": "现任剑庄主人沈言"}},
                ensure_ascii=False,
            ),
        )
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft(name="苏母"))
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="生成苏清的母亲",
                model_config_id=model_config.id,
                references=[ReferenceItem(type="character", id=existing.id)],
            ),
        )

        sys_prompt = self._captured_system_prompt(structured_model)
        assert "【已知项目实体（仅供参考）】" in sys_prompt
        assert "苏清" in sys_prompt
        assert "孤身追查家族秘密" in sys_prompt
        assert "坚毅而克制" in sys_prompt
        assert "已记载关系" in sys_prompt
        assert "苏远" in sys_prompt  # relationships 字典里的值
        assert "extra_fields.relationships" in sys_prompt  # 一致性硬性指令

    async def test_generate_draft_empty_references_keeps_legacy_prompt(self, db_session, test_user, monkeypatch):
        """references=[] 时 system prompt 不应出现关联段，与历史行为完全一致。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个边境星港出身的女机械师主角",
                model_config_id=model_config.id,
                references=[],
            ),
        )

        sys_prompt = self._captured_system_prompt(structured_model)
        assert "【已知项目实体（仅供参考）】" not in sys_prompt
        assert "已记载关系" not in sys_prompt

    async def test_generate_draft_cross_project_reference_silently_ignored(self, db_session, test_user, monkeypatch):
        """跨 project 的角色 ID 应被静默忽略（防越权），prompt 不含该角色信息。"""
        project_a = await self._create_project(db_session, test_user.id, name="项目A")
        project_b = await self._create_project(db_session, test_user.id, name="项目B")
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])

        # 在 project_b 里建一个角色，然后在 project_a 的生成请求里引用它
        outsider = Character(
            project_id=project_b.id,
            name="跨项目角色赵迁",
            description="他的存在不应进入 A 项目的 prompt",
            personality="x",
            background="y",
            appearance="z",
        )
        db_session.add(outsider)
        await db_session.commit()
        await db_session.refresh(outsider)

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        await service.generate_draft(
            project_a.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个新角色",
                model_config_id=model_config.id,
                references=[ReferenceItem(type="character", id=outsider.id)],
            ),
        )

        sys_prompt = self._captured_system_prompt(structured_model)
        # 跨项目角色的所有信息都不应进入 prompt；由于桶为空，整段关联区块也不应出现
        assert "跨项目角色赵迁" not in sys_prompt
        assert "【已知项目实体（仅供参考）】" not in sys_prompt

    async def test_generate_draft_nonexistent_reference_silently_ignored(self, db_session, test_user, monkeypatch):
        """不存在的 reference id 应被静默忽略，不抛错。"""
        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        result = await service.generate_draft(
            project.id,
            test_user.id,
            AIGenerateCharacterRequest(
                description="一个新角色",
                model_config_id=model_config.id,
                references=[ReferenceItem(type="character", id=999_999)],
            ),
        )

        assert result.name  # 正常生成，没有抛错
        sys_prompt = self._captured_system_prompt(structured_model)
        assert "【已知项目实体（仅供参考）】" not in sys_prompt

    async def test_generate_draft_references_truncated_when_over_limit(
        self, db_session, test_user, monkeypatch, caplog
    ):
        """超过 MAX_REFERENCES_PER_REQUEST=10 应被截断且打 warning。"""
        from app.schemas.character_ai import MAX_REFERENCES_PER_REQUEST

        project = await self._create_project(db_session, test_user.id)
        model_config = await self._create_model_config(db_session, test_user.id, ["character_generation"])

        # 建 12 个角色
        chars = [
            Character(
                project_id=project.id,
                name=f"角色{i}",
                description=f"第{i}号角色",
                personality="p",
                background="b",
                appearance="a",
            )
            for i in range(12)
        ]
        db_session.add_all(chars)
        await db_session.commit()
        for c in chars:
            await db_session.refresh(c)

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        refs = [ReferenceItem(type="character", id=c.id) for c in chars]
        assert len(refs) > MAX_REFERENCES_PER_REQUEST

        service = CharacterAIService(db_session)
        with caplog.at_level("WARNING", logger="app.application.character_ai_service"):
            await service.generate_draft(
                project.id,
                test_user.id,
                AIGenerateCharacterRequest(
                    description="一个新角色", model_config_id=model_config.id, references=refs
                ),
            )

        sys_prompt = self._captured_system_prompt(structured_model)
        # 前 10 个应在 prompt 中
        assert "角色0" in sys_prompt
        assert "角色9" in sys_prompt
        # 11、12 号被截断
        assert "角色10" not in sys_prompt
        assert "角色11" not in sys_prompt
        # warning 日志已记录
        assert any("references 数量超限" in rec.message for rec in caplog.records)

    async def test_generate_draft_with_multi_type_references(self, db_session, test_user, monkeypatch):
        """同时关联角色 + 地点：prompt 应包含两类标签段。"""
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

        structured_model = AsyncMock()
        structured_model.ainvoke = AsyncMock(return_value=self._draft())
        provider = _FakeProvider(_FakeChatModel(structured_model))
        monkeypatch.setattr("app.infrastructure.llm.provider_adapters.get_provider", lambda _model_type: provider)

        service = CharacterAIService(db_session)
        await service.generate_draft(
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

        sys_prompt = self._captured_system_prompt(structured_model)
        assert "角色《林时》" in sys_prompt
        assert "地点《北境哨塔》" in sys_prompt
        assert "冰原最前沿的瞭望据点" in sys_prompt
