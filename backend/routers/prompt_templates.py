"""
提示词模板相关的API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from typing import List, Optional
import json

from database import get_db
from models import User, PromptTemplate
from schemas import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse, MessageResponse
from .auth import get_current_user_dependency

router = APIRouter(
    prefix="/api/prompt-templates",
    tags=["AI辅助：提示词模板"],
    dependencies=[Depends(get_current_user_dependency)]
)

# 获取系统默认模板数据
def get_system_templates():
    """获取系统预设的默认模板"""
    return [
        {
            "name": "章节大纲生成",
            "category": "outline",
            "template": """基于以下信息生成详细的章节大纲：

项目信息：{{project_info}}
章节号：第{{chapter_number}}章
用户需求：{{user_requirements}}

请生成包含以下要素的章节大纲：
1. 章节标题建议
2. 主要情节发展
3. 重要角色出场
4. 关键冲突或转折
5. 章节结尾设计

输出格式：结构化的章节大纲，便于后续章节内容写作。""",
            "description": "用于生成小说章节大纲的提示词模板",
            "variables": json.dumps(["project_info", "chapter_number", "user_requirements"]),
            "tags": "大纲,章节,规划",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        },
        {
            "name": "情节发展建议",
            "category": "suggestions", 
            "template": """基于以下当前章节内容，提供情节发展建议：

项目背景：{{project_info}}
当前章节内容：
{{current_chapter_content}}

请提供以下方面的建议：
1. 情节推进方向
2. 角色关系发展
3. 冲突升级建议
4. 悬念设置技巧
5. 下一章节衔接

建议应该符合整体故事逻辑，保持角色一致性。""",
            "description": "为当前章节内容提供情节发展建议",
            "variables": json.dumps(["project_info", "current_chapter_content"]),
            "tags": "建议,情节,发展",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        },
        {
            "name": "内容优化改进",
            "category": "optimization",
            "template": """对以下内容进行{{optimization_type}}优化：

原始内容：
{{content}}

项目背景：{{project_info}}

请从以下角度进行优化：
1. 文字表达和语言流畅性
2. 情节逻辑和连贯性  
3. 人物刻画的生动性
4. 场景描写的画面感
5. 对话的自然度和个性化

输出优化后的内容，保持原有故事核心不变。""",
            "description": "对章节内容进行优化改进",
            "variables": json.dumps(["content", "project_info", "optimization_type"]),
            "tags": "优化,改进,文字",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        },
        {
            "name": "创意灵感生成", 
            "category": "creative",
            "template": """基于以下信息提供创意灵感：

项目背景：{{project_info}}
创意需求：{{prompt}}
创意类别：{{category}}

请生成多个有创意的想法，包括：
1. 新的情节元素或转折
2. 有趣的角色设定或互动
3. 独特的场景或世界观细节
4. 富有张力的冲突设置
5. 引人入胜的细节描写

创意应该新颖有趣，符合项目整体风格和设定。""",
            "description": "生成各种创意灵感和想法",
            "variables": json.dumps(["project_info", "prompt", "category"]),
            "tags": "创意,灵感,想法",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        },
        {
            "name": "AI写作助手对话",
            "category": "chat",
            "template": """你是一个专业的小说写作助手，具有以下特点：

1. 熟悉各种文学体裁和写作技巧
2. 能够提供具体、实用的写作建议  
3. 理解故事结构和人物塑造
4. 擅长情节设计和冲突设置
5. 注重文字表达的艺术性

当前项目信息：{{project_info}}
对话历史：{{history}}

用户说：{{message}}

请以专业、友好的语气回复，提供有价值的写作指导和建议。回复应该具体、可操作，避免空洞的建议。""",
            "description": "AI写作助手的对话提示词模板",
            "variables": json.dumps(["project_info", "history", "message"]),
            "tags": "对话,助手,指导",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        },
        {
            "name": "写作技巧建议",
            "category": "writing_advice", 
            "template": """基于以下内容和上下文，提供专业的写作技巧建议：

内容：{{content}}
项目背景：{{project_info}}
上下文信息：{{context}}

请从以下方面提供建议：
1. 叙述技巧和节奏控制
2. 对话写作和人物声音
3. 场景描写和氛围营造
4. 情感表达和内心刻画
5. 文学手法的运用

