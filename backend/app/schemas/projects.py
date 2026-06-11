"""项目 Schemas"""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime
    word_count: int = 0
    chapter_count: int = 0

    model_config = {"from_attributes": True}
