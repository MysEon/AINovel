"""
AI模型配置相关的API路由
"""
import base64
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from database import get_db
from models import User, ModelConfig
from schemas import (
    ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse, MessageResponse,
    TestConnectionRequest, TestConnectionResponse
)
from .auth import get_current_user_dependency

# 尝试导入LangChain服务（如果可用）
try:
    from langchain_service import LangChainService
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

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

def mask_api_key(api_key: str) -> str:
    """遮蔽API密钥，只显示前4位和后4位"""
    if not api_key or len(api_key) <= 8:
        return '*' * len(api_key) if api_key else ''
    return api_key[:4] + '*' * (len(api_key) - 8) + api_key[-4:]


@router.post("/", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model_config(
    config_data: ModelConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """为当前用户创建一个新的AI模型配置"""
    encrypted_key = None
    masked_key = None
    if config_data.api_key:
        encrypted_key = pseudo_encrypt(config_data.api_key)
        masked_key = mask_api_key(config_data.api_key)
    
    # 处理停止序列的JSON序列化
    stop_sequences_json = None
    if config_data.stop_sequences:
        stop_sequences_json = json.dumps(config_data.stop_sequences)

    new_config = ModelConfig(
        **config_data.model_dump(exclude={"api_key", "stop_sequences"}),
        api_key=encrypted_key,
        stop_sequences=stop_sequences_json,
        user_id=current_user.id
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    
    # 添加遮蔽的API密钥到响应
    new_config.api_key_masked = masked_key
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
    
    # 为每个配置添加遮蔽的API密钥
    for config in configs:
        if config.api_key:
            decrypted_key = pseudo_decrypt(config.api_key)
            config.api_key_masked = mask_api_key(decrypted_key)
        else:
            config.api_key_masked = None
    
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
    
    # 添加遮蔽的API密钥到响应
    if config.api_key:
        decrypted_key = pseudo_decrypt(config.api_key)
        config.api_key_masked = mask_api_key(decrypted_key)
    else:
        config.api_key_masked = None
    
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
    
    # 处理API密钥加密
    masked_key = None
    if 'api_key' in update_data and update_data['api_key'] is not None:
        update_data['api_key'] = pseudo_encrypt(update_data['api_key'])
        masked_key = mask_api_key(update_data['api_key'])
    
    # 处理停止序列的JSON序列化
    if 'stop_sequences' in update_data and update_data['stop_sequences'] is not None:
        update_data['stop_sequences'] = json.dumps(update_data['stop_sequences'])

    for key, value in update_data.items():
        setattr(config, key, value)
        
    await db.commit()
    await db.refresh(config)
    
    # 添加遮蔽的API密钥到响应
    if 'api_key' in update_data and update_data['api_key'] is not None:
        config.api_key_masked = masked_key
    elif config.api_key:
        decrypted_key = pseudo_decrypt(config.api_key)
        config.api_key_masked = mask_api_key(decrypted_key)
    else:
        config.api_key_masked = None
    
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

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_model_connection(
    test_data: TestConnectionRequest,
    current_user: User = Depends(get_current_user_dependency)
):
    """测试模型配置连接"""
    if not LANGCHAIN_AVAILABLE:
        return TestConnectionResponse(
            success=False,
            message="LangChain服务不可用，请安装相关依赖"
        )
    
    try:
        # 使用LangChain服务统一管理模型连接测试
        langchain_service = LangChainService()
        
        # 创建临时配置对象进行测试
        class TempConfig:
            def __init__(self, test_data):
                self.model_type = test_data.model_type
                self.model_name = test_data.model_name
                self.api_key = test_data.api_key
                self.api_url = test_data.api_url
                self.temperature = test_data.temperature or 0.7
                self.max_tokens = test_data.max_tokens or 100
                self.id = "test"
        
        temp_config = TempConfig(test_data)
        
        # 尝试初始化模型
        model = langchain_service._get_model(temp_config)
        
        if model:
            return TestConnectionResponse(
                success=True,
                message=f"{test_data.model_type} 模型连接测试成功",
                details={
                    "model": test_data.model_name or "default",
                    "provider": test_data.model_type
                }
            )
        else:
            return TestConnectionResponse(
                success=False,
                message=f"无法初始化 {test_data.model_type} 模型"
            )
            
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"连接测试失败: {str(e)}"
        )

# 注意：所有直接的HTTP连接测试已移除，现在统一使用LangChain服务管理
# 这样确保所有AI功能都通过LangChain/LangGraph框架统一管理
