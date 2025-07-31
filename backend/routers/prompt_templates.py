"""
提示词模板相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, PromptTemplate
from schemas import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    prefix="/api/prompt-templates",
    tags=["AI辅助：提示词模板"],
    dependencies=[Depends(get_current_user_dependency)]
)

@router.post("/", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    template_data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """为当前用户创建一个新的提示词模板"""
    new_template = PromptTemplate(
        **template_data.model_dump(),
        user_id=current_user.id
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template

@router.get("/", response_model=List[PromptTemplateResponse])
async def get_user_prompt_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取当前用户的所有提示词模板"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.user_id == current_user.id).order_by(PromptTemplate.name)
    )
    templates = result.scalars().all()
    return templates

@router.get("/{template_id}", response_model=PromptTemplateResponse)
async def get_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个提示词模板的详细信息"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id, PromptTemplate.user_id == current_user.id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在或无权访问")
    return template

@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_prompt_template(
    template_id: int,
    template_data: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新提示词模板"""
    template = await get_prompt_template(template_id, db, current_user)
    
    update_data = template_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)
        
    await db.commit()
    await db.refresh(template)
    return template

@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个提示词模板"""
    template = await get_prompt_template(template_id, db, current_user)
    
    await db.delete(template)
    await db.commit()
    
    return {"message": f"提示词模板 '{template.name}' 已成功删除"}
