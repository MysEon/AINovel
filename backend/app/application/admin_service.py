"""Admin 管理 Application Service

职责：
- key rotation 逻辑
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service

_encryption_service = get_encryption_service()


class AdminService:
    """Admin 管理业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def rotate_model_key(self, model_config_id: int) -> dict:
        """轮换指定模型配置的 API Key 加密密钥"""
        result = await self.db.execute(select(ModelConfig).where(ModelConfig.id == model_config_id))
        cfg = result.scalar_one_or_none()
        if not cfg:
            raise NotFoundError("模型配置不存在")
        if not cfg.api_key:
            raise NotFoundError("该配置没有 API 密钥可轮换")

        # 解密旧密文并用当前密钥重新加密（若 ENCRYPTION_KEY 已变更，则实现轮换）
        plaintext = _encryption_service.decrypt(cfg.api_key)
        new_ciphertext = _encryption_service.encrypt(plaintext)

        cfg.api_key = new_ciphertext
        await self.db.commit()

        return {
            "model_config_id": cfg.id,
            "new_encrypted_key": new_ciphertext,
            "message": "API Key 加密已轮换",
        }
