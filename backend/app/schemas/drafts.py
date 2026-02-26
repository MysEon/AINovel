"""草稿 Schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DraftCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    tags: Optional[str] = None


class DraftUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    tags: Optional[str] = None


class DraftResponse(BaseModel):
    id: int
    project_id: int
    title: str
    content: Optional[str] = None
    tags: Optional[str] = None
    word_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
