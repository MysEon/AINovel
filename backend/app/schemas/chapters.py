"""章节 Schemas"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = Field(None, max_length=1000000)
    outline: Optional[str] = Field(None, max_length=50000)
    order_index: Optional[int] = 0
    status: str = Field("draft", pattern="^(draft|published)$")
    project_id: Optional[int] = None


class ChapterUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, max_length=1000000)
    outline: Optional[str] = Field(None, max_length=50000)
    order_index: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(draft|published)$")


class ChapterResponse(BaseModel):
    id: int
    project_id: int
    title: str
    content: Optional[str] = None
    outline: Optional[str] = None
    chapter_number: int
    order_index: int = 0
    word_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChapterBatchUpdate(BaseModel):
    project_id: int
    from_order_index: int
    new_status: str


class BatchPublishRequest(BaseModel):
    chapter_ids: List[int]
    project_id: int


class BatchPublishResponse(BaseModel):
    success: bool
    published_chapters: List[dict]
    failed_chapters: List[dict]
    total_count: int
    success_count: int
