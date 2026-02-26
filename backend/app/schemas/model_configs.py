"""模型配置 Schemas"""

import json
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ModelConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_type: str = Field(..., min_length=1, max_length=50)
    model_name: Optional[str] = Field(None, max_length=100)
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(2000, gt=0)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    api_url: Optional[str] = Field(None, max_length=500)
    top_p: Optional[float] = Field(1.0, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(40, ge=0, le=100)
    frequency_penalty: Optional[float] = Field(0.0, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(0.0, ge=-2.0, le=2.0)
    stop_sequences: Optional[List[str]] = Field(default_factory=list)
    stream: Optional[bool] = False
    logprobs: Optional[bool] = False
    top_logprobs: Optional[int] = Field(0, ge=0, le=20)
    proxy_url: Optional[str] = Field(None, max_length=500)
    enable_proxy: Optional[bool] = False


class ModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    model_type: Optional[str] = Field(None, min_length=1, max_length=50)
    model_name: Optional[str] = Field(None, max_length=100)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    api_url: Optional[str] = Field(None, max_length=500)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(None, ge=0, le=100)
    frequency_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    stop_sequences: Optional[List[str]] = None
    stream: Optional[bool] = None
    logprobs: Optional[bool] = None
    top_logprobs: Optional[int] = Field(None, ge=0, le=20)
    proxy_url: Optional[str] = Field(None, max_length=500)
    enable_proxy: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    id: int
    name: str
    model_type: str
    model_name: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2000
    api_url: Optional[str] = None
    top_p: Optional[float] = 1.0
    top_k: Optional[int] = 40
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0
    stop_sequences: Optional[List[str]] = Field(default_factory=list)
    stream: Optional[bool] = False
    logprobs: Optional[bool] = False
    top_logprobs: Optional[int] = 0
    proxy_url: Optional[str] = None
    enable_proxy: Optional[bool] = False
    user_id: int
    created_at: datetime
    updated_at: datetime
    api_key_masked: Optional[str] = None

    @field_validator("stop_sequences", mode="before")
    @classmethod
    def parse_stop_sequences(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v or []

    model_config = {"from_attributes": True}
