"""实体引用完整性 —— 删除实体时清理悬挂的多态软引用。

知识图谱三张多态表（entity_relationships / entity_state_events /
proposal_operations）用 source_type+source_id 等字符串+整型软引用指向四个核心
实体表，无法用数据库外键约束。删除实体时若不清理，会留下指向不存在实体的孤儿记录。

清理策略：
- entity_relationships：硬删该实体作为 source 或 target 的边。
  当前边缺少任一端点即无意义，且身份唯一约束会阻止同名边重建。
- entity_state_events：硬删该实体的时间线条目。
  已不存在实体的状态轨迹是噪声。
- proposal_operations：不删（会破坏提案结构）。将仍 pending/conflicted 的操作标记为
  rejected，理由"目标实体已删除"，使其永不再 apply 到缺失目标。
- characters.organization_id：删除组织时置空指向它的外键（配合已开启的 PRAGMA foreign_keys）。
"""

from sqlalchemy import and_, delete, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models.story_knowledge import (
    EntityRelationship,
    EntityStateEvent,
    ProposalOperation,
)
from app.infrastructure.db.models.worldbuilding import Character

ENTITY_DELETED_REASON = "目标实体已删除"


async def cleanup_entity_references(
    db: AsyncSession,
    *,
    project_id: int,
    entity_type: str,
    entity_id: int,
) -> None:
    """删除实体前调用，清理该实体的全部图引用。须与实体删除在同一事务内。"""

    # 1) 删除组织时先置空角色的 organization_id，避免外键约束阻止删除
    if entity_type == "organization":
        await db.execute(
            update(Character)
            .where(Character.organization_id == entity_id)
            .values(organization_id=None)
        )

    # 2) 硬删涉及该实体的关系边
    await db.execute(
        delete(EntityRelationship).where(
            EntityRelationship.project_id == project_id,
            or_(
                and_(
                    EntityRelationship.source_type == entity_type,
                    EntityRelationship.source_id == entity_id,
                ),
                and_(
                    EntityRelationship.target_type == entity_type,
                    EntityRelationship.target_id == entity_id,
                ),
            ),
        )
    )

    # 3) 硬删该实体的状态时间线条目
    await db.execute(
        delete(EntityStateEvent).where(
            EntityStateEvent.project_id == project_id,
            EntityStateEvent.entity_type == entity_type,
            EntityStateEvent.entity_id == entity_id,
        )
    )

    # 4) 将仍 pending/conflicted 且指向该实体的提案操作标记为 rejected
    await db.execute(
        update(ProposalOperation)
        .where(
            ProposalOperation.status.in_(("pending", "conflicted")),
            or_(
                and_(
                    ProposalOperation.entity_type == entity_type,
                    ProposalOperation.entity_id == entity_id,
                ),
                and_(
                    ProposalOperation.target_type == entity_type,
                    ProposalOperation.target_id == entity_id,
                ),
            ),
        )
        .values(status="rejected", conflict_reason=ENTITY_DELETED_REASON)
    )
