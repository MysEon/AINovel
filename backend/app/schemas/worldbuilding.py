"""世界观模块 Schemas（角色/地点/组织/世界观）"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── 角色 ──────────────────────────────────────────────

class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None
    # 角色参数
    gender: Optional[str] = Field(None, max_length=50)
    age: Optional[str] = Field(None, max_length=50)
    height: Optional[str] = Field(None, max_length=30)
    weight: Optional[str] = Field(None, max_length=30)
    birthday: Optional[str] = Field(None, max_length=50)
    blood_type: Optional[str] = Field(None, max_length=20)
    species: Optional[str] = Field(None, max_length=50)
    alignment: Optional[str] = Field(None, max_length=50)
    organization_id: Optional[int] = None
    dimensions: Optional[str] = None      # JSON 字符串
    abilities: Optional[str] = None
    weaknesses: Optional[str] = None
    extra_attributes: Optional[str] = None   # JSON 字符串（题材增量字段）


class CharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None
    gender: Optional[str] = Field(None, max_length=50)
    age: Optional[str] = Field(None, max_length=50)
    height: Optional[str] = Field(None, max_length=30)
    weight: Optional[str] = Field(None, max_length=30)
    birthday: Optional[str] = Field(None, max_length=50)
    blood_type: Optional[str] = Field(None, max_length=20)
    species: Optional[str] = Field(None, max_length=50)
    alignment: Optional[str] = Field(None, max_length=50)
    organization_id: Optional[int] = None
    dimensions: Optional[str] = None
    abilities: Optional[str] = None
    weaknesses: Optional[str] = None
    extra_attributes: Optional[str] = None


class CharacterResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    personality: Optional[str] = None
    background: Optional[str] = None
    appearance: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None
    birthday: Optional[str] = None
    blood_type: Optional[str] = None
    species: Optional[str] = None
    alignment: Optional[str] = None
    organization_id: Optional[int] = None
    dimensions: Optional[str] = None
    abilities: Optional[str] = None
    weaknesses: Optional[str] = None
    extra_attributes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 地点 ──────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    geography: Optional[str] = None
    culture: Optional[str] = None
    history: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    geography: Optional[str] = None
    culture: Optional[str] = None
    history: Optional[str] = None


class LocationResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    geography: Optional[str] = None
    culture: Optional[str] = None
    history: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 组织 ──────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    structure: Optional[str] = None
    purpose: Optional[str] = None
    influence: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    structure: Optional[str] = None
    purpose: Optional[str] = None
    influence: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    structure: Optional[str] = None
    purpose: Optional[str] = None
    influence: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 世界观 ─────────────────────────────────────────────

class WorldviewCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    rules: Optional[str] = None
    magic_system: Optional[str] = None
    technology: Optional[str] = None
    timeline: Optional[str] = None


class WorldviewUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    rules: Optional[str] = None
    magic_system: Optional[str] = None
    technology: Optional[str] = None
    timeline: Optional[str] = None


class WorldviewResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    rules: Optional[str] = None
    magic_system: Optional[str] = None
    technology: Optional[str] = None
    timeline: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
