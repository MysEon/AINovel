"""
API 契约测试 — 用 Schemathesis v4 自动验证所有端点符合 OpenAPI schema

运行方式：
    conda activate ainovel && pytest tests/contract/ -v

当前策略：
- @schema.parametrize() 为每个 API operation 生成一个 pytest 用例
- case.call_and_validate() 同时发送请求并校验响应符合 schema
- 动态 auth 由 conftest 中的 TokenAuth 全局注入（公开端点已 skip）
- SSE / Admin / health-diag 端点在 Python 层再跳过一层，确保与 TOML 配置双保险
"""

import pytest
import schemathesis.pytest
from schemathesis.specs.openapi.checks import (
    positive_data_acceptance,
    status_code_conformance,
    unsupported_method,
)

# 延迟从 fixture 加载 schema，避免 import 时就需要 app 实例
schema = schemathesis.pytest.from_fixture("api_schema")

# 禁用三类预期内的 Schemathesis 检查噪音（与 schemathesis.toml 双保险）
_EXCLUDED_CHECKS = [
    status_code_conformance,   # 随机 ID 请求返回 404 是预期行为
    unsupported_method,        # FastAPI 路由匹配导致 422 而非 405
    positive_data_acceptance,  # Schemathesis 生成 null 值触发 422
]


@schema.parametrize()
def test_api(case):
    """自动为每个 API operation 做契约验证"""
    # SSE / stream 端点：EventSourceResponse / StreamingResponse 不适合普通 HTTP 测试
    if case.path in (
        "/api/v1/ai/runs/{run_id}/stream",
        "/api/v1/ai/runs/{run_id}/start-stream",
        "/api/ai/chat-stream",
    ):
        pytest.skip("SSE / stream 端点不适合普通 HTTP 契约测试")

    # Admin 端点：需要 superuser 权限
    if case.path.startswith("/api/v1/admin"):
        pytest.skip("Admin 端点需要 superuser 权限")

    # Health diag：仅 dev 环境开放，响应内容随运行时变化
    if case.path == "/health/diag":
        pytest.skip("Health diag 端点仅 dev 环境开放，不适合契约测试")

    case.call_and_validate(excluded_checks=_EXCLUDED_CHECKS)
