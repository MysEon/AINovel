"""Admin 管理 API v1"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service
from app.api.deps.auth import require_active_user

router = APIRouter(prefix="/api/v1/admin", tags=["Admin 管理"])

_encryption_service = get_encryption_service()


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

    from sqlalchemy import select
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.id == body.model_config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise NotFoundError("模型配置不存在")
    if not cfg.api_key:
        raise NotFoundError("该配置没有 API 密钥可轮换")

    # 解密旧密文
    plaintext = _encryption_service.decrypt(cfg.api_key)

    # 用当前密钥重新加密（若 ENCRYPTION_KEY 已变更，则实现轮换）
    new_ciphertext = _encryption_service.encrypt(plaintext)

    cfg.api_key = new_ciphertext
    await db.commit()

    return KeyRotateResponse(
        model_config_id=cfg.id,
        new_encrypted_key=new_ciphertext,
        message="API Key 加密已轮换",
    )
