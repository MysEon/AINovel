"""章节 Schemas"""

from datetime import datetime

from pydantic import BaseModel, Field


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str | None = Field(None, max_length=1000000)
    outline: str | None = Field(None, max_length=50000)
    order_index: int | None = 0
    status: str = Field("draft", pattern="^(draft|published)$")
    project_id: int | None = None


class ChapterUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = Field(None, max_length=1000000)
    outline: str | None = Field(None, max_length=50000)
    order_index: int | None = None
    status: str | None = Field(None, pattern="^(draft|published)$")


class ChapterResponse(BaseModel):
    id: int
    project_id: int
    title: str
    content: str | None = None
    outline: str | None = None
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
    chapter_ids: list[int]
    project_id: int


class BatchPublishResponse(BaseModel):
    success: bool
    published_chapters: list[dict]
    failed_chapters: list[dict]
    total_count: int
    success_count: int
