"""Rate Limit 集成测试"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")

import pytest


@pytest.mark.asyncio
async def test_login_rate_limit_429(client):
    """登录 6 次/min 应返回 429"""
    await client.post("/api/v1/auth/register", json={
        "username": "rateuser",
        "email": "rate@example.com",
        "password": "RatePass123!",
    })

    # 前 5 次应成功
    for _ in range(5):
        resp = await client.post("/api/v1/auth/login", json={
            "username": "rateuser",
            "password": "RatePass123!",
        })
        assert resp.status_code == 200

    # 第 6 次应 429
    resp = await client.post("/api/v1/auth/login", json={
        "username": "rateuser",
        "password": "RatePass123!",
    })
    assert resp.status_code == 429
    data = resp.json()
    assert data["error_code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_ai_endpoint_rate_limit_429(client, auth_headers):
    """AI 端点 11 次/min 应返回 429（用 legacy_chat 测试）"""
    # 由于 legacy_chat 需要有效 project_id 和 model_config_id，
    # 我们在缺少资源的情况下快速触发限流（前几次会 404，但我们只关心 429 出现）
    status_codes = []
    for i in range(12):
        resp = await client.post("/api/ai/chat", headers=auth_headers, json={
            "project_id": 9999,
            "model_config_id": 9999,
            "message": f"test {i}",
        })
        status_codes.append(resp.status_code)
        if resp.status_code == 429:
            break

    assert 429 in status_codes


@pytest.mark.asyncio
async def test_register_rate_limit_429(client):
    """注册 4 次/hour 应返回 429"""
    for i in range(3):
        resp = await client.post("/api/v1/auth/register", json={
            "username": f"reguser{i}",
            "email": f"reg{i}@example.com",
            "password": "RegPass123!",
        })
        assert resp.status_code == 201

    # 第 4 次应 429
    resp = await client.post("/api/v1/auth/register", json={
        "username": "reguser3",
        "email": "reg3@example.com",
        "password": "RegPass123!",
    })
    assert resp.status_code == 429
    data = resp.json()
    assert data["error_code"] == "RATE_LIMIT_EXCEEDED"
