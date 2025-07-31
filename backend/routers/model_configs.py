"""
AI模型配置相关的API路由
"""
import base64
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, ModelConfig
from schemas import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    prefix="/api/model-configs",
    tags=["AI辅助：模型配置"],
    dependencies=[Depends(get_current_user_dependency)]
)

# 简单的伪加密，实际生产应使用更安全的库
def pseudo_encrypt(key: str) -> str:
    return base64.b64encode(key.encode()).decode()

def pseudo_decrypt(encrypted_key: str) -> str:
    return base64.b64decode(encrypted_key.encode()).decode()


@router.post("/", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model_config(
    config_data: ModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """为当前用户创建一个新的AI模型配置"""
    encrypted_key = None
    if config_data.api_key:
        encrypted_key = pseudo_encrypt(config_data.api_key)

    new_config = ModelConfig(
        **config_data.model_dump(exclude={"api_key"}),
        api_key=encrypted_key,
        user_id=current_user.id
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    return new_config

@router.get("/", response_model=List[ModelConfigResponse])
async def get_user_model_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取当前用户的所有AI模型配置"""
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.user_id == current_user.id).order_by(ModelConfig.name)
    )
    configs = result.scalars().all()
    return configs

@router.get("/{config_id}", response_model=ModelConfigResponse)
async def get_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个AI模型配置的详细信息"""
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.id == config_id, ModelConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="模型配置不存在或无权访问")
    return config

@router.put("/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: int,
    config_data: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新AI模型配置"""
    config = await get_model_config(config_id, db, current_user)
    
    update_data = config_data.model_dump(exclude_unset=True)
    
    if 'api_key' in update_data and update_data['api_key'] is not None:
        update_data['api_key'] = pseudo_encrypt(update_data['api_key'])

    for key, value in update_data.items():
        setattr(config, key, value)
        
    await db.commit()
    await db.refresh(config)
    return config

@router.delete("/{config_id}", response_model=MessageResponse)
async def delete_model_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个AI模型配置"""
    config = await get_model_config(config_id, db, current_user)
    
    await db.delete(config)
    await db.commit()
    
    return {"message": f"模型配置 '{config.name}' 已成功删除"}
