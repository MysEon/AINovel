"""Custom (OpenAI-compatible) Provider Adapter"""

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from .base import BaseProvider, ModelInfo, ProviderConfig


class CustomProvider(BaseProvider):
    """兼容 OpenAI API 格式的自定义 Provider（如 vLLM、Ollama、LM Studio 等）"""

    provider_type = "custom"

    def build_chat_model(self, config: ProviderConfig) -> BaseChatModel:
        if not config.api_url:
            raise ValueError("自定义模型必须提供 api_url")
        kwargs: dict = {
            "model": config.model_name or "default",
            "api_key": config.api_key or "not-needed",
            "base_url": config.api_url,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
        }
        if config.proxy_url:
            kwargs["http_client"] = httpx.Client(proxy=config.proxy_url)
            kwargs["http_async_client"] = httpx.AsyncClient(proxy=config.proxy_url)
        if config.stop_sequences:
            kwargs["stop"] = config.stop_sequences
        return ChatOpenAI(**kwargs)

    async def test_connection(self, config: ProviderConfig) -> bool:
        model = self.build_chat_model(config)
        await model.ainvoke("ping")
        return True

    async def list_models(self, config: ProviderConfig) -> list[ModelInfo]:
        """尝试通过 OpenAI 兼容接口获取模型列表"""
        from openai import AsyncOpenAI

        client_kwargs: dict = {
            "api_key": config.api_key or "not-needed",
            "base_url": config.api_url,
        }
        if config.proxy_url:
            client_kwargs["http_client"] = httpx.AsyncClient(proxy=config.proxy_url)

        client = AsyncOpenAI(**client_kwargs)
        try:
            resp = await client.models.list()
            return [
                ModelInfo(value=m.id, label=m.id)
                for m in sorted(resp.data, key=lambda x: x.id)
            ]
        except Exception:
            return []
