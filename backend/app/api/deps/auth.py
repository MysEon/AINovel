"""
认证依赖注入
提供 get_current_user / require_active_user 供路由使用
"""

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import is_token_revoked, verify_token
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 JWT 中解析并返回当前用户，同时校验 jti 黑名单"""
    payload = verify_token(token)
    if payload is None:
        raise UnauthorizedError("无效的认证凭据")

    username: str = payload.get("sub")
    if not username:
        raise UnauthorizedError("Token 缺少用户标识")

    jti = payload.get("jti")
    if jti and await is_token_revoked(jti, db):
        raise UnauthorizedError("Token 已撤销")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("用户不存在")
    return user


async def require_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """确保用户处于活跃状态"""
    if not user.is_active:
        raise ForbiddenError("账户已被禁用")
    return user
