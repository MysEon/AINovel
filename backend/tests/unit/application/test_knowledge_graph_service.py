"""KnowledgeGraphService proposal lifecycle tests."""

import json

import pytest

from app.application.knowledge_graph_service import KnowledgeGraphService
from app.application.project_service import ProjectService
from app.core.exceptions import ConflictError, ValidationError
from app.domain.ai_runtime.enums import RunStatus
from app.infrastructure.db.models.ai_runtime import AIRun
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.worldbuilding import Character, Location, Organization
from app.schemas.knowledge import (
    ChapterKnowledgeAnalysisDraft,
    ChapterKnowledgeAnalysisResponse,
    EntityChangeProposalCreate,
    KnowledgeOperationDraft,
    KnowledgeProposalDraft,
    ProposalAcceptRequest,
)
from app.schemas.projects import ProjectCreate


class FakeStructuredKnowledgeModel:
    def __init__(self, draft: ChapterKnowledgeAnalysisDraft):
        self.draft = draft
        self.calls = 0

    async def ainvoke(self, _messages):
        self.calls += 1
        return self.draft


class FakeChatModel:
    def __init__(self, structured_model: FakeStructuredKnowledgeModel):
        self.structured_model = structured_model

    def with_structured_output(self, _schema, method=None):
        return self.structured_model


