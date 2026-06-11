"""提示词模板 Schemas"""

from datetime import datetime

from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., max_length=50)
    template: str = Field(..., min_length=1)
    description: str | None = None
    variables: str | None = Field(None, description="JSON格式的变量定义")
    tags: str | None = Field(None, max_length=500)
    is_active: bool = True


class PromptTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    category: str | None = Field(None, max_length=50)
    template: str | None = Field(None, min_length=1)
    description: str | None = None
    variables: str | None = None
    tags: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    category: str
    template: str
    description: str | None = None
    variables: str | None = None
    tags: str | None = None
    is_active: bool
    user_id: int | None = None
    is_system: bool = False
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
