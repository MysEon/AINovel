"""ModelConfigService 单元测试"""

import pytest

from app.application.model_config_service import ModelConfigService
from app.core.exceptions import NotFoundError
from app.schemas.model_configs import ListModelsRequest, ModelConfigCreate, ModelConfigUpdate, TestConnectionRequest


class TestModelConfigService:
    async def test_create_config(self, db_session, test_user):
        service = ModelConfigService(db_session)
        body = ModelConfigCreate(name="测试配置", model_type="openai", api_key="sk-test1234567890")
        cfg = await service.create(body, test_user.id)
        assert cfg.name == "测试配置"
        assert cfg.user_id == test_user.id

    async def test_get_config(self, db_session, test_user):
        service = ModelConfigService(db_session)
        created = await service.create(
            ModelConfigCreate(name="获取配置", model_type="openai", api_key="sk-test"), test_user.id
        )
        cfg = await service.get_config(created.id, test_user.id)
        assert cfg.id == created.id

    async def test_get_config_not_found(self, db_session, test_user):
        service = ModelConfigService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_config(99999, test_user.id)

    async def test_update_config(self, db_session, test_user):
        service = ModelConfigService(db_session)
        created = await service.create(
            ModelConfigCreate(name="旧名", model_type="openai", api_key="sk-test"), test_user.id
        )
        updated = await service.update_config(created.id, test_user.id, ModelConfigUpdate(name="新名"))
        assert updated.name == "新名"

    async def test_delete_config(self, db_session, test_user):
        service = ModelConfigService(db_session)
        created = await service.create(
            ModelConfigCreate(name="待删", model_type="openai", api_key="sk-test"), test_user.id
        )
        result = await service.delete_config(created.id, test_user.id)
        assert "待删" in result["message"]
        with pytest.raises(NotFoundError):
            await service.get_config(created.id, test_user.id)

    async def test_list_configs(self, db_session, test_user):
        service = ModelConfigService(db_session)
        await service.create(ModelConfigCreate(name="配置A", model_type="openai", api_key="sk-test"), test_user.id)
        configs = await service.list_configs(test_user.id)
        assert any(c.name == "配置A" for c in configs)

    async def test_mask_key(self, db_session, test_user):
        service = ModelConfigService(db_session)
        masked = service._mask_key("sk-abcdefghijklmnopqrstuvwxyz")
        assert masked.startswith("sk-a")
        assert masked.endswith("xyz")
        assert "*" in masked

    async def test_serialize_stop_sequences(self, db_session, test_user):
        service = ModelConfigService(db_session)
        assert service._serialize_stop_sequences(["stop1", "stop2"]) == '["stop1", "stop2"]'
        assert service._serialize_stop_sequences(None) is None

    async def test_test_connection_bad_provider(self, db_session, test_user):
        service = ModelConfigService(db_session)
        result = await service.test_connection(TestConnectionRequest(model_type="unknown", api_key="key"))
        assert result.success is False

    async def test_list_available_models_bad_provider(self, db_session, test_user):
        service = ModelConfigService(db_session)
        with pytest.raises(ValueError):
            await service.list_available_models(ListModelsRequest(model_type="unknown", api_key="key"))
