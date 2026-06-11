"""
ORM 模型聚合入口
导入所有模型，确保 Alembic 能发现全部表
"""

from app.infrastructure.db.base import Base  # noqa: F401
from app.infrastructure.db.models.ai_runtime import (  # noqa: F401
    AIGeneratedContent,
    AIRun,
    AIRunEvent,
    LangGraphSession,
    LangGraphWorkflow,
)
from app.infrastructure.db.models.auth import TokenBlacklist, User  # noqa: F401
from app.infrastructure.db.models.manuscript import Chapter, Draft  # noqa: F401
from app.infrastructure.db.models.model_configs import ModelConfig  # noqa: F401
from app.infrastructure.db.models.projects import Project  # noqa: F401
from app.infrastructure.db.models.prompts import PromptTemplate  # noqa: F401
from app.infrastructure.db.models.worldbuilding import (  # noqa: F401
    Character,
    Location,
    Organization,
    Worldview,
)
