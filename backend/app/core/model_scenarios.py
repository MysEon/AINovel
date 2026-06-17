"""模型配置场景授权常量与校验。"""

from app.core.exceptions import ValidationError

MODEL_SCENARIOS: list[str] = [
    "writing",
    "character_generation",
    "worldview_generation",
    "outline_generation",
    "knowledge_update",
    "chat",
]
DEFAULT_SCENARIOS: list[str] = ["writing", "chat"]


def validate_scenarios(values: list[str]) -> list[str]:
    """校验模型场景授权值，返回原列表。"""
    invalid = [value for value in values if value not in MODEL_SCENARIOS]
    if invalid:
        raise ValidationError(f"不支持的模型使用场景: {', '.join(invalid)}")
    return values
