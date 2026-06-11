"""世界观模块 Schemas（角色/地点/组织/世界观）"""

from datetime import datetime

from pydantic import BaseModel, Field

# ── 角色 ──────────────────────────────────────────────


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    personality: str | None = None
    background: str | None = None
    appearance: str | None = None
    # 角色参数
    gender: str | None = Field(None, max_length=50)
    age: str | None = Field(None, max_length=50)
    height: str | None = Field(None, max_length=30)
    weight: str | None = Field(None, max_length=30)
    birthday: str | None = Field(None, max_length=50)
    blood_type: str | None = Field(None, max_length=20)
    species: str | None = Field(None, max_length=50)
    alignment: str | None = Field(None, max_length=50)
    organization_id: int | None = None
    dimensions: str | None = None  # JSON 字符串
    abilities: str | None = None
    weaknesses: str | None = None
    extra_attributes: str | None = None  # JSON 字符串（题材增量字段）


class CharacterUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    personality: str | None = None
    background: str | None = None
    appearance: str | None = None
    gender: str | None = Field(None, max_length=50)
    age: str | None = Field(None, max_length=50)
    height: str | None = Field(None, max_length=30)
    weight: str | None = Field(None, max_length=30)
    birthday: str | None = Field(None, max_length=50)
    blood_type: str | None = Field(None, max_length=20)
    species: str | None = Field(None, max_length=50)
    alignment: str | None = Field(None, max_length=50)
    organization_id: int | None = None
    dimensions: str | None = None
    abilities: str | None = None
    weaknesses: str | None = None
    extra_attributes: str | None = None


class CharacterResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    personality: str | None = None
    background: str | None = None
    appearance: str | None = None
    gender: str | None = None
    age: str | None = None
    height: str | None = None
    weight: str | None = None
    birthday: str | None = None
    blood_type: str | None = None
    species: str | None = None
    alignment: str | None = None
    organization_id: int | None = None
    dimensions: str | None = None
    abilities: str | None = None
    weaknesses: str | None = None
    extra_attributes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 地点 ──────────────────────────────────────────────


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    geography: str | None = None
    culture: str | None = None
    history: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    geography: str | None = None
    culture: str | None = None
    history: str | None = None


class LocationResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    geography: str | None = None
    culture: str | None = None
    history: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 组织 ──────────────────────────────────────────────


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    structure: str | None = None
    purpose: str | None = None
    influence: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    structure: str | None = None
    purpose: str | None = None
    influence: str | None = None


class OrganizationResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    structure: str | None = None
    purpose: str | None = None
    influence: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── 世界观 ─────────────────────────────────────────────


class WorldviewCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    rules: str | None = None
    magic_system: str | None = None
    technology: str | None = None
    timeline: str | None = None


class WorldviewUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    rules: str | None = None
    magic_system: str | None = None
    technology: str | None = None
    timeline: str | None = None


class WorldviewResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    rules: str | None = None
    magic_system: str | None = None
    technology: str | None = None
    timeline: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
