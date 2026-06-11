"""Admin 管理 API v1"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.admin_service import AdminService
from app.core.exceptions import ForbiddenError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db

router = APIRouter(prefix="/api/v1/admin", tags=["Admin 管理"])


class KeyRotateRequest(BaseModel):
    model_config_id: int


class KeyRotateResponse(BaseModel):
    model_config_id: int
    new_encrypted_key: str
    message: str


@router.post("/keys/rotate", response_model=KeyRotateResponse)
async def rotate_model_key(
    body: KeyRotateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """轮换指定模型配置的 API Key 加密密钥（Admin 专用）"""
    if not getattr(user, "is_superuser", False):
        raise ForbiddenError("无权访问：仅超级管理员可操作")

    service = AdminService(db)
    result = await service.rotate_model_key(body.model_config_id)
    return KeyRotateResponse(**result)
