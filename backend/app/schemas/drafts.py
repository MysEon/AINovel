"""草稿 Schemas"""

from datetime import datetime

from pydantic import BaseModel, Field


class DraftCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str | None = None
    tags: str | None = None


class DraftUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = None
    tags: str | None = None


class DraftResponse(BaseModel):
    id: int
    project_id: int
    title: str
    content: str | None = None
    tags: str | None = None
    word_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
