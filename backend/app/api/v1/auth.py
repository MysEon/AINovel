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

from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    verify_token, verify_refresh_token, revoke_token,
)
from app.core.config import get_settings
from app.core.exceptions import ConflictError, UnauthorizedError, ForbiddenError
from app.core.middleware import limiter
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.repositories.user import UserRepository
from app.schemas.auth import (
    UserCreate, UserLogin, UserResponse,
    Token, RefreshTokenRequest, RefreshTokenResponse,
)
from app.api.deps.auth import require_active_user

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("3/hour")
async def register(
    request: Request,
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)

    if await repo.get_by_username(body.username):
        raise ConflictError("用户名已存在")
    if await repo.get_by_email(body.email):
        raise ConflictError("邮箱已被注册")

    user = User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        password_hash=get_password_hash(body.password),
    )
    await repo.create(user)
    await db.commit()
    return user


@router.post("/login", response_model=RefreshTokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    user = await repo.get_by_username(body.username)

    if not user or not verify_password(body.password, user.password_hash):
        raise UnauthorizedError("用户名或密码错误")
    if not user.is_active:
        raise ForbiddenError("账户已被禁用")

    settings = get_settings()
    access_token = create_access_token(
        subject=user.username,
        extra_claims={"user_id": user.id},
    )
    refresh_token = create_refresh_token(
        subject=user.username,
        extra_claims={"user_id": user.id},
    )
    return RefreshTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.auth.access_token_expire_minutes * 60,
    )


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
    payload = verify_refresh_token(body.refresh_token)
    if not payload:
        raise UnauthorizedError("无效的刷新令牌")

    jti = payload.get("jti")
    user_id = payload.get("user_id")
    username = payload.get("sub")

    if not jti or not user_id or not username:
        raise UnauthorizedError("刷新令牌格式错误")

    # 检查 refresh token 是否已被撤销
    from app.core.security import is_token_revoked
    if await is_token_revoked(jti, db):
        raise UnauthorizedError("刷新令牌已撤销")

    # 将旧 refresh token 加入黑名单
    from datetime import datetime, timezone, timedelta
    expires_at = datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise UnauthorizedError("刷新令牌已过期")

    await revoke_token(jti, user_id, expires_at, db)

    # 发放新 token 对
    settings = get_settings()
    new_access = create_access_token(
        subject=username,
        extra_claims={"user_id": user_id},
    )
    new_refresh = create_refresh_token(
        subject=username,
        extra_claims={"user_id": user_id},
    )

    return RefreshTokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.auth.access_token_expire_minutes * 60,
    )


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """将当前 access_token 的 jti 加入黑名单"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise UnauthorizedError("缺少认证凭据")

    token = auth_header[7:]
    payload = verify_token(token)
    if not payload:
        raise UnauthorizedError("无效的认证凭据")

    jti = payload.get("jti")
    user_id = payload.get("user_id")
    if not jti:
        raise UnauthorizedError("Token 缺少 jti")

    from datetime import datetime, timezone
    expires_at = datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc)
    await revoke_token(jti, user_id, expires_at, db)

    return {"message": "登出成功"}
