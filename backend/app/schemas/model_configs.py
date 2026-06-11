"""模型配置 Schemas"""

import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.url_safety import validate_outbound_url


class ModelConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_type: str = Field(..., min_length=1, max_length=50)
    model_name: str | None = Field(None, max_length=100)
    temperature: float | None = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(2000, gt=0)
    api_key: str | None = Field(None, min_length=1, max_length=500)
    api_url: str | None = Field(None, max_length=500)
    top_p: float | None = Field(1.0, ge=0.0, le=1.0)
    top_k: int | None = Field(40, ge=0, le=100)
    frequency_penalty: float | None = Field(0.0, ge=-2.0, le=2.0)
    presence_penalty: float | None = Field(0.0, ge=-2.0, le=2.0)
    stop_sequences: list[str] | None = Field(default_factory=list)
    stream: bool | None = False
    logprobs: bool | None = False
    top_logprobs: int | None = Field(0, ge=0, le=20)
    proxy_url: str | None = Field(None, max_length=500)
    enable_proxy: bool | None = False

    @field_validator("api_url")
    @classmethod
    def check_api_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v

    @field_validator("proxy_url")
    @classmethod
    def check_proxy_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v


class ModelConfigUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    model_type: str | None = Field(None, min_length=1, max_length=50)
    model_name: str | None = Field(None, max_length=100)
    temperature: float | None = Field(None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(None, gt=0)
    api_key: str | None = Field(None, min_length=1, max_length=500)
    api_url: str | None = Field(None, max_length=500)
    top_p: float | None = Field(None, ge=0.0, le=1.0)
    top_k: int | None = Field(None, ge=0, le=100)
    frequency_penalty: float | None = Field(None, ge=-2.0, le=2.0)
    presence_penalty: float | None = Field(None, ge=-2.0, le=2.0)
    stop_sequences: list[str] | None = None
    stream: bool | None = None
    logprobs: bool | None = None
    top_logprobs: int | None = Field(None, ge=0, le=20)
    proxy_url: str | None = Field(None, max_length=500)
    enable_proxy: bool | None = None

    @field_validator("api_url")
    @classmethod
    def check_api_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v

    @field_validator("proxy_url")
    @classmethod
    def check_proxy_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v


class ModelConfigResponse(BaseModel):
    id: int
    name: str
    model_type: str
    model_name: str | None = None
    temperature: float | None = 0.7
    max_tokens: int | None = 2000
    api_url: str | None = None
    top_p: float | None = 1.0
    top_k: int | None = 40
    frequency_penalty: float | None = 0.0
    presence_penalty: float | None = 0.0
    stop_sequences: list[str] | None = Field(default_factory=list)
    stream: bool | None = False
    logprobs: bool | None = False
    top_logprobs: int | None = 0
    proxy_url: str | None = None
    enable_proxy: bool | None = False
    user_id: int
    created_at: datetime
    updated_at: datetime
    api_key_masked: str | None = None

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


class TestConnectionRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=500)
    model_type: str = Field(..., min_length=1, max_length=50)
    model_name: str | None = Field(None, max_length=100)
    api_url: str | None = Field(None, max_length=500)
    proxy_url: str | None = Field(None, max_length=500)

    @field_validator("api_url")
    @classmethod
    def check_api_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v

    @field_validator("proxy_url")
    @classmethod
    def check_proxy_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class ListModelsRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=500)
    model_type: str = Field(..., min_length=1, max_length=50)
    api_url: str | None = Field(None, max_length=500)
    proxy_url: str | None = Field(None, max_length=500)

    @field_validator("api_url")
    @classmethod
    def check_api_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v

    @field_validator("proxy_url")
    @classmethod
    def check_proxy_url(cls, v):
        if v:
            validate_outbound_url(v)
        return v


class ModelInfoResponse(BaseModel):
    value: str
    label: str
