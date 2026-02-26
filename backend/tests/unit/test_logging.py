"""日志模块单元测试 — 脱敏 + ContextFilter"""

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")
os.environ.setdefault("DB_URL", "sqlite+aiosqlite:///:memory:")

import logging
from app.core.logging import (
    sanitize_value,
    sanitize_header,
    ContextFilter,
    request_id_var,
    run_id_var,
)


class TestSanitize:

    def test_mask_api_key(self):
        result = sanitize_value("api_key", "sk-1234567890abcdef")
        assert "sk-1" in result
        assert "cdef" in result
        assert "1234567890abcde" not in result

    def test_mask_short_secret(self):
        result = sanitize_value("secret", "short")
        assert result == "***"

    def test_non_sensitive_passthrough(self):
        result = sanitize_value("username", "alice")
        assert result == "alice"

    def test_mask_authorization(self):
        result = sanitize_value("authorization", "Bearer eyJhbGciOiJIUzI1NiJ9")
        assert "***" in result

    def test_sanitize_bearer_header(self):
        result = sanitize_header("Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")
        assert result == "Bearer ***"

    def test_sanitize_no_bearer(self):
        result = sanitize_header("Basic dXNlcjpwYXNz")
        assert result == "Basic dXNlcjpwYXNz"
