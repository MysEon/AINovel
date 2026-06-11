"""
Provider Registry — 按 provider_type 查找适配器实例

用法:
    from app.infrastructure.llm.provider_adapters import get_provider
    provider = get_provider("openai")
    model = provider.build_chat_model(config)
"""

from .anthropic_provider import AnthropicProvider
from .base import BaseProvider, ModelInfo, ProviderConfig
from .custom_provider import CustomProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider

_REGISTRY: dict[str, BaseProvider] = {
    "openai": OpenAIProvider(),
    "claude": AnthropicProvider(),
    "anthropic": AnthropicProvider(),
    "gemini": GeminiProvider(),
    "custom": CustomProvider(),
}


def get_provider(provider_type: str) -> BaseProvider:
    """根据 provider_type 获取适配器，不存在则抛 ValueError"""
    key = provider_type.lower().strip()
    provider = _REGISTRY.get(key)
    if not provider:
        supported = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(f"不支持的模型类型: {provider_type}（支持: {supported}）")
    return provider


__all__ = [
    "BaseProvider",
    "ProviderConfig",
    "ModelInfo",
    "get_provider",
]
