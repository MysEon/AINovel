"""模型配置管理 API v1"""

import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.core.exceptions import NotFoundError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.repositories.base import BaseRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.secrets import get_encryption_service
from app.schemas.model_configs import (
    ListModelsRequest,
    ModelConfigCreate,
    ModelConfigResponse,
    ModelConfigUpdate,
    ModelInfoResponse,
    TestConnectionRequest,
    TestConnectionResponse,
)

router = APIRouter(prefix="/api/v1/model-configs", tags=["AI辅助：模型配置"])


class ModelConfigRepository(BaseRepository[ModelConfig]):
    model = ModelConfig


# ---------- API Key 工具函数 ----------
_encryption_service = get_encryption_service()


def _encrypt_key(key: str) -> str:
    return _encryption_service.encrypt(key)


def _decrypt_key(encrypted: str) -> str:
    return _encryption_service.decrypt(encrypted)


def _mask_key(api_key: str) -> str:
    if not api_key or len(api_key) <= 8:
        return "*" * len(api_key) if api_key else ""
    return api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]


async def _get_user_config(
    config_id: int,
    user_id: int,
    db: AsyncSession,
) -> ModelConfig:
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id,
            ModelConfig.user_id == user_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise NotFoundError("模型配置不存在或无权访问")
    return cfg


def _serialize_stop_sequences(seqs: list | None) -> str | None:
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


@router.get("/", response_model=list[ModelConfigResponse])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    result = await db.execute(select(ModelConfig).where(ModelConfig.user_id == user.id).order_by(ModelConfig.name))
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


# ---------- 连接测试 & 模型列表 ----------


def _build_provider_config(
    api_key: str,
    model_type: str,
    model_name: str | None = None,
    api_url: str | None = None,
    proxy_url: str | None = None,
):
    """从请求参数构建 ProviderConfig"""
    from app.infrastructure.llm.provider_adapters import ProviderConfig

    return ProviderConfig(
        api_key=api_key,
        model_name=model_name or "",
        api_url=api_url,
        proxy_url=proxy_url,
    )


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    body: TestConnectionRequest,
    user: User = Depends(require_active_user),
):
    """测试模型连接"""
    from app.infrastructure.llm.provider_adapters import get_provider

    try:
        provider = get_provider(body.model_type)
        cfg = _build_provider_config(
            body.api_key,
            body.model_type,
            body.model_name,
            body.api_url,
            body.proxy_url,
        )
        await provider.test_connection(cfg)
        return TestConnectionResponse(
            success=True,
            message=f"{body.model_type} 模型连接测试成功",
            details={"model": body.model_name or "default", "provider": body.model_type},
        )
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"连接测试失败: {e}")


@router.post("/{config_id}/test", response_model=TestConnectionResponse)
async def test_saved_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """测试已保存配置的连接"""
    from app.infrastructure.llm.provider_adapters import get_provider

    cfg = await _get_user_config(config_id, user.id, db)
    if not cfg.api_key:
        return TestConnectionResponse(success=False, message="该配置没有保存 API 密钥")

    try:
        provider = get_provider(cfg.model_type)
        pcfg = _build_provider_config(
            _decrypt_key(cfg.api_key),
            cfg.model_type,
            cfg.model_name,
            cfg.api_url,
            cfg.proxy_url if cfg.enable_proxy else None,
        )
        await provider.test_connection(pcfg)
        return TestConnectionResponse(
            success=True,
            message=f"{cfg.model_type} 模型连接测试成功",
            details={"model": cfg.model_name or "default", "provider": cfg.model_type},
        )
    except Exception as e:
        return TestConnectionResponse(success=False, message=f"连接测试失败: {e}")


@router.post("/list-models", response_model=list[ModelInfoResponse])
async def list_available_models(
    body: ListModelsRequest,
    user: User = Depends(require_active_user),
):
    """获取可用模型列表"""
    from app.infrastructure.llm.provider_adapters import get_provider

    provider = get_provider(body.model_type)
    cfg = _build_provider_config(
        body.api_key,
        body.model_type,
        api_url=body.api_url,
        proxy_url=body.proxy_url,
    )
    models = await provider.list_models(cfg)
    return [ModelInfoResponse(value=m.value, label=m.label) for m in models]


@router.post("/{config_id}/list-models", response_model=list[ModelInfoResponse])
async def list_models_by_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    """使用已保存配置获取模型列表"""
    from app.infrastructure.llm.provider_adapters import get_provider

    cfg = await _get_user_config(config_id, user.id, db)
    if not cfg.api_key:
        return []

    provider = get_provider(cfg.model_type)
    pcfg = _build_provider_config(
        _decrypt_key(cfg.api_key),
        cfg.model_type,
        cfg.model_name,
        cfg.api_url,
        cfg.proxy_url if cfg.enable_proxy else None,
    )
    models = await provider.list_models(pcfg)
    return [ModelInfoResponse(value=m.value, label=m.label) for m in models]
