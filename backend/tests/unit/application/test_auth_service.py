"""AuthenticationService 单元测试"""

import uuid

import pytest

from app.application.auth_service import AuthenticationService
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.schemas.auth import RefreshTokenRequest, UserCreate, UserLogin


class TestAuthService:
    async def test_register(self, db_session):
        service = AuthenticationService(db_session)
        username = f"unit_newuser_{uuid.uuid4().hex[:8]}"
        body = UserCreate(username=username, email=f"{username}@example.com", password="Pass1234!", full_name="New")
        user = await service.register(body)
        assert user.username == username

    async def test_register_duplicate_username(self, db_session, test_user):
        service = AuthenticationService(db_session)
        body = UserCreate(username=test_user.username, email="other@example.com", password="Pass1234!")
        with pytest.raises(ConflictError):
            await service.register(body)

    async def test_login_success(self, db_session):
        service = AuthenticationService(db_session)
        username = f"unit_loguser_{uuid.uuid4().hex[:8]}"
        await service.register(UserCreate(username=username, email=f"{username}@example.com", password="Pass1234!"))
        resp = await service.login(UserLogin(username=username, password="Pass1234!"))
        assert resp.access_token
        assert resp.refresh_token

    async def test_login_wrong_password(self, db_session):
        service = AuthenticationService(db_session)
        username = f"unit_wrongpass_{uuid.uuid4().hex[:8]}"
        await service.register(UserCreate(username=username, email=f"{username}@example.com", password="Pass1234!"))
        with pytest.raises(UnauthorizedError):
            await service.login(UserLogin(username=username, password="WrongPass"))

    async def test_login_inactive_user(self, db_session):
        service = AuthenticationService(db_session)
        username = f"unit_inactive_{uuid.uuid4().hex[:8]}"
        user = await service.register(
            UserCreate(username=username, email=f"{username}@example.com", password="Pass1234!")
        )
        user.is_active = False
        await db_session.commit()
        with pytest.raises(ForbiddenError):
            await service.login(UserLogin(username=username, password="Pass1234!"))

    async def test_logout(self, db_session):
        service = AuthenticationService(db_session)
        username = f"unit_logoutuser_{uuid.uuid4().hex[:8]}"
        await service.register(UserCreate(username=username, email=f"{username}@example.com", password="Pass1234!"))
        login_resp = await service.login(UserLogin(username=username, password="Pass1234!"))
        result = await service.logout(f"Bearer {login_resp.access_token}")
        assert "登出成功" in result["message"]

    async def test_logout_invalid_header(self, db_session):
        service = AuthenticationService(db_session)
        with pytest.raises(UnauthorizedError):
            await service.logout("Invalid")

    async def test_refresh_token_invalid(self, db_session):
        service = AuthenticationService(db_session)
        with pytest.raises(UnauthorizedError):
            await service.refresh_token(RefreshTokenRequest(refresh_token="invalid.token.here"))
