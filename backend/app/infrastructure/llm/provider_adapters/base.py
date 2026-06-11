"""
LLM Provider Adapter 抽象接口

所有 LLM 提供商适配器必须实现此接口。
Provider Adapter 使用实例参数调用，不通过全局环境变量切换。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from langchain_core.language_models import BaseChatModel


@dataclass(frozen=True)
class ProviderConfig:
    """Provider 调用所需的配置（从 ModelConfig ORM 解密后传入）"""

    api_key: str
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 1.0
    api_url: str | None = None
    proxy_url: str | None = None
    # 扩展参数
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    stop_sequences: list[str] | None = None


@dataclass(frozen=True)
class ModelInfo:
    """可用模型信息"""

    value: str
    label: str


class BaseProvider(ABC):
    """LLM Provider 抽象基类"""

    provider_type: str  # e.g. "openai", "anthropic", "gemini", "custom"

    @abstractmethod
    def build_chat_model(self, config: ProviderConfig) -> BaseChatModel:
        """构建 LangChain ChatModel 实例（不缓存，由调用方管理生命周期）"""
        ...

    @abstractmethod
    async def test_connection(self, config: ProviderConfig) -> bool:
        """测试连接是否可用，成功返回 True，失败抛异常"""
        ...

    @abstractmethod
    async def list_models(self, config: ProviderConfig) -> list[ModelInfo]:
        """列出该 Provider 下可用的模型"""
        ...

    @property
    def supports_streaming(self) -> bool:
        return True

    @property
    def supports_tool_calling(self) -> bool:
        return True
