"""模型配置管理 API v1"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.model_config_service import ModelConfigService
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
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


@router.post("/", response_model=ModelConfigResponse, status_code=201)
async def create_config(
    body: ModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.create(body, user.id)


@router.get("/", response_model=list[ModelConfigResponse])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.list_configs(user.id)


@router.get("/{config_id}", response_model=ModelConfigResponse)
async def get_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.get_config(config_id, user.id)


@router.put("/{config_id}", response_model=ModelConfigResponse)
async def update_config(
    config_id: int,
    body: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.update_config(config_id, user.id, body)


@router.delete("/{config_id}")
async def delete_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.delete_config(config_id, user.id)


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    body: TestConnectionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.test_connection(body)


@router.post("/{config_id}/test", response_model=TestConnectionResponse)
async def test_saved_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.test_saved_config(config_id, user.id)


@router.post("/list-models", response_model=list[ModelInfoResponse])
async def list_available_models(
    body: ListModelsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.list_available_models(body)


@router.post("/{config_id}/list-models", response_model=list[ModelInfoResponse])
async def list_models_by_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_user),
):
    service = ModelConfigService(db)
    return await service.list_models_by_config(config_id, user.id)
