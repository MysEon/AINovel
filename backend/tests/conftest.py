"""
测试根 conftest — 全局 fixture

提供：
- 测试用 Settings（SQLite 内存库 + 固定密钥）
- 异步 DB engine / session
- FastAPI TestClient
- 预置用户 / 项目 fixture
"""

import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# ── 测试环境变量（必须在 import app 之前设置） ──
import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

from app.infrastructure.db.base import Base  # noqa: E402
from app.infrastructure.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402


# ── 事件循环 ──

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── 数据库 ──

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


# ── FastAPI TestClient ──

@pytest_asyncio.fixture
async def app(db_engine):
    """创建测试用 FastAPI 应用，覆盖 DB 依赖"""
    application = create_app()
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def _override_db():
        async with session_factory() as session:
            yield session
            await session.rollback()

    application.dependency_overrides[get_db] = _override_db
    yield application
    application.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """异步 HTTP 测试客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── 预置用户 ──

TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPass123!"


@pytest_asyncio.fixture
async def test_user(db_session):
    """创建测试用户并返回 ORM 对象"""
    import uuid
    from app.infrastructure.db.models.auth import User
    from app.core.security import get_password_hash

    user = User(
        username=f"testuser_{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        password_hash=get_password_hash(TEST_USER_PASSWORD),
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(client) -> dict:
    """注册并登录，返回带 JWT 的请求头"""
    import uuid

    username = f"testuser_{uuid.uuid4().hex[:8]}"
    email = f"{uuid.uuid4().hex[:8]}@example.com"

    reg_resp = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": TEST_USER_PASSWORD,
    })
    assert reg_resp.status_code == 201

    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": TEST_USER_PASSWORD,
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
