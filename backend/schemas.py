"""
Pydantic模型定义
用于API请求和响应的数据验证
"""

from pydantic import BaseModel, EmailStr, Field, computed_field
from typing import Optional, List
from datetime import datetime

# 用户相关模型
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=50)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    avatar_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None

# 认证相关模型
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseModel):
    username: Optional[str] = None

# 项目相关模型
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class ProjectResponse(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
    
    # 计算字段
    @computed_field
    @property
    def word_count(self) -> int:
        # 这里应该计算项目总字数，简化处理返回0
        return 0
    
    @computed_field
    @property
    def chapter_count(self) -> int:
        # 这里应该计算章节数量，简化处理返回0
        return 0

# 角色相关模型
class CharacterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None

class CharacterCreate(CharacterBase):
    project_id: int

class CharacterUpdate(CharacterBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class CharacterResponse(CharacterBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 地点相关模型
class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    geography: Optional[str] = None
    culture: Optional[str] = None
    history: Optional[str] = None

class LocationCreate(LocationBase):
    project_id: int

class LocationUpdate(LocationBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class LocationResponse(LocationBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 组织相关模型
class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    structure: Optional[str] = None
    purpose: Optional[str] = None
    influence: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    project_id: int

class OrganizationUpdate(OrganizationBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class OrganizationResponse(OrganizationBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 世界观相关模型
class WorldviewBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    rules: Optional[str] = None
    magic_system: Optional[str] = None
    technology: Optional[str] = None
    timeline: Optional[str] = None

class WorldviewCreate(WorldviewBase):
    project_id: int

class WorldviewUpdate(WorldviewBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class WorldviewResponse(WorldviewBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 章节相关模型
class ChapterBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    outline: Optional[str] = None
    order_index: Optional[int] = 0

class ChapterCreate(ChapterBase):
    project_id: int

class ChapterUpdate(ChapterBase):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    status: Optional[str] = Field(None, pattern="^(draft|published)$")

class ChapterResponse(ChapterBase):
    id: int
    project_id: int
    word_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 草稿相关模型
class DraftBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    tags: Optional[str] = None

class DraftCreate(DraftBase):
    project_id: int

class DraftUpdate(DraftBase):
    title: Optional[str] = Field(None, min_length=1, max_length=200)

class DraftResponse(DraftBase):
    id: int
    project_id: int
    word_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 通用响应模型
class MessageResponse(BaseModel):
    message: str
    
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

# AI模型配置相关模型
class ModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_type: str = Field(..., min_length=1, max_length=50, description="例如: openai, claude")
    model_name: Optional[str] = Field(None, max_length=100, description="例如: gpt-4, claude-3-opus")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(2000, gt=0)

class ModelConfigCreate(ModelConfigBase):
    api_key: Optional[str] = Field(None, min_length=1, max_length=500, description="API密钥将加密存储")

class ModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    model_type: Optional[str] = Field(None, min_length=1, max_length=50)
    model_name: Optional[str] = Field(None, max_length=100)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)

class ModelConfigResponse(ModelConfigBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 提示词模板相关模型
class PromptTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=50, description="例如: 角色, 情节, 对话")
    template: str = Field(..., min_length=1)
    description: Optional[str] = None

class PromptTemplateCreate(PromptTemplateBase):
    pass

class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=50)
    template: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None

class PromptTemplateResponse(PromptTemplateBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True