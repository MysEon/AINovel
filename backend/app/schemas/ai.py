"""AI API Schemas"""

import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------- 通用 Run 请求 / 响应 ----------

class CreateRunRequest(BaseModel):
    """通用创建 Run 请求"""
    workflow_type: str
    project_id: int
    model_config_id: int
    input_data: Optional[dict] = None


class RunResponse(BaseModel):
    """Run 状态响应"""
    id: int
    session_id: int
    workflow_type: str
    status: str
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: Optional[str] = None
    tokens_used: int = 0
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

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
    node_name: Optional[str] = None
    data: Optional[dict] = None
    sequence: int
    created_at: Optional[datetime] = None

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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------- Artifact 响应 ----------

class ArtifactResponse(BaseModel):
    id: int
    content_type: str
    project_id: int
    chapter_id: Optional[int] = None
    workflow_id: Optional[int] = None
    session_id: Optional[int] = None
    run_id: Optional[int] = None
    title: Optional[str] = None
    content: str
    word_count: int = 0
    tokens_used: int = 0
    quality_score: Optional[float] = None
    is_approved: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------- 章节大纲（专用） ----------

class ChapterOutlineRequest(BaseModel):
    project_id: int
    chapter_number: int = Field(..., ge=1)
    model_config_id: int
    user_requirements: Optional[str] = None


class ChapterOutlineResponse(BaseModel):
    run_id: int
    status: str
    outline: Optional[dict] = None
    raw_output: Optional[str] = None
