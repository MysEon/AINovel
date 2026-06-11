"""旧 AI 接口兼容层 Schema"""

from pydantic import BaseModel


class LegacyChatRequest(BaseModel):
    project_id: int
    model_config_id: int
    message: str
    history: list | None = None
    prompt_template_id: int | None = None


class LegacyGenerateRequest(BaseModel):
    project_id: int
    model_config_id: int
    chapter_number: int | None = None
    chapter_outline: str | None = None
    character_names: list[str] | None = None
    situation: str | None = None
    content: str | None = None
    optimization_type: str | None = None
    prompt: str | None = None
    category: str | None = None
    user_requirements: str | None = None
