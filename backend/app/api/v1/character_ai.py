"""角色 AI 生成 API v1。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.character_ai_service import CharacterAIService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.character_ai import AIGenerateCharacterRequest, CharacterDraftBatchResponse

router = APIRouter(prefix="/api/v1", tags=["小说元素：角色 AI"])


@router.post(
    "/projects/{project_id}/characters/ai-generate",
    response_model=CharacterDraftBatchResponse,
)
async def ai_generate_character(
    project_id: int,
    body: AIGenerateCharacterRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """两步式生成：先规划（判断要生成几个角色、分别是谁），再批量产出完整档案。

    响应 schema 由单对象升级为 `CharacterDraftBatchResponse{plan, characters: list}`，
    单角色场景下 characters 数组长度为 1。前端需对应升级到多 draft 审阅 UI。
    """
    service = CharacterAIService(db)
    return await service.generate_drafts(project_id, user.id, body)
