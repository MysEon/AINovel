"""
统一异常定义
所有业务异常继承自 AppException
"""

from typing import Any


class AppException(Exception):
    """应用异常基类"""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "服务器内部错误"

    def __init__(self, message: str | None = None, detail: Any = None):
        self.message = message or self.__class__.message
        self.detail = detail
        super().__init__(self.message)


# ── 具体业务异常 ──────────────────────────────────────────────


class NotFoundError(AppException):
    """资源不存在"""

    status_code = 404
    error_code = "NOT_FOUND"
    message = "请求的资源不存在"


class UnauthorizedError(AppException):
    """未认证 / Token 无效"""

    status_code = 401
    error_code = "UNAUTHORIZED"
    message = "未认证或认证已过期"


class ForbiddenError(AppException):
    """无权限访问"""

    status_code = 403
    error_code = "FORBIDDEN"
    message = "无权访问该资源"


class ValidationError(AppException):
    """业务校验失败"""

    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "请求参数校验失败"


class ConflictError(AppException):
    """资源冲突（如重复创建）"""

    status_code = 409
    error_code = "CONFLICT"
    message = "资源冲突"


class ExternalServiceError(AppException):
    """外部服务调用失败（LLM / 第三方 API）"""

    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"
    message = "外部服务调用失败"


# ── FastAPI 异常处理器注册 ────────────────────────────────────


def _build_error_body(
    error_code: str,
    message: str,
    detail: Any = None,
) -> dict:
    """统一错误响应结构"""
    body: dict = {
        "success": False,
        "error_code": error_code,
        "message": message,
    }
    if detail is not None:
        body["detail"] = detail
    return body


def register_exception_handlers(app) -> None:
    """向 FastAPI 应用注册全局异常处理器"""
    import logging

    from fastapi import Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse
    from sqlalchemy.exc import SQLAlchemyError

    logger = logging.getLogger(__name__)

    @app.exception_handler(AppException)
    async def app_exception_handler(_req: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_body(exc.error_code, exc.message, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_build_error_body(
                "VALIDATION_ERROR",
                "请求参数校验失败",
                exc.errors(),
            ),
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(_req: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.error("数据库异常: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content=_build_error_body("DATABASE_ERROR", "数据库操作失败"),
        )

    # Rate Limit 异常处理
    try:
        from slowapi.errors import RateLimitExceeded

        @app.exception_handler(RateLimitExceeded)
        async def rate_limit_handler(_req: Request, exc: RateLimitExceeded) -> JSONResponse:
            from app.core.logging import request_id_var

            trace_id = request_id_var.get("")
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "message": "请求过于频繁，请稍后再试",
                    "trace_id": trace_id,
                },
            )
    except ImportError:
        pass

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_req: Request, exc: Exception) -> JSONResponse:
        logger.error("未处理异常: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content=_build_error_body("INTERNAL_ERROR", "服务器内部错误"),
        )
