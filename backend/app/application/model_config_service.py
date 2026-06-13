"""模型配置 Application Service

职责：
- CRUD + 加密/解密/遮盖
- stop_sequences JSON 序列化
- provider 连接测试、模型列表
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.model_scenarios import DEFAULT_SCENARIOS
from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.db.repositories.base import BaseRepository
from app.infrastructure.secrets import get_encryption_service
from app.schemas.model_configs import (
    ListModelsRequest,
    ModelConfigCreate,
    ModelConfigUpdate,
    ModelInfoResponse,
    TestConnectionRequest,
    TestConnectionResponse,
)

_encryption_service = get_encryption_service()


class ModelConfigRepository(BaseRepository[ModelConfig]):
    model = ModelConfig


class ModelConfigService:
    """模型配置业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ModelConfigRepository(db)

    # ---------- 内部辅助 ----------

    def _encrypt_key(self, key: str) -> str:
        return _encryption_service.encrypt(key)

    def _decrypt_key(self, encrypted: str) -> str:
        return _encryption_service.decrypt(encrypted)

    @staticmethod
    def _mask_key(api_key: str) -> str:
        if not api_key or len(api_key) <= 8:
            return "*" * len(api_key) if api_key else ""
        return api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]

    @staticmethod
    def _serialize_stop_sequences(seqs: list | None) -> str | None:
        return json.dumps(seqs) if seqs else None

    @staticmethod
    def _serialize_scenarios(scenarios: list[str] | None) -> str | None:
        return json.dumps(scenarios if scenarios is not None else DEFAULT_SCENARIOS, ensure_ascii=False)

    @staticmethod
    def _parse_scenarios(scenarios: str | None) -> list[str] | None:
        if scenarios is None:
            return None
        try:
            parsed = json.loads(scenarios)
        except (json.JSONDecodeError, TypeError):
            return DEFAULT_SCENARIOS.copy()
        return parsed if isinstance(parsed, list) else DEFAULT_SCENARIOS.copy()

    def _attach_masked_key(self, cfg: ModelConfig) -> ModelConfig:
        """为配置对象附加遮蔽的 API Key（供响应序列化）"""
        if cfg.api_key:
            cfg.api_key_masked = self._mask_key(self._decrypt_key(cfg.api_key))
        else:
            cfg.api_key_masked = None
        return cfg

    async def _get_user_config(self, config_id: int, user_id: int) -> ModelConfig:
        result = await self.db.execute(
            select(ModelConfig).where(
                ModelConfig.id == config_id,
                ModelConfig.user_id == user_id,
            )
        )
        cfg = result.scalar_one_or_none()
        if not cfg:
            raise NotFoundError("模型配置不存在或无权访问")
        return cfg

    @staticmethod
    def _build_provider_config(
        api_key: str,
        model_type: str,
        model_name: str | None = None,
        api_url: str | None = None,
        proxy_url: str | None = None,
    ):
        """从请求参数构建 ProviderConfig"""
        from app.infrastructure.llm.provider_adapters import ProviderConfig

        return ProviderConfig(
            api_key=api_key,
            model_name=model_name or "",
            api_url=api_url,
            proxy_url=proxy_url,
        )

    # ---------- CRUD ----------

    async def create(self, body: ModelConfigCreate, user_id: int) -> ModelConfig:
        """创建模型配置"""
        encrypted_key = self._encrypt_key(body.api_key) if body.api_key else None
        masked_key = self._mask_key(body.api_key) if body.api_key else None

        cfg = ModelConfig(
            **body.model_dump(exclude={"api_key", "stop_sequences", "scenarios"}),
            api_key=encrypted_key,
            stop_sequences=self._serialize_stop_sequences(body.stop_sequences),
            scenarios=self._serialize_scenarios(body.scenarios),
            user_id=user_id,
        )
        await self.repo.create(cfg)
        await self.db.commit()
        await self.db.refresh(cfg)
        cfg.api_key_masked = masked_key
        return cfg

    async def list_configs(self, user_id: int, scenario: str | None = None) -> list[ModelConfig]:
        """列出用户的所有模型配置，可按授权场景过滤。"""
        result = await self.db.execute(
            select(ModelConfig).where(ModelConfig.user_id == user_id).order_by(ModelConfig.name)
        )
        configs = list(result.scalars().all())
        if scenario:
            configs = [
                c for c in configs if c.scenarios is None or scenario in (self._parse_scenarios(c.scenarios) or [])
            ]
        for c in configs:
            self._attach_masked_key(c)
        return configs

    async def get_config(self, config_id: int, user_id: int) -> ModelConfig:
        """获取单个模型配置"""
        cfg = await self._get_user_config(config_id, user_id)
        return self._attach_masked_key(cfg)

    async def update_config(self, config_id: int, user_id: int, body: ModelConfigUpdate) -> ModelConfig:
        """更新模型配置"""
        cfg = await self._get_user_config(config_id, user_id)
        data = body.model_dump(exclude_unset=True)

        if "api_key" in data and data["api_key"] is not None:
            data["api_key"] = self._encrypt_key(data["api_key"])

        if "stop_sequences" in data and data["stop_sequences"] is not None:
            data["stop_sequences"] = json.dumps(data["stop_sequences"])
        if "scenarios" in data and data["scenarios"] is not None:
            data["scenarios"] = json.dumps(data["scenarios"], ensure_ascii=False)

        for key, value in data.items():
            setattr(cfg, key, value)

        await self.db.commit()
        await self.db.refresh(cfg)
        return self._attach_masked_key(cfg)

    async def delete_config(self, config_id: int, user_id: int) -> dict:
        """删除模型配置"""
        cfg = await self._get_user_config(config_id, user_id)
        await self.db.delete(cfg)
        await self.db.commit()
        return {"message": f"模型配置 '{cfg.name}' 已成功删除"}

    # ---------- 连接测试 & 模型列表 ----------

    async def test_connection(self, body: TestConnectionRequest) -> TestConnectionResponse:
        """测试模型连接"""
        from app.infrastructure.llm.provider_adapters import get_provider

        try:
            provider = get_provider(body.model_type)
            pcfg = self._build_provider_config(
                body.api_key,
                body.model_type,
                body.model_name,
                body.api_url,
                body.proxy_url,
            )
            await provider.test_connection(pcfg)
            return TestConnectionResponse(
                success=True,
                message=f"{body.model_type} 模型连接测试成功",
                details={"model": body.model_name or "default", "provider": body.model_type},
            )
        except Exception as e:
            return TestConnectionResponse(success=False, message=f"连接测试失败: {e}")

    async def test_saved_config(self, config_id: int, user_id: int) -> TestConnectionResponse:
        """测试已保存配置的连接"""
        from app.infrastructure.llm.provider_adapters import get_provider

        cfg = await self._get_user_config(config_id, user_id)
        if not cfg.api_key:
            return TestConnectionResponse(success=False, message="该配置没有保存 API 密钥")

        try:
            provider = get_provider(cfg.model_type)
            pcfg = self._build_provider_config(
                self._decrypt_key(cfg.api_key),
                cfg.model_type,
                cfg.model_name,
                cfg.api_url,
                cfg.proxy_url if cfg.enable_proxy else None,
            )
            await provider.test_connection(pcfg)
            return TestConnectionResponse(
                success=True,
                message=f"{cfg.model_type} 模型连接测试成功",
                details={"model": cfg.model_name or "default", "provider": cfg.model_type},
            )
        except Exception as e:
            return TestConnectionResponse(success=False, message=f"连接测试失败: {e}")

    async def list_available_models(self, body: ListModelsRequest) -> list[ModelInfoResponse]:
        """获取可用模型列表"""
        from app.infrastructure.llm.provider_adapters import get_provider

        provider = get_provider(body.model_type)
        pcfg = self._build_provider_config(
            body.api_key,
            body.model_type,
            api_url=body.api_url,
            proxy_url=body.proxy_url,
        )
        models = await provider.list_models(pcfg)
        return [ModelInfoResponse(value=m.value, label=m.label) for m in models]

    async def list_models_by_config(self, config_id: int, user_id: int) -> list[ModelInfoResponse]:
        """使用已保存配置获取模型列表"""
        from app.infrastructure.llm.provider_adapters import get_provider

        cfg = await self._get_user_config(config_id, user_id)
        if not cfg.api_key:
            return []

        provider = get_provider(cfg.model_type)
        pcfg = self._build_provider_config(
            self._decrypt_key(cfg.api_key),
            cfg.model_type,
            cfg.model_name,
            cfg.api_url,
            cfg.proxy_url if cfg.enable_proxy else None,
        )
        models = await provider.list_models(pcfg)
        return [ModelInfoResponse(value=m.value, label=m.label) for m in models]
