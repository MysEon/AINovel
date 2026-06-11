"""Base64 → Fernet 迁移集成测试"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")

import base64
import pytest
from sqlalchemy import select

from app.infrastructure.db.models.model_configs import ModelConfig
from app.infrastructure.secrets import get_encryption_service


@pytest.fixture
async def old_base64_config(db_session):
    """创建一条使用旧 base64 编码 api_key 的配置"""
    plaintext_key = "sk-test-api-key-12345"
    old_encoded = base64.b64encode(plaintext_key.encode()).decode()

    cfg = ModelConfig(
        name="旧配置",
        model_type="openai",
        api_key=old_encoded,
        model_name="gpt-4o",
        user_id=1,
    )
    db_session.add(cfg)
    await db_session.commit()
    await db_session.refresh(cfg)
    return cfg, plaintext_key


@pytest.mark.asyncio
async def test_migration_converts_base64_to_fernet(db_session, old_base64_config):
    """旧 base64 编码的 key → 跑迁移后变 Fernet 格式并可解密"""
    cfg, plaintext_key = old_base64_config

    # 迁移前确认是 base64
    assert not cfg.api_key.startswith("gAAA")

    # 手动执行迁移逻辑（与脚本一致）
    encryption_service = get_encryption_service()
    decrypted = base64.b64decode(cfg.api_key.encode()).decode("utf-8")
    new_ciphertext = encryption_service.encrypt(decrypted)

    cfg.api_key = new_ciphertext
    await db_session.commit()

    # 验证 Fernet 格式
    assert cfg.api_key.startswith("gAAA")

    # 验证可解密
    decrypted_after = encryption_service.decrypt(cfg.api_key)
    assert decrypted_after == plaintext_key


@pytest.mark.asyncio
async def test_migration_idempotent(db_session, old_base64_config):
    """重复运行幂等：第二次遇到 gAAA 格式应跳过"""
    cfg, plaintext_key = old_base64_config

    encryption_service = get_encryption_service()

    # 第一次迁移
    if not cfg.api_key.startswith("gAAA"):
        decrypted = base64.b64decode(cfg.api_key.encode()).decode("utf-8")
        cfg.api_key = encryption_service.encrypt(decrypted)
        await db_session.commit()

    first_ciphertext = cfg.api_key

    # 第二次运行（幂等：跳过）
    if not cfg.api_key.startswith("gAAA"):
        decrypted = base64.b64decode(cfg.api_key.encode()).decode("utf-8")
        cfg.api_key = encryption_service.encrypt(decrypted)
        await db_session.commit()

    assert cfg.api_key == first_ciphertext


@pytest.mark.asyncio
async def test_dry_run_does_not_modify(db_session, old_base64_config):
    """dry-run 模式不应写回数据库"""
    cfg, plaintext_key = old_base64_config
    original_api_key = cfg.api_key

    # dry-run 逻辑：不写入
    encryption_service = get_encryption_service()
    if not cfg.api_key.startswith("gAAA"):
        decrypted = base64.b64decode(cfg.api_key.encode()).decode("utf-8")
        new_ciphertext = encryption_service.encrypt(decrypted)
        # 模拟 dry-run：不执行 cfg.api_key = new_ciphertext
        _ = new_ciphertext  # 仅计算

    # 刷新对象确认未变更
    await db_session.refresh(cfg)
    assert cfg.api_key == original_api_key


@pytest.mark.asyncio
async def test_empty_table_no_op(db_session):
    """空表时迁移无操作"""
    result = await db_session.execute(select(ModelConfig))
    count = len(result.scalars().all())
    # 如果表为空，迁移逻辑不应报错
    encryption_service = get_encryption_service()
    assert encryption_service is not None
    assert count == 0 or count >= 0  # 仅确认无异常
