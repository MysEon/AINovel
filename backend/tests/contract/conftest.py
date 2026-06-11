"""
契约测试 conftest — 为 Schemathesis 提供 FastAPI app、DB 与动态认证

设计要点：
- session-scoped DB engine + app，减少重复建表开销
- 直接写 DB 生成 JWT，绕过 /register 的 3/hour 限流
- 全局禁用 slowapi 限流，避免高频契约调用触发阈值
- @schemathesis.auth() 注入 Bearer token，公开端点用 skip_for 排除
"""

import os
import uuid

import pytest
import pytest_asyncio
import schemathesis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# 必须在 import app 前设置测试环境变量
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("AUTH_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("AUTH_REFRESH_TOKEN_EXPIRE_MINUTES", "10080")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

from app.infrastructure.db.base import Base  # noqa: E402
from app.infrastructure.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

# ── 认证 token 全局缓存（由 fixture 在 session 开始时填充） ──
_contract_auth_token: str | None = None


@pytest_asyncio.fixture(scope="session")
async def contract_db_engine():
    """创建内存 SQLite 引擎并建表，整个契约测试 session 复用"""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def contract_app(contract_db_engine):
    """创建带 DB override 的 FastAPI app，并禁用 slowapi 限流"""
    from app.core.middleware import limiter

    # 暂存原始 limit 方法，随后替换为无操作装饰器
    _original_limit = limiter.limit
    limiter.limit = lambda *args, **kwargs: lambda f: f

    application = create_app()
    session_factory = async_sessionmaker(contract_db_engine, expire_on_commit=False)

    async def _override_db() -> AsyncSession:
        async with session_factory() as session:
            yield session
            await session.rollback()

    application.dependency_overrides[get_db] = _override_db

    try:
        yield application
    finally:
        limiter.limit = _original_limit
        application.dependency_overrides.clear()


@pytest.fixture(scope="session")
def api_schema(contract_app):
    """从 ASGI app 加载 OpenAPI schema，供 Schemathesis 消费"""
    return schemathesis.openapi.from_asgi("/openapi.json", contract_app)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_contract_auth(contract_db_engine):
    """
    在 DB 中直接创建测试用户并生成 JWT，避免走 /register 限流。
    结果写入全局 _contract_auth_token，供 TokenAuth 读取。
    """
    global _contract_auth_token

    from app.core.security import create_access_token, get_password_hash
    from app.infrastructure.db.models.auth import User

    session_factory = async_sessionmaker(contract_db_engine, expire_on_commit=False)
    async with session_factory() as session:
        username = f"contract_user_{uuid.uuid4().hex[:8]}"
        user = User(
            username=username,
            email=f"{uuid.uuid4().hex[:8]}@contract.test",
            password_hash=get_password_hash("ContractPass123!"),
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        _contract_auth_token = create_access_token(subject=username)
        yield


# ── 动态认证提供者 ──
_auth_reg = schemathesis.auth(refresh_interval=600)


@_auth_reg
class TokenAuth:
    """Schemathesis v4 动态 auth：读取预生成 JWT 并注入 Authorization header"""

    def get(self, case, ctx) -> str:
        if _contract_auth_token is None:
            raise RuntimeError("认证 token 未初始化，请检查 _setup_contract_auth fixture")
        return _contract_auth_token

    def set(self, case, data, ctx) -> None:
        case.headers = case.headers or {}
        case.headers["Authorization"] = f"Bearer {data}"


# 公开端点不需要 auth，避免触发 ignored_auth 等检查噪音
_auth_reg.skip_for(path="/health/live")
_auth_reg.skip_for(path="/health/ready")
_auth_reg.skip_for(path="/health/metrics")
_auth_reg.skip_for(path="/api/v1/auth/register")
_auth_reg.skip_for(path="/api/v1/auth/login")
