"""AI Runtime 领域枚举"""

from enum import Enum


class RunStatus(str, Enum):
    """AI 运行状态"""

    PENDING = "pending"
    RUNNING = "running"
    INTERRUPTED = "interrupted"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EventType(str, Enum):
    """AI 运行事件类型"""

    TOKEN = "token"
    NODE_START = "node_start"
    NODE_END = "node_end"
    TOOL_CALL = "tool_call"
    ERROR = "error"
    ARTIFACT = "artifact"
    INTERRUPT = "interrupt"


class ContentType(str, Enum):
    """AI 生成内容类型"""

    OUTLINE = "outline"
    DRAFT = "draft"
    DIALOGUE = "dialogue"
    SUGGESTION = "suggestion"
    OPTIMIZATION = "optimization"
    CREATIVE = "creative"
    CHAT = "chat"


class WorkflowType(str, Enum):
    """工作流类型"""

    CHAPTER_OUTLINE = "chapter_outline"
    CHAPTER_DRAFT = "chapter_draft"
    PLOT_SUGGESTION = "plot_suggestion"
    CONTENT_OPTIMIZATION = "content_optimization"
    CREATIVE_IDEAS = "creative_ideas"
    AI_CHAT = "ai_chat"
