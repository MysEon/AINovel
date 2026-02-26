"""AI API Schemas"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


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
