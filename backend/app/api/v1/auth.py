"""
认证 API v1
/api/v1/auth/register | login | me | refresh | logout

登录流程（M2 更新）：
1. POST /login → 返回 {access_token, refresh_token, token_type, expires_in}
2. access_token 有效期 30 分钟，refresh_token 有效期 7 天
3. access_token 过期前，用 POST /refresh {refresh_token} 换取新 token 对
4. refresh 成功后，旧 refresh_token 的 jti 加入黑名单（防止重放）
5. POST /logout 将当前 access_token 的 jti 加入黑名单
6. 所有受保护端点通过 verify_token 校验 jti 是否在黑名单
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_active_user
from app.application.auth_service import AuthenticationService
from app.core.middleware import limiter
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db
from app.schemas.auth import (
    RefreshTokenRequest,
    RefreshTokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("3/hour")
async def register(
    request: Request,
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    service = AuthenticationService(db)
    return await service.register(body)


@router.post("/login", response_model=RefreshTokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    service = AuthenticationService(db)
    return await service.login(body)


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(require_active_user),
):
    return user


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """用 refresh_token 换取新的 access_token + refresh_token，旧 refresh 加入黑名单"""
    service = AuthenticationService(db)
    return await service.refresh_token(body)


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """将当前 access_token 的 jti 加入黑名单"""
    service = AuthenticationService(db)
    return await service.logout(request.headers.get("Authorization", ""))
