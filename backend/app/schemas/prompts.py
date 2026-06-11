"""提示词模板 Schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., max_length=50)
    template: str = Field(..., min_length=1)
    description: Optional[str] = None
    variables: Optional[str] = Field(None, description="JSON格式的变量定义")
    tags: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=50)
    template: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    variables: Optional[str] = None
    tags: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    category: str
    template: str
    description: Optional[str] = None
    variables: Optional[str] = None
    tags: Optional[str] = None
    is_active: bool
    user_id: Optional[int] = None
    is_system: bool = False
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
