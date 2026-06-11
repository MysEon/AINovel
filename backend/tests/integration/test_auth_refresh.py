"""Refresh Token + 黑名单集成测试"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")

import pytest


@pytest.mark.asyncio
async def test_login_returns_access_and_refresh(client):
    """login 应返回 access_token + refresh_token"""
    await client.post("/api/v1/auth/register", json={
        "username": "refreshuser",
        "email": "refresh@example.com",
        "password": "RefreshPass1!",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": "refreshuser",
        "password": "RefreshPass1!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 1800  # 30 min


@pytest.mark.asyncio
async def test_refresh_rotates_tokens_and_revokes_old(client):
    """refresh 应返回新 token 对，旧 refresh 应失效"""
    await client.post("/api/v1/auth/register", json={
        "username": "rotateuser",
        "email": "rotate@example.com",
        "password": "RotatePass1!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "rotateuser",
        "password": "RotatePass1!",
    })
    old_refresh = login_resp.json()["refresh_token"]

    # 第一次 refresh
    refresh_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": old_refresh,
    })
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    assert "access_token" in new_data
    assert "refresh_token" in new_data

    # 旧 refresh 再次使用应失败
    second_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": old_refresh,
    })
    assert second_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_access_jti(client):
    """logout 应将当前 access token 的 jti 加入黑名单"""
    reg = await client.post("/api/v1/auth/register", json={
        "username": "logoutuser",
        "email": "logout@example.com",
        "password": "LogoutPass1!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "logoutuser",
        "password": "LogoutPass1!",
    })
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # logout
    logout_resp = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # 再用同一 access token 访问受保护端点应 401
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 401


@pytest.mark.asyncio
async def test_revoked_refresh_cannot_be_reused(client):
    """已撤销的 refresh token 二次使用应返回 401"""
    await client.post("/api/v1/auth/register", json={
        "username": "revokeuser",
        "email": "revoke@example.com",
        "password": "RevokePass1!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "revokeuser",
        "password": "RevokePass1!",
    })
    refresh_token = login_resp.json()["refresh_token"]

    # refresh 一次
    r1 = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert r1.status_code == 200

    # 再次使用同一个 refresh token
    r2 = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_access_token_expires_shortly(client):
    """access token 应使用配置的短过期时间"""
    from app.core.config import get_settings
    settings = get_settings()
    assert settings.auth.access_token_expire_minutes == 30

    await client.post("/api/v1/auth/register", json={
        "username": "expireuser",
        "email": "expire@example.com",
        "password": "ExpirePass1!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "expireuser",
        "password": "ExpirePass1!",
    })
    data = login_resp.json()
    assert data["expires_in"] == 30 * 60


@pytest.mark.asyncio
async def test_me_endpoint_checks_blacklist(client):
    """GET /me 应校验 access token jti 黑名单"""
    reg = await client.post("/api/v1/auth/register", json={
        "username": "blackuser",
        "email": "black@example.com",
        "password": "BlackPass1!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "blackuser",
        "password": "BlackPass1!",
    })
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 访问 /me 成功
    me1 = await client.get("/api/v1/auth/me", headers=headers)
    assert me1.status_code == 200

    # logout
    await client.post("/api/v1/auth/logout", headers=headers)

    # 再访问 /me 失败
    me2 = await client.get("/api/v1/auth/me", headers=headers)
    assert me2.status_code == 401
