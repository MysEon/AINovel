"""AdminService 单元测试"""

import pytest

from app.application.admin_service import AdminService
from app.application.model_config_service import ModelConfigService
from app.core.exceptions import NotFoundError
from app.schemas.model_configs import ModelConfigCreate


class TestAdminService:
    async def test_rotate_model_key(self, db_session, test_user):
        model_service = ModelConfigService(db_session)
        cfg = await model_service.create(
            ModelConfigCreate(name="轮换配置", model_type="openai", api_key="sk-test1234567890"), test_user.id
        )

        admin_service = AdminService(db_session)
        result = await admin_service.rotate_model_key(cfg.id)
        assert result["model_config_id"] == cfg.id
        assert "new_encrypted_key" in result
        assert "轮换" in result["message"]

    async def test_rotate_model_key_not_found(self, db_session):
        admin_service = AdminService(db_session)
        with pytest.raises(NotFoundError):
            await admin_service.rotate_model_key(99999)

    async def test_rotate_model_key_no_key(self, db_session, test_user):
        model_service = ModelConfigService(db_session)
        cfg = await model_service.create(ModelConfigCreate(name="无密钥", model_type="openai"), test_user.id)

        admin_service = AdminService(db_session)
        with pytest.raises(NotFoundError):
            await admin_service.rotate_model_key(cfg.id)
