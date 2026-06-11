"""AI API Schemas"""

import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# ---------- 通用 Run 请求 / 响应 ----------


class CreateRunRequest(BaseModel):
    """通用创建 Run 请求"""

    workflow_type: str
    project_id: int
    model_config_id: int
    input_data: dict | None = None


class RunResponse(BaseModel):
    """Run 状态响应"""

    id: int
    session_id: int
    workflow_type: str
    status: str
    input_data: dict | None = None
    output_data: dict | None = None
    error_message: str | None = None
    tokens_used: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime | None = None

    @field_validator("input_data", "output_data", mode="before")
    @classmethod
    def parse_json_field(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return None
        return v

    model_config = {"from_attributes": True}


class RunListResponse(BaseModel):
    items: list[RunResponse]
    total: int


# ---------- Event 响应 ----------


class EventResponse(BaseModel):
    id: int
    run_id: int
    event_type: str
    node_name: str | None = None
    data: dict | None = None
    sequence: int
    created_at: datetime | None = None

    @field_validator("data", mode="before")
    @classmethod
    def parse_data(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return None
        return v

    model_config = {"from_attributes": True}


# ---------- Session 响应 ----------


class SessionResponse(BaseModel):
    id: int
    workflow_id: int
    thread_id: str
    messages_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Artifact 响应 ----------


class ArtifactResponse(BaseModel):
    id: int
    content_type: str
    project_id: int
    chapter_id: int | None = None
    workflow_id: int | None = None
    session_id: int | None = None
    run_id: int | None = None
    title: str | None = None
    content: str
    word_count: int = 0
    tokens_used: int = 0
    quality_score: float | None = None
    is_approved: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- 章节大纲（专用） ----------


class ChapterOutlineRequest(BaseModel):
    project_id: int
    chapter_number: int = Field(..., ge=1)
    model_config_id: int
    user_requirements: str | None = None


class ChapterOutlineResponse(BaseModel):
    run_id: int
    status: str
    outline: dict | None = None
    raw_output: str | None = None
