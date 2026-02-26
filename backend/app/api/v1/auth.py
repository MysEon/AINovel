"""
认证 API v1
/api/v1/auth/register | login | me | refresh
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import get_settings
from app.core.exceptions import ConflictError, UnauthorizedError, ForbiddenError
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.repositories.user import UserRepository
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token
from app.api.deps.auth import require_active_user

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
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


@router.post("/login", response_model=Token)
async def login(
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
    token = create_access_token(
        subject=user.username,
        extra_claims={"user_id": user.id},
    )
    return Token(
        access_token=token,
        expires_in=settings.auth.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(require_active_user),
):
    return user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    user: User = Depends(require_active_user),
):
    settings = get_settings()
    token = create_access_token(
        subject=user.username,
        extra_claims={"user_id": user.id},
    )
    return Token(
        access_token=token,
        expires_in=settings.auth.access_token_expire_minutes * 60,
    )
