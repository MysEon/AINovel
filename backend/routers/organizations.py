"""
小说组织相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import User, Project, Organization
from schemas import OrganizationCreate, OrganizationUpdate, OrganizationResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    tags=["小说元素：组织"],
    dependencies=[Depends(get_current_user_dependency)]
)

async def get_project_for_user(project_id: int, db: AsyncSession, user: User) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在或您没有权限访问"
        )
    return project

@router.post("/api/projects/{project_id}/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    project_id: int,
    organization_data: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """在指定项目中创建一个新组织"""
    await get_project_for_user(project_id, db, current_user)
    
    new_organization = Organization(
        **organization_data.model_dump(),
        project_id=project_id
    )
    db.add(new_organization)
    await db.commit()
    await db.refresh(new_organization)
    return new_organization

@router.get("/api/projects/{project_id}/organizations", response_model=List[OrganizationResponse])
async def get_organizations_in_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取指定项目中的所有组织列表"""
    await get_project_for_user(project_id, db, current_user)
    
    result = await db.execute(
        select(Organization).where(Organization.project_id == project_id).order_by(Organization.name)
    )
    organizations = result.scalars().all()
    return organizations

@router.get("/api/organizations/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个组织的详细信息"""
    result = await db.execute(
        select(Organization).join(Project).where(
            Organization.id == organization_id,
            Project.user_id == current_user.id
        )
    )
    organization = result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(status_code=404, detail="组织不存在或无权访问")
    return organization

@router.put("/api/organizations/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: int,
    organization_data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新组织信息"""
    organization = await get_organization(organization_id, db, current_user)
    
    update_data = organization_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(organization, key, value)
        
    await db.commit()
    await db.refresh(organization)
    return organization

@router.delete("/api/organizations/{organization_id}", response_model=MessageResponse)
async def delete_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """删除一个组织"""
    organization = await get_organization(organization_id, db, current_user)
    
    await db.delete(organization)
    await db.commit()
    
    return {"message": f"组织 '{organization.name}' 已成功删除"}
