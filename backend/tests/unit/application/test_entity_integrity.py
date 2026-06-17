"""实体引用完整性清理 —— 删除实体时清理悬挂软引用。"""

import pytest
from sqlalchemy import select

from app.application.entity_integrity import cleanup_entity_references
from app.application.project_service import ProjectService
from app.infrastructure.db.models.story_knowledge import (
    EntityChangeProposal,
    EntityRelationship,
    EntityStateEvent,
    ProposalOperation,
)
from app.infrastructure.db.models.worldbuilding import Character, Organization
from app.schemas.projects import ProjectCreate


@pytest.mark.asyncio
class TestEntityIntegrityCleanup:
    async def _seed(self, db_session, user_id: int):
        project = await ProjectService(db_session).create(ProjectCreate(name="Integrity"), user_id)
        organization = Organization(project_id=project.id, name="Ash Guild")
        character = Character(
            project_id=project.id, name="Lin Zhao", alignment="loyal", organization=organization
        )
        db_session.add_all([organization, character])
        await db_session.commit()
        await db_session.refresh(project)
        await db_session.refresh(organization)
        await db_session.refresh(character)
        return project, character, organization

    async def test_cleanup_removes_relationships_state_events_and_rejects_pending_ops(
        self, db_session, test_user
    ):
        project, character, organization = await self._seed(db_session, test_user.id)

        # 该角色作为源的关系边
        rel = EntityRelationship(
            project_id=project.id,
            source_type="character",
            source_id=character.id,
            relation_type="enemy_of",
            target_type="organization",
            target_id=organization.id,
        )
        # 该角色的状态时间线
        event = EntityStateEvent(
            project_id=project.id,
            entity_type="character",
            entity_id=character.id,
            state_key="alignment",
            old_value="loyal",
            new_value="defector",
        )
        # 指向该角色的待处理提案操作
        proposal = EntityChangeProposal(project_id=project.id, title="stale", source="manual")
        db_session.add_all([rel, event, proposal])
        await db_session.flush()
        op = ProposalOperation(
            proposal_id=proposal.id,
            sort_order=0,
            operation_type="entity_field_update",
            status="pending",
            entity_type="character",
            entity_id=character.id,
            field_name="alignment",
        )
        db_session.add(op)
        await db_session.commit()

        await cleanup_entity_references(
            db_session, project_id=project.id, entity_type="character", entity_id=character.id
        )
        await db_session.commit()

        assert (await db_session.execute(select(EntityRelationship).where(EntityRelationship.id == rel.id))).scalar_one_or_none() is None
        assert (await db_session.execute(select(EntityStateEvent).where(EntityStateEvent.id == event.id))).scalar_one_or_none() is None
        refreshed_op = (
            await db_session.execute(select(ProposalOperation).where(ProposalOperation.id == op.id))
        ).scalar_one()
        assert refreshed_op.status == "rejected"
        assert refreshed_op.conflict_reason == "目标实体已删除"

    async def test_cleanup_organization_nulls_character_organization_id(self, db_session, test_user):
        project, character, organization = await self._seed(db_session, test_user.id)
        assert character.organization_id == organization.id

        await cleanup_entity_references(
            db_session, project_id=project.id, entity_type="organization", entity_id=organization.id
        )
        await db_session.delete(organization)
        await db_session.commit()

        await db_session.refresh(character)
        assert character.organization_id is None
