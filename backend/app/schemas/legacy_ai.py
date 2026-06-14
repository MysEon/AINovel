"""旧 AI 接口兼容层 Schema"""

from pydantic import BaseModel, Field


class ChapterSummarySchema(BaseModel):
    """章节摘要 LLM structured output schema。"""

    summary: str = Field(..., min_length=10, max_length=1500, description="章节内容摘要")


class LegacyChatRequest(BaseModel):
    project_id: int
    model_config_id: int
    message: str
    history: list | None = None
    prompt_template_id: int | None = None
    # 用户当前正在编辑的章节 ID。None → 退化为不分层的旧行为
    # 提供后，后端按 L1(全文)/L2(详细)/L3(简要) 分层注入章节上下文
    current_chapter_id: int | None = None


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