建议应该针对具体内容，提供可实施的改进方案。""",
            "description": "提供专业的写作技巧和建议",
            "variables": json.dumps(["content", "project_info", "context"]),
            "tags": "技巧,建议,专业",
            "is_system": True,
            "is_active": True,
            "usage_count": 0
        }
    ]

@router.get("/", response_model=List[PromptTemplateResponse])
async def get_prompt_templates(
    category: Optional[str] = Query(None, description="按分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    include_system: bool = Query(True, description="是否包含系统模板"),
    only_active: bool = Query(True, description="只显示激活的模板"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取提示词模板列表"""
    # 构建查询条件
    conditions = []
    
    if include_system:
        # 包含系统模板或用户自己的模板
        conditions.append(or_(PromptTemplate.is_system == True, PromptTemplate.user_id == current_user.id))
    else:
        # 只显示用户自己的模板
        conditions.append(PromptTemplate.user_id == current_user.id)
    
    if category:
        conditions.append(PromptTemplate.category == category)
        
    if only_active:
        conditions.append(PromptTemplate.is_active == True)
        
    if search:
        conditions.append(or_(
            PromptTemplate.name.ilike(f"%{search}%"),
            PromptTemplate.description.ilike(f"%{search}%"),
            PromptTemplate.tags.ilike(f"%{search}%")
        ))
    
    query = select(PromptTemplate)
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.order_by(PromptTemplate.is_system.desc(), PromptTemplate.created_at.desc())
    
    result = await db.execute(query)
    templates = result.scalars().all()
    return templates

@router.get("/categories")
async def get_categories(current_user: User = Depends(get_current_user_dependency)):
    """获取所有可用的模板分类"""
    return [
        {"value": "outline", "label": "大纲生成"},
        {"value": "suggestions", "label": "情节建议"}, 
        {"value": "optimization", "label": "内容优化"},
        {"value": "creative", "label": "创意生成"},
        {"value": "chat", "label": "AI对话"},
        {"value": "writing_advice", "label": "写作建议"}
    ]

@router.post("/", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    template_data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """为当前用户创建一个新的提示词模板"""
    new_template = PromptTemplate(
        **template_data.model_dump(),
        user_id=current_user.id,
        is_system=False,
        usage_count=0
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template

@router.get("/{template_id}", response_model=PromptTemplateResponse)
async def get_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """获取单个提示词模板的详细信息"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    
    # 检查权限：系统模板所有人可见，用户模板只有创建者可见
    if not template.is_system and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此模板")
    
    return template

@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_prompt_template(
    template_id: int,
    template_data: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """更新提示词模板"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 系统模板不允许修改
    if template.is_system:
        raise HTTPException(status_code=403, detail="系统模板不允许修改，请复制后编辑")
    
    # 检查权限：只有创建者可以修改
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能修改自己创建的模板")
    
    # 更新字段
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
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 系统模板不允许删除
    if template.is_system:
        raise HTTPException(status_code=403, detail="系统模板不允许删除")
    
    # 检查权限：只有创建者可以删除
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己创建的模板")
    
    await db.delete(template)
    await db.commit()
    
    return {"message": f"提示词模板 '{template.name}' 已成功删除"}

@router.post("/{template_id}/copy", response_model=PromptTemplateResponse)
async def copy_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """复制提示词模板（用于基于系统模板创建个人模板）"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 检查权限：系统模板所有人可复制，用户模板只有创建者可复制
    if not original.is_system and original.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权复制此模板")
    
    # 创建副本
    new_template = PromptTemplate(
        name=f"{original.name} (副本)",
        category=original.category,
        template=original.template,
        description=original.description,
        variables=original.variables,
        tags=original.tags,
        user_id=current_user.id,
        is_system=False,
        is_active=True,
        usage_count=0
    )
    
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template

@router.post("/{template_id}/use")
async def use_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """记录模板使用（增加使用次数）"""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 检查权限
    if not template.is_system and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权使用此模板")
    
    # 增加使用次数
    template.usage_count += 1
    await db.commit()
    
    return {"message": "已记录使用", "usage_count": template.usage_count}

@router.post("/initialize-system-templates")
async def initialize_system_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """初始化系统默认模板"""
    # 检查是否已经初始化
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.is_system == True)
    )
    existing_templates = result.scalars().all()
    
    if len(existing_templates) > 0:
        return {"message": "系统模板已存在，无需重复初始化", "count": len(existing_templates)}
    
    # 创建系统模板
    system_templates = get_system_templates()
    created_count = 0
    
    for template_data in system_templates:
        # 系统模板不需要user_id，设置为None
        template_data['user_id'] = None
        template = PromptTemplate(**template_data)
        db.add(template)
        created_count += 1
    
    await db.commit()
    return {"message": f"已初始化 {created_count} 个系统模板", "count": created_count}

@router.get("/{template_id}/preview")
async def preview_template(
    template_id: int,
    variables: Optional[str] = Query(None, description="JSON格式的变量值"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """预览模板渲染结果"""
    template = await get_prompt_template(template_id, db, current_user)
    
    # 解析变量
    var_dict = {}
    if variables:
        try:
            var_dict = json.loads(variables)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="变量格式错误")
    
    # 简单的模板变量替换
    rendered = template.template
    for key, value in var_dict.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
    
    # 获取模板定义的变量
    template_vars = []
    if template.variables:
        try:
            template_vars = json.loads(template.variables)
        except json.JSONDecodeError:
            template_vars = []
    
    return {
        "template": template.template,
        "variables": template.variables,
        "rendered": rendered,
        "missing_variables": [var for var in template_vars if var not in var_dict]
    }
