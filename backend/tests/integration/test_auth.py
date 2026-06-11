"""认证 API 集成测试"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

import pytest


@pytest.mark.asyncio
async def test_register_user(client):
    resp = await client.post("/api/v1/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "NewPass123!",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """重复邮箱注册应失败"""
    payload = {
        "username": "dup1",
        "email": "dup@example.com",
        "password": "DupPass123!",
    }
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code in (400, 409)


@pytest.mark.asyncio
async def test_login_success(client):
    """注册后登录应返回 token"""
    await client.post("/api/v1/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "LoginPass123!",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": "loginuser",
        "password": "LoginPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """错误密码应返回 401"""
    await client.post("/api/v1/auth/register", json={
        "username": "wrongpw",
        "email": "wrongpw@example.com",
        "password": "CorrectPass1!",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": "wrongpw",
        "password": "WrongPass1!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(client):
    """无 token 访问受保护端点应返回 401"""
    resp = await client.get("/api/v1/projects/")
    assert resp.status_code == 401
