"""OpenAI Provider Adapter"""

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.url_safety import validate_outbound_url
from .base import BaseProvider, ModelInfo, ProviderConfig


class OpenAIProvider(BaseProvider):
    provider_type = "openai"

    def build_chat_model(self, config: ProviderConfig) -> BaseChatModel:
        if config.api_url:
            validate_outbound_url(config.api_url)
        if config.proxy_url:
            validate_outbound_url(config.proxy_url)

        kwargs: dict = {
            "model": config.model_name or "gpt-4o",
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
            kwargs["stop"] = config.stop_sequences
        if config.frequency_penalty:
            kwargs["frequency_penalty"] = config.frequency_penalty
        if config.presence_penalty:
            kwargs["presence_penalty"] = config.presence_penalty
        return ChatOpenAI(**kwargs)

    async def test_connection(self, config: ProviderConfig) -> bool:
        model = self.build_chat_model(config)
        await model.ainvoke("ping")
        return True

    async def list_models(self, config: ProviderConfig) -> list[ModelInfo]:
        from openai import AsyncOpenAI

        if config.api_url:
            validate_outbound_url(config.api_url)
        if config.proxy_url:
            validate_outbound_url(config.proxy_url)

        client_kwargs: dict = {"api_key": config.api_key}
        if config.api_url:
            client_kwargs["base_url"] = config.api_url
        if config.proxy_url:
            client_kwargs["http_client"] = httpx.AsyncClient(proxy=config.proxy_url)

        client = AsyncOpenAI(**client_kwargs)
        resp = await client.models.list()
        return [
            ModelInfo(value=m.id, label=m.id)
            for m in sorted(resp.data, key=lambda x: x.id)
        ]
