"""
中间件模块
- RequestID 中间件：为每个请求生成唯一 trace id，写入 ContextVar
- CORS 配置：按环境区分白名单
- Rate Limit：集成 slowapi
"""

import uuid
import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import request_id_var

logger = logging.getLogger(__name__)

# 向后兼容：旧代码若 import request_id_ctx 仍可用
request_id_ctx = request_id_var


class RequestIDMiddleware(BaseHTTPMiddleware):
    """为每个请求注入 X-Request-ID，并记录耗时"""

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
        request_id_var.set(rid)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        response.headers["X-Request-ID"] = rid
        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method, request.url.path,
            response.status_code, elapsed_ms,
        )
        return response


def setup_cors(app, settings) -> None:
    """根据配置注册 CORS 中间件"""
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allowed_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=settings.cors.allow_methods,
        allow_headers=settings.cors.allow_headers,
    )


# Rate limiter 实例（全局，供各路由装饰器引用）
from slowapi import Limiter
from slowapi.util import get_remote_address


def _auth_key_func(request: Request) -> str:
    """基于 Authorization header 做用户级限流 key"""
    auth = request.headers.get("Authorization", "")
    if auth:
        return f"user:{auth}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=get_remote_address, config_filename='')
