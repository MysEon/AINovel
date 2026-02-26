"""模型配置管理 API v1"""

import base64
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.repositories.base import BaseRepository
from app.schemas.model_configs import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse
from app.api.deps.auth import require_active_user

router = APIRouter(prefix="/api/v1/model-configs", tags=["AI辅助：模型配置"])


class ModelConfigRepository(BaseRepository[ModelConfig]):
    model = ModelConfig


# ---------- API Key 工具函数 ----------
# TODO Phase 6+: 替换为真正的加密方案（如 Fernet / KMS）
def _encrypt_key(key: str) -> str:
    return base64.b64encode(key.encode()).decode()


def _decrypt_key(encrypted: str) -> str:
    return base64.b64decode(encrypted.encode()).decode()


def _mask_key(api_key: str) -> str:
    if not api_key or len(api_key) <= 8:
        return "*" * len(api_key) if api_key else ""
    return api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]


async def _get_user_config(
    config_id: int, user_id: int, db: AsyncSession,
) -> ModelConfig:
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id, ModelConfig.user_id == user_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise NotFoundError("模型配置不存在或无权访问")
    return cfg


def _serialize_stop_sequences(seqs: Optional[list]) -> Optional[str]:
    return json.dumps(seqs) if seqs else None


def _attach_masked_key(cfg: ModelConfig) -> ModelConfig:
    """为配置对象附加遮蔽的 API Key（供响应序列化）"""
    if cfg.api_key:
        cfg.api_key_masked = _mask_key(_decrypt_key(cfg.api_key))
    else:
        cfg.api_key_masked = None
    return cfg


# ---------- CRUD 端点 ----------


@router.post("/", response_model=ModelConfigResponse, status_code=201)
async def create_config(
    body: ModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    encrypted_key = _encrypt_key(body.api_key) if body.api_key else None
    masked_key = _mask_key(body.api_key) if body.api_key else None

    cfg = ModelConfig(
        **body.model_dump(exclude={"api_key", "stop_sequences"}),
        api_key=encrypted_key,
        stop_sequences=_serialize_stop_sequences(body.stop_sequences),
        user_id=user.id,
    )
    repo = ModelConfigRepository(db)
    await repo.create(cfg)
    await db.commit()
    await db.refresh(cfg)
    cfg.api_key_masked = masked_key
    return cfg


@router.get("/", response_model=List[ModelConfigResponse])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user.id)
        .order_by(ModelConfig.name)
    )
    configs = result.scalars().all()
    for c in configs:
        _attach_masked_key(c)
    return configs


@router.get("/{config_id}", response_model=ModelConfigResponse)
async def get_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    cfg = await _get_user_config(config_id, user.id, db)
    return _attach_masked_key(cfg)


@router.put("/{config_id}", response_model=ModelConfigResponse)
async def update_config(
    config_id: int,
    body: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    cfg = await _get_user_config(config_id, user.id, db)
    data = body.model_dump(exclude_unset=True)

    # 处理 API Key 加密
    if "api_key" in data and data["api_key"] is not None:
        data["api_key"] = _encrypt_key(data["api_key"])

    # 处理 stop_sequences JSON 序列化
    if "stop_sequences" in data and data["stop_sequences"] is not None:
        data["stop_sequences"] = json.dumps(data["stop_sequences"])

    for key, value in data.items():
        setattr(cfg, key, value)

    await db.commit()
    await db.refresh(cfg)
    return _attach_masked_key(cfg)


@router.delete("/{config_id}")
async def delete_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    cfg = await _get_user_config(config_id, user.id, db)
    await db.delete(cfg)
    await db.commit()
    return {"message": f"模型配置 '{cfg.name}' 已成功删除"}


# ---------- 连接测试 & 模型列表（Phase 6 Provider Adapter 后实现） ----------


@router.post("/test-connection")
async def test_connection(
    user: User = Depends(require_active_user),
):
    """测试模型连接（待 Phase 6 Provider Adapter 实现）"""
    raise NotFoundError("此功能将在 Provider Adapter 完成后启用")


@router.post("/{config_id}/test")
async def test_saved_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """测试已保存配置的连接（待 Phase 6 Provider Adapter 实现）"""
    _ = await _get_user_config(config_id, user.id, db)
    raise NotFoundError("此功能将在 Provider Adapter 完成后启用")


@router.post("/list-models")
async def list_available_models(
    user: User = Depends(require_active_user),
):
    """获取可用模型列表（待 Phase 6 Provider Adapter 实现）"""
    raise NotFoundError("此功能将在 Provider Adapter 完成后启用")


@router.post("/{config_id}/list-models")
async def list_models_by_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """使用已保存配置获取模型列表（待 Phase 6 Provider Adapter 实现）"""
    _ = await _get_user_config(config_id, user.id, db)
    raise NotFoundError("此功能将在 Provider Adapter 完成后启用")
