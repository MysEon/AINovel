"""Google Gemini Provider Adapter"""

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.url_safety import validate_outbound_url
from .base import BaseProvider, ModelInfo, ProviderConfig


class GeminiProvider(BaseProvider):
    provider_type = "gemini"

    def build_chat_model(self, config: ProviderConfig) -> BaseChatModel:
        if config.api_url:
            validate_outbound_url(config.api_url)
        if config.proxy_url:
            validate_outbound_url(config.proxy_url)

        kwargs: dict = {
            "model": config.model_name or "gemini-2.0-flash",
            "google_api_key": config.api_key,
            "temperature": config.temperature,
            "max_output_tokens": config.max_tokens,
        }
        if config.top_p != 1.0:
            kwargs["top_p"] = config.top_p
        if config.proxy_url:
            kwargs["transport"] = "rest"
            kwargs["client_options"] = {
                "api_endpoint": config.api_url or "https://generativelanguage.googleapis.com",
            }
        elif config.api_url:
            kwargs["transport"] = "rest"
            kwargs["client_options"] = {"api_endpoint": config.api_url}
        if config.stop_sequences:
            kwargs["stop"] = config.stop_sequences
        return ChatGoogleGenerativeAI(**kwargs)

    async def test_connection(self, config: ProviderConfig) -> bool:
        model = self.build_chat_model(config)
        await model.ainvoke("ping")
        return True

    async def list_models(self, config: ProviderConfig) -> list[ModelInfo]:
        """Gemini 返回已知模型列表"""
        known = [
            "gemini-2.5-pro-preview-06-05",
            "gemini-2.5-flash-preview-05-20",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ]
        return [ModelInfo(value=m, label=m) for m in known]
