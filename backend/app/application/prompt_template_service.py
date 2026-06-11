"""提示词模板 Application Service

职责：
- CRUD + 访问规则（系统模板不可变）
- copy、usage tracking、template rendering
- 系统模板初始化
"""

import json

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.infrastructure.db.models.prompts import PromptTemplate
from app.infrastructure.db.repositories.base import BaseRepository
from app.schemas.prompts import PromptTemplateCreate, PromptTemplateUpdate


class PromptTemplateRepository(BaseRepository[PromptTemplate]):
    model = PromptTemplate


class PromptTemplateService:
    """提示词模板业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PromptTemplateRepository(db)

    async def _get_template_with_access(self, template_id: int, user_id: int) -> PromptTemplate:
        """获取模板并校验访问权限"""
        result = await self.db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
        tpl = result.scalar_one_or_none()
        if not tpl:
            raise NotFoundError("提示词模板不存在")
        if not tpl.is_system and tpl.user_id != user_id:
            raise ForbiddenError("无权访问此模板")
        return tpl

    async def list_templates(
        self,
        user_id: int,
        *,
        category: str | None = None,
        search: str | None = None,
        include_system: bool = True,
        only_active: bool = True,
    ) -> list[PromptTemplate]:
        """列出提示词模板（支持筛选）"""
        conditions = []
        if include_system:
            conditions.append(or_(PromptTemplate.is_system == True, PromptTemplate.user_id == user_id))
        else:
            conditions.append(PromptTemplate.user_id == user_id)
        if category:
            conditions.append(PromptTemplate.category == category)
        if only_active:
            conditions.append(PromptTemplate.is_active == True)
        if search:
            conditions.append(
                or_(
                    PromptTemplate.name.ilike(f"%{search}%"),
                    PromptTemplate.description.ilike(f"%{search}%"),
                    PromptTemplate.tags.ilike(f"%{search}%"),
                )
            )

        stmt = (
            select(PromptTemplate)
            .where(and_(*conditions))
            .order_by(PromptTemplate.is_system.desc(), PromptTemplate.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_template(self, body: PromptTemplateCreate, user_id: int) -> PromptTemplate:
        """创建提示词模板"""
        tpl = PromptTemplate(
            **body.model_dump(),
            user_id=user_id,
            is_system=False,
            usage_count=0,
        )
        await self.repo.create(tpl)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def get_template(self, template_id: int, user_id: int) -> PromptTemplate:
        """获取单个提示词模板"""
        return await self._get_template_with_access(template_id, user_id)

    async def update_template(self, template_id: int, user_id: int, body: PromptTemplateUpdate) -> PromptTemplate:
        """更新提示词模板（系统模板不可修改）"""
        tpl = await self._get_template_with_access(template_id, user_id)
        if tpl.is_system:
            raise ForbiddenError("系统模板不允许修改，请复制后编辑")
        if tpl.user_id != user_id:
            raise ForbiddenError("只能修改自己创建的模板")

        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(tpl, key, value)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def delete_template(self, template_id: int, user_id: int) -> dict:
        """删除提示词模板（系统模板不可删除）"""
        tpl = await self._get_template_with_access(template_id, user_id)
        if tpl.is_system:
            raise ForbiddenError("系统模板不允许删除")
        if tpl.user_id != user_id:
            raise ForbiddenError("只能删除自己创建的模板")

        await self.db.delete(tpl)
        await self.db.commit()
        return {"message": f"提示词模板 '{tpl.name}' 已成功删除"}

    async def copy_template(self, template_id: int, user_id: int) -> PromptTemplate:
        """复制提示词模板"""
        original = await self._get_template_with_access(template_id, user_id)
        copy = PromptTemplate(
            name=f"{original.name} (副本)",
            category=original.category,
            template=original.template,
            description=original.description,
            variables=original.variables,
            tags=original.tags,
            user_id=user_id,
            is_system=False,
            is_active=True,
            usage_count=0,
        )
        self.db.add(copy)
        await self.db.commit()
        await self.db.refresh(copy)
        return copy

    async def record_usage(self, template_id: int, user_id: int) -> dict:
        """记录模板使用次数"""
        tpl = await self._get_template_with_access(template_id, user_id)
        tpl.usage_count += 1
        await self.db.commit()
        return {"message": "已记录使用", "usage_count": tpl.usage_count}

    async def initialize_system_templates(self) -> dict:
        """初始化系统默认模板（从种子数据加载）"""
        result = await self.db.execute(select(PromptTemplate).where(PromptTemplate.is_system == True))
        existing = result.scalars().all()
        if existing:
            return {"message": "系统模板已存在，无需重复初始化", "count": len(existing)}

        from app.domain.prompts.seed import get_system_templates

        templates = get_system_templates()
        for data in templates:
            data["user_id"] = None
            self.db.add(PromptTemplate(**data))

        await self.db.commit()
        return {"message": f"已初始化 {len(templates)} 个系统模板", "count": len(templates)}

    async def preview_template(self, template_id: int, user_id: int, variables: str | None) -> dict:
        """预览模板渲染结果"""
        tpl = await self._get_template_with_access(template_id, user_id)

        var_dict = {}
        if variables:
            try:
                var_dict = json.loads(variables)
            except json.JSONDecodeError:
                raise ValidationError("变量格式错误，需要合法 JSON")

        rendered = tpl.template
        for key, value in var_dict.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", str(value))

        template_vars = []
        if tpl.variables:
            try:
                template_vars = json.loads(tpl.variables)
            except json.JSONDecodeError:
                pass

        return {
            "template": tpl.template,
            "variables": tpl.variables,
            "rendered": rendered,
            "missing_variables": [v for v in template_vars if v not in var_dict],
        }
