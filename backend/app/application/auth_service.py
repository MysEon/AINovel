"""认证 Application Service

职责：
- 注册（唯一性检查 + 密码哈希 + 用户创建）
- 登录（凭证验证 + 活跃检查 + token 对签发）
- 刷新令牌（验证→黑名单检查→旧 token 撤销→新 token 对签发）
- 登出（token 提取 + 撤销）
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    is_token_revoked,
    revoke_token,
    verify_password,
    verify_refresh_token,
    verify_token,
)
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.repositories.user import UserRepository
from app.schemas.auth import RefreshTokenRequest, RefreshTokenResponse, UserCreate, UserLogin


class AuthenticationService:
    """认证业务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def register(self, body: UserCreate) -> User:
        """用户注册"""
        if await self.user_repo.get_by_username(body.username):
            raise ConflictError("用户名已存在")
        if await self.user_repo.get_by_email(body.email):
            raise ConflictError("邮箱已被注册")

        user = User(
            username=body.username,
            email=body.email,
            full_name=body.full_name,
            password_hash=get_password_hash(body.password),
        )
        await self.user_repo.create(user)
        await self.db.commit()
        return user

    async def login(self, body: UserLogin) -> RefreshTokenResponse:
        """用户登录，签发 token 对"""
        user = await self.user_repo.get_by_username(body.username)
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

    async def refresh_token(self, body: RefreshTokenRequest) -> RefreshTokenResponse:
        """用 refresh_token 换取新 token 对，旧 refresh 加入黑名单"""
        payload = verify_refresh_token(body.refresh_token)
        if not payload:
            raise UnauthorizedError("无效的刷新令牌")

        jti = payload.get("jti")
        user_id = payload.get("user_id")
        username = payload.get("sub")
        if not jti or not user_id or not username:
            raise UnauthorizedError("刷新令牌格式错误")

        if await is_token_revoked(jti, self.db):
            raise UnauthorizedError("刷新令牌已撤销")

        expires_at = datetime.fromtimestamp(payload.get("exp", 0), tz=UTC)
        if expires_at < datetime.now(UTC):
            raise UnauthorizedError("刷新令牌已过期")

        await revoke_token(jti, user_id, expires_at, self.db)

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

    async def logout(self, auth_header: str) -> dict:
        """将当前 access_token 的 jti 加入黑名单"""
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

        expires_at = datetime.fromtimestamp(payload.get("exp", 0), tz=UTC)
        await revoke_token(jti, user_id, expires_at, self.db)
        return {"message": "登出成功"}
