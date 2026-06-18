"""KnowledgeGraphService proposal lifecycle tests."""

import json

import pytest
from sqlalchemy import select

from app.application.knowledge_graph_service import KnowledgeGraphService
from app.application.project_service import ProjectService
from app.core.exceptions import ConflictError, ValidationError
from app.domain.ai_runtime.enums import RunStatus
from app.infrastructure.db.models.ai_runtime import AIRun
from app.infrastructure.db.models.manuscript import Chapter
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.models.story_knowledge import EntityRelationship, EntityStateEvent
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
        self.messages = []

    async def ainvoke(self, messages):
        self.calls += 1
        self.messages.append(messages)
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

    async def test_analyze_chapter_prompt_includes_existing_graph_history(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        db_session.add(
            EntityRelationship(
                project_id=project.id,
                source_type="character",
                source_id=character.id,
                relation_type="enemy_of",
                target_type="organization",
                target_id=organization.id,
                status="active",
                description="openly opposes the guild",
                source="test",
            )
        )
        db_session.add(
            EntityStateEvent(
                project_id=project.id,
                chapter_id=chapter.id,
                entity_type="character",
                entity_id=character.id,
                state_key="condition",
                new_value="injured",
                summary="hurt during the harbor fight",
                source="test",
                chapter_order=chapter.order_index,
            )
        )
        await db_session.commit()
        structured_model = FakeStructuredKnowledgeModel(ChapterKnowledgeAnalysisDraft(proposals=[]))
        service = KnowledgeGraphService(db_session)

        async def fake_get_config_and_model(_config_id: int, _user_id: int):
            return None, FakeChatModel(structured_model)

        service._get_config_and_model = fake_get_config_and_model

        await service.analyze_chapter(project.id, chapter.id, test_user.id, model_config_id=123)

        prompt = structured_model.messages[0][1].content
        assert "relationships" in prompt
        assert "state_events" in prompt
        assert "enemy_of" in prompt
        assert "injured" in prompt

    async def test_analyze_chapter_can_create_new_entity_and_related_edge_in_one_proposal(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        chapter = await self._seed_chapter(db_session, project.id)
        draft = ChapterKnowledgeAnalysisDraft(
            proposals=[
                KnowledgeProposalDraft(
                    title="Moon Gate enters the story",
                    summary="A new location becomes important for later travel.",
                    evidence="Lin Zhao reached Moon Gate before dawn.",
                    confidence=0.91,
                    operations=[
                        KnowledgeOperationDraft(
                            operation_type="entity_create",
                            entity_type="location",
                            entity_name="Moon Gate",
                            payload={
                                "name": "Moon Gate",
                                "description": "A hidden pass used by smugglers.",
                                "geography": "narrow mountain gate",
                                "unknown_field": "ignored",
                            },
                        ),
                        KnowledgeOperationDraft(
                            operation_type="relationship_upsert",
                            entity_type="character",
                            entity_name="Lin Zhao",
                            relation_type="located_in",
                            target_type="location",
                            target_name="Moon Gate",
                            payload={"description": "reaches Moon Gate before dawn"},
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

        response = await service.analyze_chapter(project.id, chapter.id, test_user.id, model_config_id=123)
        proposal = response.proposals[0]
        create_op = proposal.operations[0]
        relationship_op = proposal.operations[1]

        assert response.proposal_count == 1
        assert create_op.operation_type == "entity_create"
        assert create_op.entity_type == "location"
        assert create_op.entity_id is None
        assert create_op.payload == {
            "name": "Moon Gate",
            "description": "A hidden pass used by smugglers.",
            "geography": "narrow mountain gate",
        }
        assert relationship_op.operation_type == "relationship_upsert"
        assert relationship_op.entity_id == character.id
        assert relationship_op.target_id is None
        assert relationship_op.payload["pending_target_ref"] == {"type": "location", "name": "Moon Gate"}

        accepted = await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        created_location = (
            await db_session.execute(
                select(Location).where(Location.project_id == project.id, Location.name == "Moon Gate")
            )
        ).scalar_one()
        states = await service.list_state_events(project.id, test_user.id, entity_type="location", entity_id=created_location.id)
        relationships = await service.list_relationships(project.id, test_user.id, entity_type="location", entity_id=created_location.id)

        assert accepted.status == "accepted"
        assert accepted.operations[0].entity_id == created_location.id
        assert accepted.operations[1].target_id == created_location.id
        assert created_location.description == "A hidden pass used by smugglers."
        assert states[0].state_key == "created"
        assert relationships[0].source_id == character.id
        assert relationships[0].target_id == created_location.id
        assert relationships[0].relation_type == "located_in"

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
        active_refs = {
            (relationship.source_type, relationship.source_id, relationship.relation_type, relationship.target_type, relationship.target_id)
            for relationship in relationships
            if relationship.status == "active"
        }
        assert active_refs == {
            ("character", character.id, "enemy_of", "organization", organization.id),
            ("organization", organization.id, "enemy_of", "character", character.id),
        }
        assert {relationship.description for relationship in relationships} == {"openly opposes the guild"}
        # entity_field_update 现在同步写入状态时间线，故 alignment 与 status 两条均可见
        assert len(states) == 2
        assert {state.state_key for state in states} == {"alignment", "status"}
        status_state = next(state for state in states if state.state_key == "status")
        assert status_state.new_value == "defected"

    async def test_member_of_relationship_preserves_multiple_active_memberships(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        new_organization = Organization(
            project_id=project.id,
            name="Dawn Circle",
            description="rival faction",
        )
        db_session.add(new_organization)
        db_session.add(
            EntityRelationship(
                project_id=project.id,
                source_type="character",
                source_id=character.id,
                relation_type="member_of",
                target_type="organization",
                target_id=organization.id,
                status="active",
                source="test",
            )
        )
        await db_session.commit()
        await db_session.refresh(new_organization)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Lin Zhao joins Dawn Circle",
                evidence="Lin Zhao swore the Dawn Circle oath.",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "member_of",
                        "target_type": "organization",
                        "target_id": new_organization.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        await db_session.refresh(character)
        states = await service.list_state_events(project.id, test_user.id, entity_type="character", entity_id=character.id)
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.project_id == project.id,
                    EntityRelationship.source_type == "character",
                    EntityRelationship.source_id == character.id,
                    EntityRelationship.relation_type == "member_of",
                )
            )
        ).scalars().all()
        statuses_by_target = {relationship.target_id: relationship.status for relationship in relationships}

        assert character.organization_id == organization.id
        assert statuses_by_target[organization.id] == "active"
        assert statuses_by_target[new_organization.id] == "active"
        assert all(state.state_key != "organization_id" for state in states)

    async def test_member_of_relationship_fills_empty_primary_organization_id(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        character.organization_id = None
        new_organization = Organization(
            project_id=project.id,
            name="Dawn Circle",
            description="rival faction",
        )
        db_session.add(new_organization)
        await db_session.commit()
        await db_session.refresh(new_organization)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Lin Zhao joins Dawn Circle",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "member_of",
                        "target_type": "organization",
                        "target_id": new_organization.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        await db_session.refresh(character)
        states = await service.list_state_events(project.id, test_user.id, entity_type="character", entity_id=character.id)

        assert character.organization_id == new_organization.id
        organization_state = next(state for state in states if state.state_key == "organization_id")
        assert organization_state.old_value is None
        assert organization_state.new_value == new_organization.id

    async def test_organization_id_field_update_syncs_member_of_relationships(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        new_organization = Organization(
            project_id=project.id,
            name="Dawn Circle",
            description="rival faction",
        )
        db_session.add(new_organization)
        db_session.add(
            EntityRelationship(
                project_id=project.id,
                source_type="character",
                source_id=character.id,
                relation_type="member_of",
                target_type="organization",
                target_id=organization.id,
                status="active",
                source="test",
            )
        )
        await db_session.commit()
        await db_session.refresh(new_organization)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Lin Zhao changes faction",
                operations=[
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "field_name": "organization_id",
                        "expected_old_value": organization.id,
                        "new_value": new_organization.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        await db_session.refresh(character)
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.project_id == project.id,
                    EntityRelationship.source_type == "character",
                    EntityRelationship.source_id == character.id,
                    EntityRelationship.relation_type == "member_of",
                )
            )
        ).scalars().all()
        statuses_by_target = {relationship.target_id: relationship.status for relationship in relationships}

        assert character.organization_id == new_organization.id
        assert statuses_by_target[organization.id] == "active"
        assert statuses_by_target[new_organization.id] == "active"

    async def test_member_of_delete_moves_primary_to_remaining_membership(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        new_organization = Organization(
            project_id=project.id,
            name="Dawn Circle",
            description="rival faction",
        )
        db_session.add(new_organization)
        await db_session.flush()
        db_session.add_all(
            [
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="member_of",
                    target_type="organization",
                    target_id=organization.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="member_of",
                    target_type="organization",
                    target_id=new_organization.id,
                    status="active",
                    source="test",
                ),
            ]
        )
        await db_session.commit()
        await db_session.refresh(new_organization)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Lin Zhao leaves Ash Guild",
                operations=[
                    {
                        "operation_type": "relationship_delete",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "member_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        await db_session.refresh(character)
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.project_id == project.id,
                    EntityRelationship.source_type == "character",
                    EntityRelationship.source_id == character.id,
                    EntityRelationship.relation_type == "member_of",
                )
            )
        ).scalars().all()
        statuses_by_target = {relationship.target_id: relationship.status for relationship in relationships}

        assert character.organization_id == new_organization.id
        assert statuses_by_target[organization.id] == "inactive"
        assert statuses_by_target[new_organization.id] == "active"

    async def test_bidirectional_relationships_are_synced_on_accept(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        princess = Character(project_id=project.id, name="Princess Gu", description="imperial princess")
        child = Character(project_id=project.id, name="Lin Heir", description="their son")
        db_session.add_all([princess, child])
        await db_session.commit()
        await db_session.refresh(princess)
        await db_session.refresh(child)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Family ties",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "spouse_of",
                        "target_type": "character",
                        "target_id": princess.id,
                    },
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": child.id,
                        "relation_type": "child_of",
                        "target_type": "character",
                        "target_id": character.id,
                    },
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(EntityRelationship.project_id == project.id)
            )
        ).scalars().all()
        active_refs = {
            (relationship.source_id, relationship.relation_type, relationship.target_id)
            for relationship in relationships
            if relationship.status == "active"
        }

        assert (character.id, "spouse_of", princess.id) in active_refs
        assert (princess.id, "spouse_of", character.id) in active_refs
        assert (child.id, "child_of", character.id) in active_refs
        assert (character.id, "parent_of", child.id) in active_refs

    async def test_relationship_delete_deactivates_inverse_relationship(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        princess = Character(project_id=project.id, name="Princess Gu", description="imperial princess")
        db_session.add(princess)
        await db_session.flush()
        db_session.add_all(
            [
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="spouse_of",
                    target_type="character",
                    target_id=princess.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=princess.id,
                    relation_type="spouse_of",
                    target_type="character",
                    target_id=character.id,
                    status="active",
                    source="test",
                ),
            ]
        )
        await db_session.commit()
        await db_session.refresh(princess)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Annul marriage",
                operations=[
                    {
                        "operation_type": "relationship_delete",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "spouse_of",
                        "target_type": "character",
                        "target_id": princess.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.project_id == project.id,
                    EntityRelationship.relation_type == "spouse_of",
                )
            )
        ).scalars().all()

        assert {relationship.status for relationship in relationships} == {"inactive"}

    async def test_relationship_delete_deactivates_custom_synced_inverse_without_policy(self, db_session, test_user):
        project, character, _organization = await self._seed_entities(db_session, test_user.id)
        disciple = Character(project_id=project.id, name="Disciple Gu", description="young cultivator")
        db_session.add(disciple)
        await db_session.commit()
        await db_session.refresh(disciple)
        service = KnowledgeGraphService(db_session)

        create_proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Mentorship starts",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "mentor_of",
                        "target_type": "character",
                        "target_id": disciple.id,
                        "payload": {"policy": {"inverse_relation_type": "disciple_of"}},
                    }
                ],
            ),
        )
        await service.accept_proposal(create_proposal.id, test_user.id, ProposalAcceptRequest())

        delete_proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Mentorship ends",
                operations=[
                    {
                        "operation_type": "relationship_delete",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "mentor_of",
                        "target_type": "character",
                        "target_id": disciple.id,
                    }
                ],
            ),
        )
        await service.accept_proposal(delete_proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(EntityRelationship.project_id == project.id)
            )
        ).scalars().all()
        by_type = {relationship.relation_type: relationship.status for relationship in relationships}

        assert by_type["mentor_of"] == "inactive"
        assert by_type["disciple_of"] == "inactive"

    async def test_relationship_policy_supports_custom_inverse_and_target_exclusive_scope(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        usurper = Character(project_id=project.id, name="Second Prince", description="new emperor")
        db_session.add(usurper)
        await db_session.commit()
        await db_session.refresh(usurper)
        service = KnowledgeGraphService(db_session)

        first_proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="First ruler takes the throne",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "relation_type": "ruler_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                        "payload": {
                            "policy": {
                                "inverse_relation_type": "ruled_by",
                                "exclusive_scope": "target_relation",
                            }
                        },
                    }
                ],
            ),
        )
        await service.accept_proposal(first_proposal.id, test_user.id, ProposalAcceptRequest())

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Second Prince usurps the throne",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": usurper.id,
                        "relation_type": "ruler_of",
                        "target_type": "organization",
                        "target_id": organization.id,
                        "payload": {
                            "policy": {
                                "inverse_relation_type": "ruled_by",
                                "exclusive_scope": "target_relation",
                            }
                        },
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(EntityRelationship.project_id == project.id)
            )
        ).scalars().all()
        by_ref = {
            (
                relationship.source_type,
                relationship.source_id,
                relationship.relation_type,
                relationship.target_type,
                relationship.target_id,
            ): relationship.status
            for relationship in relationships
        }

        assert by_ref[("character", character.id, "ruler_of", "organization", organization.id)] == "inactive"
        assert by_ref[("organization", organization.id, "ruled_by", "character", character.id)] == "inactive"
        assert by_ref[("character", usurper.id, "ruler_of", "organization", organization.id)] == "active"
        assert by_ref[("organization", organization.id, "ruled_by", "character", usurper.id)] == "active"

    async def test_located_in_upsert_deactivates_previous_location(self, db_session, test_user):
        project, _character, organization = await self._seed_entities(db_session, test_user.id)
        town = Location(project_id=project.id, name="Town A", description="old base")
        capital = Location(project_id=project.id, name="Imperial Capital", description="new base")
        db_session.add_all([town, capital])
        await db_session.flush()
        db_session.add(
            EntityRelationship(
                project_id=project.id,
                source_type="organization",
                source_id=organization.id,
                relation_type="located_in",
                target_type="location",
                target_id=town.id,
                status="active",
                source="test",
            )
        )
        await db_session.commit()
        await db_session.refresh(capital)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Family relocates",
                operations=[
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "organization",
                        "entity_id": organization.id,
                        "relation_type": "located_in",
                        "target_type": "location",
                        "target_id": capital.id,
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.project_id == project.id,
                    EntityRelationship.source_type == "organization",
                    EntityRelationship.source_id == organization.id,
                    EntityRelationship.relation_type == "located_in",
                )
            )
        ).scalars().all()
        statuses_by_target = {relationship.target_id: relationship.status for relationship in relationships}

        assert statuses_by_target[town.id] == "inactive"
        assert statuses_by_target[capital.id] == "active"

    async def test_terminal_state_events_close_destroyed_and_ascended_links(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        rival = Organization(project_id=project.id, name="Rival Clan", description="old enemy")
        realm = Location(project_id=project.id, name="Mortal Realm", description="starting plane")
        princess = Character(project_id=project.id, name="Princess Gu", description="imperial princess")
        db_session.add_all([rival, realm, princess])
        await db_session.flush()
        db_session.add_all(
            [
                EntityRelationship(
                    project_id=project.id,
                    source_type="organization",
                    source_id=organization.id,
                    relation_type="enemy_of",
                    target_type="organization",
                    target_id=rival.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="organization",
                    source_id=rival.id,
                    relation_type="located_in",
                    target_type="location",
                    target_id=realm.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="located_in",
                    target_type="location",
                    target_id=realm.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="spouse_of",
                    target_type="character",
                    target_id=princess.id,
                    status="active",
                    source="test",
                ),
            ]
        )
        await db_session.commit()
        await db_session.refresh(rival)
        await db_session.refresh(realm)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Rival clan falls and Lin Zhao ascends",
                operations=[
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "organization",
                        "entity_id": rival.id,
                        "state_key": "status",
                        "new_value": "destroyed",
                    },
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character.id,
                        "state_key": "status",
                        "new_value": "ascended",
                    },
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(EntityRelationship.project_id == project.id)
            )
        ).scalars().all()
        by_ref = {
            (
                relationship.source_type,
                relationship.source_id,
                relationship.relation_type,
                relationship.target_type,
                relationship.target_id,
            ): relationship.status
            for relationship in relationships
        }

        assert by_ref[("organization", organization.id, "enemy_of", "organization", rival.id)] == "inactive"
        assert by_ref[("organization", rival.id, "located_in", "location", realm.id)] == "inactive"
        assert by_ref[("character", character.id, "located_in", "location", realm.id)] == "inactive"
        assert by_ref[("character", character.id, "spouse_of", "character", princess.id)] == "active"

    async def test_state_relationship_effects_payload_deactivates_custom_relationship_scope(self, db_session, test_user):
        project, character, organization = await self._seed_entities(db_session, test_user.id)
        sect = Organization(project_id=project.id, name="Sect V", description="outside sect")
        child = Character(project_id=project.id, name="Lin Heir", description="divine body")
        db_session.add_all([sect, child])
        await db_session.flush()
        db_session.add_all(
            [
                EntityRelationship(
                    project_id=project.id,
                    source_type="organization",
                    source_id=sect.id,
                    relation_type="targets",
                    target_type="character",
                    target_id=child.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="character",
                    source_id=character.id,
                    relation_type="parent_of",
                    target_type="character",
                    target_id=child.id,
                    status="active",
                    source="test",
                ),
                EntityRelationship(
                    project_id=project.id,
                    source_type="organization",
                    source_id=organization.id,
                    relation_type="protects",
                    target_type="character",
                    target_id=child.id,
                    status="active",
                    source="test",
                ),
            ]
        )
        await db_session.commit()
        await db_session.refresh(child)
        service = KnowledgeGraphService(db_session)

        proposal = await service.create_proposal(
            project.id,
            test_user.id,
            EntityChangeProposalCreate(
                title="Child is no longer targeted",
                operations=[
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": child.id,
                        "state_key": "danger",
                        "new_value": "protected",
                        "payload": {
                            "relationship_effects": [
                                {"action": "deactivate", "scope": "target", "relation_type": "targets"}
                            ]
                        },
                    }
                ],
            ),
        )

        await service.accept_proposal(proposal.id, test_user.id, ProposalAcceptRequest())
        relationships = (
            await db_session.execute(
                select(EntityRelationship).where(EntityRelationship.project_id == project.id)
            )
        ).scalars().all()
        by_relation = {relationship.relation_type: relationship.status for relationship in relationships}

        assert by_relation["targets"] == "inactive"
        assert by_relation["parent_of"] == "active"
        assert by_relation["protects"] == "active"

    async def test_create_proposal_rejects_field_missing_from_target_model(self, db_session, test_user):
        project, _character, _organization = await self._seed_entities(db_session, test_user.id)
        location = Location(project_id=project.id, name="Harbor", description="Old harbor")
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)
        service = KnowledgeGraphService(db_session)

        with pytest.raises(ValidationError):
            await service.create_proposal(
                project.id,
                test_user.id,
                EntityChangeProposalCreate(
                    title="Invalid location metadata",
                    operations=[
                        {
                            "operation_type": "entity_field_update",
                            "entity_type": "location",
                            "entity_id": location.id,
                            "field_name": "extra_attributes",
                            "new_value": {"last_seen_chapter": 1},
                        }
                    ],
                ),
            )

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

    async def test_analyze_chapter_non_character_metadata_is_skipped(
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
        assert response.proposal_count == 0
        assert response.skipped_proposal_count == 1
        assert response.proposals == []

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
        assert len(relationships) == 2
        assert {relationship.status for relationship in relationships} == {"active"}
        assert {relationship.proposal_id for relationship in relationships} == {proposal_a.id}

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
