"""Anthropic Provider Adapter"""

import httpx
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel

from app.core.url_safety import validate_outbound_url

from .base import BaseProvider, ModelInfo, ProviderConfig


class AnthropicProvider(BaseProvider):
    provider_type = "anthropic"

    def build_chat_model(self, config: ProviderConfig) -> BaseChatModel:
        if config.api_url:
            validate_outbound_url(config.api_url)
        if config.proxy_url:
            validate_outbound_url(config.proxy_url)

        kwargs: dict = {
            "model": config.model_name or "claude-sonnet-4-20250514",
            "api_key": config.api_key,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
        }
        if config.api_url:
            kwargs["base_url"] = config.api_url
        if config.proxy_url:
            kwargs["http_client"] = httpx.Client(proxy=config.proxy_url)
            kwargs["http_async_client"] = httpx.AsyncClient(proxy=config.proxy_url)
        if config.stop_sequences:
            kwargs["stop_sequences"] = config.stop_sequences
        if config.top_p != 1.0:
            kwargs["top_p"] = config.top_p
        return ChatAnthropic(**kwargs)

    async def test_connection(self, config: ProviderConfig) -> bool:
        model = self.build_chat_model(config)
        await model.ainvoke("ping")
        return True

    async def list_models(self, config: ProviderConfig) -> list[ModelInfo]:
        """Anthropic 没有公开的 list-models API，返回已知模型列表"""
        known = [
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            "claude-haiku-4-20250506",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ]
        return [ModelInfo(value=m, label=m) for m in known]
