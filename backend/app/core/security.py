"""
安全模块
密码哈希、JWT Token 生成与验证、Refresh Token、Token 黑名单
"""

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def _pre_hash(password: str) -> bytes:
    """SHA256 预哈希：绕过 bcrypt 72 字节限制，保证输入永远 ≤ 64 字符"""
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_pre_hash(plain_password), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_pre_hash(password), bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """创建JWT访问令牌"""
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.auth.access_token_expire_minutes))
    jti = str(uuid4())
    payload = {"sub": subject, "iat": now, "exp": expire, "jti": jti, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)


def create_refresh_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """创建JWT刷新令牌"""
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.auth.refresh_token_expire_minutes))
    jti = str(uuid4())
    payload = {"sub": subject, "iat": now, "exp": expire, "jti": jti, "type": "refresh"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)


def verify_token(token: str) -> dict | None:
    """验证JWT令牌，返回payload或None"""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.auth.secret_key,
            algorithms=[settings.auth.algorithm],
        )
        if payload.get("sub") is None:
            return None
        return payload
    except JWTError:
        return None


def verify_refresh_token(token: str) -> dict | None:
    """验证JWT刷新令牌，返回payload或None"""
    payload = verify_token(token)
    if payload is None:
        return None
    if payload.get("type") != "refresh":
        return None
    return payload


def decode_token_unsafe(token: str) -> dict | None:
    """解码JWT令牌（不验证过期），用于调试/刷新"""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.auth.secret_key,
            algorithms=[settings.auth.algorithm],
            options={"verify_exp": False},
        )
    except JWTError:
        return None


async def revoke_token(jti: str, user_id: int, expires_at: datetime, db) -> None:
    """将指定 jti 加入黑名单"""
    from sqlalchemy import select
    from sqlalchemy.exc import OperationalError

    from app.infrastructure.db.models.auth import TokenBlacklist

    try:
        result = await db.execute(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
        existing = result.scalar_one_or_none()
        if existing:
            return

        entry = TokenBlacklist(jti=jti, user_id=user_id, expires_at=expires_at)
        db.add(entry)
        await db.commit()
    except OperationalError:
        # 表不存在时优雅降级，不抛异常
        await db.rollback()


async def is_token_revoked(jti: str, db) -> bool:
    """检查指定 jti 是否在黑名单中"""
    from sqlalchemy import select
    from sqlalchemy.exc import OperationalError

    from app.infrastructure.db.models.auth import TokenBlacklist

    try:
        result = await db.execute(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
        return result.scalar_one_or_none() is not None
    except OperationalError:
        # 表不存在时视为未撤销，避免登录流程中断
        return False
