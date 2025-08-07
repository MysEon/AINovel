"""
知识库路由模块
包含角色、世界观、场景、创作技巧四个知识库模块的API接口
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models import User, Project, Character, Location, Worldview
from .auth import get_current_user_dependency

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# === 角色知识库 schemas ===

class CharacterRelation(BaseModel):
    related_character_id: int
    relation_type: str
    description: str

class CharacterKnowledgeBase(BaseModel):
    id: int
    name: str
    description: str
    personality: str
    background: str
    appearance: str
    dialogue_style: str
    story_involvement: str
    relations: List[CharacterRelation] = []
    
    class Config:
        from_attributes = True

# === 世界观知识库 schemas ===

class WorldRule(BaseModel):
    rule_name: str
    rule_description: str
    rule_category: str

class WorldviewKnowledgeBase(BaseModel):
    id: int
    name: str
    description: str
    rules: List[WorldRule] = []
    magic_system: str
    technology_level: str
    timeline_events: List[str] = []
    consistency_checks: List[str] = []
    
    class Config:
        from_attributes = True

# === 场景知识库 schemas ===

class SceneTag(BaseModel):
    tag_name: str
    tag_type: str  # atmosphere, emotion, theme

class SceneKnowledgeBase(BaseModel):
    id: int
    name: str
    description: str
    geography: str
    culture: str
    atmosphere_tags: List[SceneTag] = []
    related_characters: List[int] = []
    usage_count: int = 0
    scene_templates: List[str] = []
    
    class Config:
        from_attributes = True

# === 创作技巧知识库 schemas ===

class WritingTechnique(BaseModel):
    technique_name: str
    category: str  # plot, character, dialogue, description
    description: str
    examples: List[str] = []
    templates: List[str] = []

class WritingTechniqueKnowledgeBase(BaseModel):
    id: int
    name: str
    category: str
    techniques: List[WritingTechnique] = []
    inspiration_notes: List[str] = []
    case_studies: List[str] = []
    
    class Config:
        from_attributes = True

# === 角色知识库 API ===

@router.get("/characters/{project_id}", response_model=List[CharacterKnowledgeBase])
async def get_character_knowledge_base(
    project_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db)
):
    """获取项目的角色知识库"""
    result = await db.execute(select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    ))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    result = await db.execute(select(Character).where(Character.project_id == project_id))
    characters = result.scalars().all()
    return [CharacterKnowledgeBase.from_orm(char) for char in characters]

@router.post("/characters/{project_id}/{character_id}/relations")
async def add_character_relation(
    project_id: int,
    character_id: int,
    relation: CharacterRelation,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db)
):
    """添加角色关系"""
    # TODO: 实现角色关系存储逻辑
    return {"message": "角色关系添加成功"}

# === 世界观知识库 API ===

@router.get("/worldviews/{project_id}", response_model=List[WorldviewKnowledgeBase])
async def get_worldview_knowledge_base(
    project_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db)
):
    """获取项目的世界观知识库"""
    result = await db.execute(select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    ))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    result = await db.execute(select(Worldview).where(Worldview.project_id == project_id))
    worldviews = result.scalars().all()
    return [WorldviewKnowledgeBase.from_orm(worldview) for worldview in worldviews]

# === 场景知识库 API ===

@router.get("/scenes/{project_id}", response_model=List[SceneKnowledgeBase])
async def get_scene_knowledge_base(
    project_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db)
):
    """获取项目的场景知识库"""
    result = await db.execute(select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    ))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    result = await db.execute(select(Location).where(Location.project_id == project_id))
    locations = result.scalars().all()
    return [SceneKnowledgeBase.from_orm(location) for location in locations]

# === 创作技巧知识库 API ===

@router.get("/techniques/{category}", response_model=List[WritingTechniqueKnowledgeBase])
async def get_writing_techniques(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user_dependency)
):
    """获取创作技巧知识库"""
    # TODO: 实现创作技巧数据库查询
    techniques = [
        WritingTechniqueKnowledgeBase(
            id=1,
            name="情节设计技巧",
            category="plot",
            techniques=[
                WritingTechnique(
                    technique_name="三幕式结构",
                    category="plot",
                    description="经典的故事结构，包含铺垫、发展、高潮三个部分",
                    examples=["开端-发展-高潮", "起因-经过-结果"],
                    templates=["第一幕：介绍角色和背景\n第二幕：冲突和发展\n第三幕：高潮和解决"]
                )
            ],
            inspiration_notes=["注意情节的起承转合", "保持悬念和冲突"],
            case_studies=["《哈利波特》系列的情节结构"]
        )
    ]
    return techniques