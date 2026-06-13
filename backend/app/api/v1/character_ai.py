"""角色 AI 生成 API v1。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.character_ai_service import CharacterAIService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.character_ai import AIGenerateCharacterRequest, CharacterDraftSchema

router = APIRouter(prefix="/api/v1", tags=["小说元素：角色 AI"])


@router.post("/projects/{project_id}/characters/ai-generate", response_model=CharacterDraftSchema)
async def ai_generate_character(
    project_id: int,
    body: AIGenerateCharacterRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = CharacterAIService(db)
    return await service.generate_draft(project_id, user.id, body)
