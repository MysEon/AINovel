"""
安全模块
密码哈希、JWT Token 生成与验证
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """创建JWT访问令牌"""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.auth.access_token_expire_minutes))
    payload = {"sub": subject, "iat": now, "exp": expire}
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)


def verify_token(token: str) -> Optional[dict]:
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


def decode_token_unsafe(token: str) -> Optional[dict]:
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
