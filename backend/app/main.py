"""
FastAPI 应用工厂
职责：创建应用、注册中间件、注册路由、注册异常处理、生命周期事件
禁止在此处执行建表逻辑
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestIDMiddleware, setup_cors
from app.infrastructure.db.session import get_async_engine, dispose_engine


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动检查 / 资源释放"""
    settings = get_settings()
    logger.info(
        "AINovel API 启动 | env=%s | version=%s",
        settings.app.env, settings.app.app_version,
    )
    # 数据库连接池预热
    get_async_engine()
    logger.info("数据库引擎已初始化")
    # TODO Phase 9: 队列 Worker 启动
    yield
    # 资源释放
    await dispose_engine()
    logger.info("AINovel API 关闭")


def create_app() -> FastAPI:
    """应用工厂"""
    settings = get_settings()

    # 1. 日志初始化（最先执行）
    setup_logging(env=settings.app.env)

    # 2. 创建 FastAPI 实例
    app = FastAPI(
        title=settings.app.app_name,
        version=settings.app.app_version,
        docs_url="/docs" if settings.is_dev else None,
        redoc_url="/redoc" if settings.is_dev else None,
        lifespan=lifespan,
    )

    # 3. 中间件（注册顺序：后注册先执行）
    setup_cors(app, settings)
    app.add_middleware(RequestIDMiddleware)

    # 4. 异常处理器
    register_exception_handlers(app)

    # 5. 路由注册
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """集中注册所有路由"""
    from app.api.v1 import health
    from app.api.v1 import auth

    # 健康检查（无前缀）
    app.include_router(health.router)

    # 认证
    app.include_router(auth.router)

    # TODO Phase 4: projects / chapters 路由
    # TODO Phase 5: prompts / model-configs 路由
    # TODO Phase 7: ai 路由


# uvicorn 入口: uvicorn app.main:app --reload
app = create_app()