class TestKnowledgeGraphService:
    async def _seed_entities(self, db_session, user_id: int):
        project = await ProjectService(db_session).create(ProjectCreate(name="Graph Test"), user_id)
        organization = Organization(
            project_id=project.id,
            name="Ash Guild",
            description="Old faction",
            influence="controls the harbor",
        )
        character = Character(
            project_id=project.id,
            name="Lin Zhao",
            description="agent",
            alignment="loyal",
            organization=organization,
        )
        db_session.add_all([organization, character])
        await db_session.commit()
        await db_session.refresh(project)
        await db_session.refresh(organization)
        await db_session.refresh(character)
        return project, character, organization

    async def _seed_chapter(self, db_session, project_id: int):
        chapter = Chapter(
            project_id=project_id,
            title="Harbor Betrayal",
            chapter_number=7,
            content="Lin Zhao handed the seal to Ash Guild and left the harbor injured.",
            word_count=12,
        )
        db_session.add(chapter)
        await db_session.commit()
        await db_session.refresh(chapter)
        return chapter

    async def test_analyze_chapter_creates_reviewable_proposals_from_ai_draft(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Lin Zhao wavers after the harbor incident",
                    summary="Lin Zhao's status and alliance changed after the harbor handoff.",
                    evidence="handed the seal to Ash Guild and left the harbor injured",
                    confidence=0.86,
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            field_name="alignment",
                            new_value="wavering",
                        ),
                        KnowledgeOperationDraft(
                            operation_type="relationship_upsert",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            relation_type="ally_of",
                            target_type="organization",
                            target_name="Ash Guild",
                            payload={"description": "temporarily cooperates after the seal handoff"},
                        ),
                        KnowledgeOperationDraft(
                            operation_type="entity_state_event",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            state_key="condition",
                            new_value="injured",
                        ),
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(
            project.id,
            chapter.id,
            test_user.id,
            model_config_id=123,
        )

        assert response.success is True
        assert response.proposal_count == 1
        assert response.skipped_proposal_count == 0
        assert structured_model.calls == 1
        proposal = response.proposals[0]
        assert proposal.source == "chapter_analysis"
        assert proposal.chapter_id == chapter.id
        assert proposal.status == "pending"
        assert len(proposal.operations) == 3
        field_op = next(op for op in proposal.operations if op.operation_type == "entity_field_update")
        relationship_op = next(op for op in proposal.operations if op.operation_type == "relationship_upsert")
        assert field_op.entity_id == character.id
        assert field_op.expected_old_value == "loyal"
        assert field_op.new_value == "wavering"
        assert relationship_op.entity_id == character.id
        assert relationship_op.target_id == organization.id

    async def test_analyze_chapter_returns_existing_pending_proposals_without_duplicate_ai_call(
        self,
        db_session,
        test_user,
    ):
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Lin Zhao condition update",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_state_event",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            state_key="condition",
                            new_value="injured",
                        )
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        first = await service.analyze_chapter(project.id, chapter.id, test_user.id, model_config_id=123)
        second = await service.analyze_chapter(project.id, chapter.id, test_user.id, model_config_id=123)

        assert first.proposal_count == 1
        assert second.proposal_count == 1
        assert second.proposals[0].id == first.proposals[0].id
        assert structured_model.calls == 1
        listed = await service.list_proposals(project.id, test_user.id, chapter_id=chapter.id)
        assert len(listed) == 1

    async def test_accept_proposal_applies_field_relationship_and_state(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Lin Zhao betrays Ash Guild",
                evidence="Lin Zhao publicly hands over the guild seal.",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    },
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                        "payload": {"description": "openly opposes the guild"},
                    },
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "state_key": "status",
                        "new_value": "defected",
                    },
                ],
            ),
        )

        accepted = await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        await db_session.refresh(character)
        relationships = await service.list_relationships(project.id, test_user.id)
        states = await service.list_state_events(project.id, test_user.id)

        assert accepted.status == "accepted"
        assert {operation.status for operation in accepted.operations} == {"accepted"}
        assert character.alignment == "defector"
        assert len(relationships) == 1
        assert relationships[0].relation_type == "enemy_of"
        assert relationships[0].description == "openly opposes the guild"
        # entity_field_update 现在同步写入状态时间线，故 alignment 与 status 两条均可见
        assert len(states) == 2
        assert {state.state_key for state in states} == {"alignment", "status"}
        status_state = next(state for state in states if state.state_key == "status")
        assert status_state.new_value == "defected"

    async def test_accept_proposal_can_reject_unselected_child_operations(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)
        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Partial accept",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    },
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                    },
                ],
            ),
        )

        field_operation_id = proposal.operations[0].id
        accepted = await service.accept_proposal(
            proposal.id,
            test_user.id,
            ProposalAcceptRequest(accepted_operation_ids=[field_operation_id]),
        )
        relationships = await service.list_relationships(project.id, test_user.id)

        assert accepted.status == "accepted"
        assert accepted.operations[0].status == "accepted"
        assert accepted.operations[1].status == "rejected"
        assert relationships == []

    async def test_accept_proposal_marks_conflict_without_overwriting(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)
        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Stale field update",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    }
                ],
            ),
        )

        character.alignment = "independent"
        await db_session.commit()

        with pytest.raises(ConflictError):
            await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())

        await db_session.refresh(character)
        conflicted = await service.get_proposal(proposal.id, test_user.id)

        assert character.alignment == "independent"
        assert conflicted.status == "conflicted"
        assert conflicted.operations[0].status == "conflicted"
        assert conflicted.operations[0].conflict_reason

    async def _seed_model_config(self, db_session, user_id: int) -> ModelConfig:
        cfg = ModelConfig(
            user_id=user_id,
            name="test",
            model_type="openai",
            api_key="secret",
            scenarios=json.dumps(["knowledge_update"]),
        )
        db_session.add(cfg)
        await db_session.commit()
        await db_session.refresh(cfg)
        return cfg

    async def test_submit_chapter_analysis_skips_when_pending_proposals_exist(
        self,
        db_session,
        test_user,
    ):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        await self._seed_model_config(db_session, test_user.id)

        service = KnowledgeGraphService(db_session)
        await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="existing",
                chapter_id=chapter.id,
                source="chapter_analysis",
                operations=[
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "state_key": "test",
                        "new_value": "x",
                    }
                ],
            ),
        )

        run_id = await service.submit_chapter_analysis(project.id, chapter.id, test_user.id)
        assert run_id is None

    async def test_submit_chapter_analysis_returns_run_id_and_submits_task(
        self,
        db_session,
        test_user,
    ):
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        await self._seed_model_config(db_session, test_user.id)

        import app.application.knowledge_graph_service as kg_module

        original_submit = kg_module.background_runner.submit
        submitted: list[int] = []

        class FakeInfo:
            def __init__(self, run_id: int):
                self.run_id = run_id
                self.task = type("Task", (), {"done": lambda self: True})()

        def mock_submit(run_id, coro, *, timeout=300):
            submitted.append(run_id)
            coro.close()
            return FakeInfo(run_id)

        kg_module.background_runner.submit = mock_submit
        try:
            service = KnowledgeGraphService(db_session)
            run_id = await service.submit_chapter_analysis(project.id, chapter.id, test_user.id)
            assert run_id is not None
            assert len(submitted) == 1
            assert submitted[0] == run_id

            run = await db_session.get(AIRun, run_id)
            assert run is not None
            assert run.workflow_type == "knowledge_update"
            assert run.status == RunStatus.PENDING.value
        finally:
            kg_module.background_runner.submit = original_submit

    async def test_background_task_sets_airun_succeeded_on_success(
        self,
        db_session,
        test_user,
    ):
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        cfg = await self._seed_model_config(db_session, test_user.id)

        service = KnowledgeGraphService(db_session)
        workflow = await service._get_or_create_knowledge_workflow(project.id, cfg.id)
        session = await service._get_or_create_knowledge_session(workflow.id, chapter.id)

        run = AIRun(
            session_id=session.id,
            workflow_type="knowledge_update",
            status=RunStatus.PENDING.value,
            input_data=json.dumps({"chapter_id": chapter.id}),
        )
        db_session.add(run)
        await db_session.commit()
        await db_session.refresh(run)

        original_analyze = KnowledgeGraphService.analyze_chapter

        async def mock_analyze(*args, **kwargs):
            return ChapterKnowledgeAnalysisResponse(
                success=True,
                project_id=project.id,
                chapter_id=chapter.id,
                proposal_count=0,
                message="ok",
            )

        KnowledgeGraphService.analyze_chapter = mock_analyze
        try:
            from app.application.knowledge_graph_service import _run_chapter_analysis_background

            await _run_chapter_analysis_background(
                run.id,
                project.id,
                chapter.id,
                test_user.id,
                cfg.id,
                _db_session=db_session,
            )
            await db_session.refresh(run)
            assert run.status == RunStatus.SUCCEEDED.value
            assert run.finished_at is not None
        finally:
            KnowledgeGraphService.analyze_chapter = original_analyze

    async def test_background_task_sets_airun_failed_on_validation_error(
        self,
        db_session,
        test_user,
    ):
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        cfg = await self._seed_model_config(db_session, test_user.id)

        service = KnowledgeGraphService(db_session)
        workflow = await service._get_or_create_knowledge_workflow(project.id, cfg.id)
        session = await service._get_or_create_knowledge_session(workflow.id, chapter.id)

        run = AIRun(
            session_id=session.id,
            workflow_type="knowledge_update",
            status=RunStatus.PENDING.value,
            input_data=json.dumps({"chapter_id": chapter.id}),
        )
        db_session.add(run)
        await db_session.commit()
        await db_session.refresh(run)

        original_analyze = KnowledgeGraphService.analyze_chapter

        async def mock_analyze(*args, **kwargs):
            raise ValidationError("解析失败")

        KnowledgeGraphService.analyze_chapter = mock_analyze
        try:
            from app.application.knowledge_graph_service import _run_chapter_analysis_background

            await _run_chapter_analysis_background(
                run.id,
                project.id,
                chapter.id,
                test_user.id,
                cfg.id,
                _db_session=db_session,
            )
            await db_session.refresh(run)
            assert run.status == RunStatus.FAILED.value
            assert run.error_message is not None
            assert "解析失败" in run.error_message
        finally:
            KnowledgeGraphService.analyze_chapter = original_analyze

    async def test_background_task_sets_airun_failed_on_cancel(self, db_session, test_user):
        import asyncio

        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        cfg = await self._seed_model_config(db_session, test_user.id)

        service = KnowledgeGraphService(db_session)
        workflow = await service._get_or_create_knowledge_workflow(project.id, cfg.id)
        session = await service._get_or_create_knowledge_session(workflow.id, chapter.id)

        run = AIRun(
            session_id=session.id,
            workflow_type="knowledge_update",
            status=RunStatus.PENDING.value,
            input_data=json.dumps({"chapter_id": chapter.id}),
        )
        db_session.add(run)
        await db_session.commit()
        await db_session.refresh(run)

        original_analyze = KnowledgeGraphService.analyze_chapter

        async def mock_analyze(*args, **kwargs):
            raise asyncio.CancelledError()

        KnowledgeGraphService.analyze_chapter = mock_analyze
        try:
            from app.application.knowledge_graph_service import _run_chapter_analysis_background

            with pytest.raises(asyncio.CancelledError):
                await _run_chapter_analysis_background(
                    run.id,
                    project.id,
                    chapter.id,
                    test_user.id,
                    cfg.id,
                    _db_session=db_session,
                )
            await db_session.refresh(run)
            # 取消（含 runner 超时取消）应将 AIRun 标记为 failed，不留悬空 running
            assert run.status == RunStatus.FAILED.value
            assert run.error_message is not None
            assert run.finished_at is not None
        finally:
            KnowledgeGraphService.analyze_chapter = original_analyze

    async def test_analyze_chapter_auto_writes_character_metadata_and_skips_proposal(
        self,
        db_session,
        test_user,
    ):
        """纯元数据 operation → 不产提案，extra_attributes 已合并落库，状态时间线有审计记录。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        character.extra_attributes = '{"existing_key": "existing_value"}'
        await db_session.commit()

        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Lin Zhao mention update",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            field_name="extra_attributes",
                            new_value={
                                "last_seen_chapter": chapter.id,
                                "mention_count": 3,
                            },
                        )
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(
            project.id, chapter.id, test_user.id, model_config_id=123
        )

        assert response.success is True
        assert response.proposal_count == 0
        assert response.auto_written_count == 2
        assert response.skipped_proposal_count == 0
        assert len(response.proposals) == 0

        await db_session.refresh(character)
        extra = json.loads(character.extra_attributes)
        assert extra["existing_key"] == "existing_value"
        assert extra["last_seen_chapter"] == chapter.id
        assert extra["mention_count"] == 3

        states = await service.list_state_events(project.id, test_user.id)
        assert len(states) == 2
        state_keys = {s.state_key for s in states}
        assert state_keys == {"extra_attributes.last_seen_chapter", "extra_attributes.mention_count"}

    async def test_analyze_chapter_mixed_metadata_and_canon_creates_proposal_with_canon_only(
        self,
        db_session,
        test_user,
    ):
        """混合：元数据自动写，canon 进提案（提案只含 canon operation）。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)

        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Lin Zhao changes",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            field_name="extra_attributes",
                            new_value={"mention_count": 5},
                        ),
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            field_name="alignment",
                            new_value="wavering",
                        ),
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(
            project.id, chapter.id, test_user.id, model_config_id=123
        )

        assert response.success is True
        assert response.proposal_count == 1
        assert response.auto_written_count == 1
        assert len(response.proposals) == 1
        proposal = response.proposals[0]
        assert len(proposal.operations) == 1
        assert proposal.operations[0].operation_type == "entity_field_update"
        assert proposal.operations[0].field_name == "alignment"

        await db_session.refresh(character)
        extra = json.loads(character.extra_attributes)
        assert extra["mention_count"] == 5

    async def test_analyze_chapter_non_character_metadata_falls_through_to_proposal(
        self,
        db_session,
        test_user,
    ):
        """非 character 实体的元数据 op → 降级走提案。"""
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)

        location = Location(project_id=project.id, name="Harbor", description="Old harbor")
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)

        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Location metadata",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="location",
                            entity_name="Harbor",
                            field_name="extra_attributes",
                            new_value={"last_seen_chapter": chapter.id},
                        )
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(
            project.id, chapter.id, test_user.id, model_config_id=123
        )

        assert response.auto_written_count == 0
        assert response.proposal_count == 1
        assert len(response.proposals[0].operations) == 1
        assert response.proposals[0].operations[0].field_name == "extra_attributes"

    async def test_analyze_chapter_extra_attributes_with_non_whitelist_key_goes_to_proposal(
        self,
        db_session,
        test_user,
    ):
        """extra_attributes 含非白名单键 → 不算元数据，走提案。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)

        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Custom attr update",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_field_update",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            field_name="extra_attributes",
                            new_value={"foo": "bar"},
                        )
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(
            project.id, chapter.id, test_user.id, model_config_id=123
        )

        assert response.auto_written_count == 0
        assert response.proposal_count == 1
        assert len(response.proposals[0].operations) == 1
        assert response.proposals[0].operations[0].field_name == "extra_attributes"


    async def test_repeat_accept_final_proposal_raises_validation_error(self, db_session, test_user):
        """Bug 1: 重复 accept 已终态提案应抛 ValidationError。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)
        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Accept once",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    }
                ],
            ),
        )

        first = await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        assert first.status == "accepted"

        with pytest.raises(ValidationError, match="提案已处理"):
            await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())

    async def test_conflicted_proposal_does_not_block_chapter_reanalysis(self, db_session, test_user):
        """Bug 3: conflicted 提案不应阻塞同章节的重新分析。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        service = KnowledgeGraphService(db_session)

        # 制造一个 conflicted 提案
        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Stale",
                chapter_id=chapter.id,
                source="chapter_analysis",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    }
                ],
            ),
        )
        character.alignment = "independent"
        await db_session.commit()

        with pytest.raises(ConflictError):
            await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())

        # 重新分析应能调 AI
        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="New analysis",
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_state_event",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            state_key="mood",
                            new_value="angry",
                        )
                    ],
                )
            ]
        )
        structured_model = FakeStructuredKnowledgeModel(draft)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        response = await service.analyze_chapter(project.id, chapter.id, test_user.id, model_config_id=123)
        assert structured_model.calls == 1
        assert response.proposal_count == 1

    async def test_entity_state_event_conflict_detected_for_pending_operations(self, db_session, test_user):
        """Bug 4: 同 entity+state_key 的两个 pending state_event 应触发冲突。"""
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)

        await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="State A",
                operations=[
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "state_key": "status",
                        "new_value": "injured",
                    }
                ],
            ),
        )

        proposal2 = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="State B",
                operations=[
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "state_key": "status",
                        "new_value": "dead",
                    }
                ],
            ),
        )

        with pytest.raises(ConflictError):
            await service.accept_proposal(proposal2.id, test_user.id, ProposalAcceptRequest())

        conflicted = await service.get_proposal(proposal2.id, test_user.id)
        assert conflicted.status == "conflicted"
        assert conflicted.operations[0].conflict_reason == "存在另一个待处理提案修改同一目标"

    async def test_relationship_upsert_reactivate_preserves_original_proposal_id(self, db_session, test_user):
        """Bug 6: 重激活已 inactive 的关系时不应覆盖原 proposal_id。"""
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)

        # 创建关系
        proposal_a = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Create relation",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                        "payload": {"status": "active"},
                    }
                ],
            ),
        )
        await service.accept_proposal(proposal_a.id, test_user.id, ProposalAcceptRequest())

        # 删除关系
        proposal_del = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Delete relation",
                operations=[
                    {
                        "operation_type": "relationship_delete",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                    }
                ],
            ),
        )
        await service.accept_proposal(proposal_del.id, test_user.id, ProposalAcceptRequest())

        # 重激活
        proposal_b = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Reactivate relation",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                        "payload": {"status": "active", "description": "reborn"},
                    }
                ],
            ),
        )
        await service.accept_proposal(proposal_b.id, test_user.id, ProposalAcceptRequest())

        relationships = await service.list_relationships(project.id, test_user.id)
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.status == "active"
        assert rel.proposal_id == proposal_a.id

    async def test_relationship_delete_missing_marks_operation_conflicted(self, db_session, test_user):
        """Bug 7: force 模式下删除不存在的关系应标记 operation conflicted。"""
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Delete missing",
                operations=[
                    {
                        "operation_type": "relationship_delete",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                    }
                ],
            ),
        )

        with pytest.raises(ConflictError):
            await service.accept_proposal(
                proposal.id,
                test_user.id,
                ProposalAcceptRequest(force_conflicts=True),
            )

        conflicted = await service.get_proposal(proposal.id, test_user.id)
        assert conflicted.status == "conflicted"
        assert conflicted.operations[0].status == "conflicted"
        assert "要删除的关系不存在" in conflicted.operations[0].conflict_reason
