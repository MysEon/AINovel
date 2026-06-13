"""角色 AI 生成 Schemas。"""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

# AI 生成时附带的关联实体类型（与 worldbuilding 模型四类对齐）
ReferenceEntityType = Literal["character", "location", "organization", "worldview"]

# 单次生成请求中关联实体数量上限（防 prompt 体积爆炸）
MAX_REFERENCES_PER_REQUEST = 10


class ReferenceItem(BaseModel):
    """关联已有项目实体的引用。"""

    type: ReferenceEntityType = Field(..., description="实体类型")
    id: int = Field(..., gt=0, description="实体在对应表中的主键 ID")


class AIGenerateCharacterRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=2000)
    model_config_id: int
    references: list[ReferenceItem] = Field(
        default_factory=list,
        description=(
            f"可选的关联已有项目实体列表（最多 {MAX_REFERENCES_PER_REQUEST} 个，"
            "超出会被截断）。AI 会把这些实体的核心信息作为生成上下文参考。"
        ),
    )


class CharacterDraftSchema(BaseModel):
    """AI 生成的未落库角色草稿，字段应全部使用中文内容并尽量完整。"""

    name: str = Field(..., description="角色姓名或称号")
    description: str | None = Field(None, description="一句话角色定位概述（与 personality 不同）")
    personality: str = Field(..., description="角色性格、行为习惯与内在矛盾")
    background: str = Field(..., description="角色出身、经历、动机与关键过往")
    appearance: str = Field(..., description="角色外貌、衣着、气质与辨识特征")
    age: str | int | None = Field(None, description="年龄，可填数字或描述如'17'/'永生'/'少年'")
    species: str | None = Field(None, description="种族、身份类型或物种")
    alignment: str | None = Field(None, description="阵营、立场或价值取向")
    abilities: str | None = Field(None, description="能力、技能、专长或资源")
    weaknesses: str | None = Field(None, description="弱点、限制、恐惧或代价")
    dimensions: dict[str, int] | None = Field(
        None,
        description='角色维度评分，如 {"智力": 80, "体力": 60, "魅力": 90}',
    )
    extra_fields: dict[str, Any] | None = Field(
        None,
        description=(
            "额外角色细节，自由扩展。建议字段：core_conflict（核心冲突）、"
            "inner_monologue（内心独白）、relationships（dict[str,str] 关系网）、"
            "habits（习惯）、catchphrase（口头禅）、dreams（梦想）、tags（list[str] 标签）。可省略。"
        ),
    )

    @field_validator("age", mode="before")
    @classmethod
    def _coerce_age(cls, value):
        if value is None:
            return None
        return str(value)

    @field_validator("dimensions", mode="before")
    @classmethod
    def _coerce_dimensions(cls, value):
        if value is None:
            return None
        if not isinstance(value, dict):
            return None

        result: dict[str, int] = {}
        for key, raw_score in value.items():
            if not isinstance(key, str) or isinstance(raw_score, bool) or not isinstance(raw_score, int | float):
                continue
            score = round(raw_score)
            result[key] = min(100, max(0, score))
        return result or None

    @field_validator("extra_fields", mode="before")
    @classmethod
    def _coerce_extra_fields(cls, value):
        if value is None:
            return None
        return value if isinstance(value, dict) else None

    model_config = {"extra": "ignore"}


class CharacterDraftResponse(CharacterDraftSchema):
    """角色 AI 生成响应。dimensions 保持 dict，由前端复用表单逻辑转 JSON。"""
