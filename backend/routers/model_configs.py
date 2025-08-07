"""
AI模型配置相关的API路由
"""
import base64
import json
import aiohttp
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
    
    # 处理API密钥加密
    if 'api_key' in update_data and update_data['api_key'] is not None:
        update_data['api_key'] = pseudo_encrypt(update_data['api_key'])
    
    # 处理停止序列的JSON序列化
    if 'stop_sequences' in update_data and update_data['stop_sequences'] is not None:
        update_data['stop_sequences'] = json.dumps(update_data['stop_sequences'])

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

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_model_connection(
    test_data: TestConnectionRequest,
    current_user: User = Depends(get_current_user_dependency)
):
    """测试模型配置连接"""
    try:
        # 根据模型类型选择测试方法
        if test_data.model_type.lower() == "openai":
            return await test_openai_connection(test_data)
        elif test_data.model_type.lower() == "claude":
            return await test_claude_connection(test_data)
        else:
            return TestConnectionResponse(
                success=False,
                message=f"不支持的模型类型: {test_data.model_type}"
            )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"连接测试失败: {str(e)}"
        )

async def test_openai_connection(test_data: TestConnectionRequest) -> TestConnectionResponse:
    """测试OpenAI连接"""
    api_url = test_data.api_url or "https://api.openai.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {test_data.api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": test_data.model_name or "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello, this is a test message."}],
        "max_tokens": 10,
        "temperature": 0.7
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=10) as response:
                if response.status == 200:
                    result = await response.json()
                    return TestConnectionResponse(
                        success=True,
                        message="OpenAI连接测试成功",
                        details={
                            "model": result.get("model", "unknown"),
                            "usage": result.get("usage", {})
                        }
                    )
                else:
                    error_text = await response.text()
                    return TestConnectionResponse(
                        success=False,
                        message=f"OpenAI API错误 (状态码: {response.status})",
                        details={"error": error_text}
                    )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"OpenAI连接异常: {str(e)}"
        )

async def test_claude_connection(test_data: TestConnectionRequest) -> TestConnectionResponse:
    """测试Claude连接"""
    api_url = test_data.api_url or "https://api.anthropic.com/v1/messages"
    
    headers = {
        "x-api-key": test_data.api_key,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    
    payload = {
        "model": test_data.model_name or "claude-3-sonnet-20240229",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "Hello, this is a test message."}]
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=10) as response:
                if response.status == 200:
                    result = await response.json()
                    return TestConnectionResponse(
                        success=True,
                        message="Claude连接测试成功",
                        details={
                            "model": result.get("model", "unknown"),
                            "usage": result.get("usage", {})
                        }
                    )
                else:
                    error_text = await response.text()
                    return TestConnectionResponse(
                        success=False,
                        message=f"Claude API错误 (状态码: {response.status})",
                        details={"error": error_text}
                    )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Claude连接异常: {str(e)}"
        )
