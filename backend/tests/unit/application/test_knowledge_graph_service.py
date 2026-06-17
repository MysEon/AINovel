"""KnowledgeGraphService proposal lifecycle tests."""

import pytest

from app.application.knowledge_graph_service import KnowledgeGraphService
from app.application.project_service import ProjectService
from app.core.exceptions import ConflictError
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.worldbuilding import Character, Organization
from app.schemas.knowledge import (
    ChapterKnowledgeAnalysisDraft,
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
