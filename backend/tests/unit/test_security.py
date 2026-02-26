"""安全模块单元测试 — 密码哈希 + JWT"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

import pytest
from datetime import timedelta

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    verify_token,
    decode_token_unsafe,
)


class TestPasswordHashing:

    def test_hash_and_verify(self):
        raw = "MyP@ssw0rd!"
        hashed = get_password_hash(raw)
        assert hashed != raw
        assert verify_password(raw, hashed) is True

    def test_wrong_password(self):
        hashed = get_password_hash("correct")
        assert verify_password("wrong", hashed) is False

    def test_different_hashes(self):
        h1 = get_password_hash("same")
        h2 = get_password_hash("same")
        assert h1 != h2  # bcrypt 每次 salt 不同


class TestJWT:

    def test_create_and_verify(self):
        token = create_access_token(subject="user@test.com")
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "user@test.com"

    def test_expired_token(self):
        token = create_access_token(
            subject="user@test.com",
            expires_delta=timedelta(seconds=-1),
        )
        assert verify_token(token) is None

    def test_decode_expired_unsafe(self):
        token = create_access_token(
            subject="user@test.com",
            expires_delta=timedelta(seconds=-1),
        )
        payload = decode_token_unsafe(token)
        assert payload is not None
        assert payload["sub"] == "user@test.com"

    def test_extra_claims(self):
        token = create_access_token(
            subject="user@test.com",
            extra_claims={"role": "admin"},
        )
        payload = verify_token(token)
        assert payload["role"] == "admin"

    def test_invalid_token(self):
        assert verify_token("not.a.token") is None
