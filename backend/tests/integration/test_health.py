"""健康检查集成测试"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio


@pytest.mark.asyncio
async def test_liveness(client):
    resp = await client.get("/health/live")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_readiness(client):
    resp = await client.get("/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert "checks" in data
