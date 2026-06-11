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
from app.core.middleware import RequestIDMiddleware, setup_cors, limiter
from app.infrastructure.db.session import get_async_engine, dispose_engine


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动自检 / 资源预热 / 资源释放"""
    settings = get_settings()
    logger.info(
        "AINovel API 启动 | env=%s | version=%s",
        settings.app.env, settings.app.app_version,
    )

    # ── 启动配置自检 ──
    _startup_checks(settings)

    # 数据库连接池预热
    get_async_engine()
    logger.info("数据库引擎已初始化")

    yield

    # 资源释放
    await dispose_engine()
    logger.info("AINovel API 关闭")


def _startup_checks(settings) -> None:
    """启动时校验关键配置，缺失则 fail-fast"""
    errors = []
    warnings = []

    # JWT 密钥长度
    if len(settings.auth.secret_key) < 32:
        errors.append("AUTH_SECRET_KEY 长度不足 32 字符")

    # 生产环境额外检查
    if settings.is_prod:
        if settings.app.debug:
            errors.append("生产环境不应开启 debug 模式")
        if "sqlite" in settings.db.url.lower():
            errors.append("生产环境不应使用 SQLite")
        if not settings.encryption.encryption_key:
            warnings.append(
                "生产环境建议显式设置 ENCRYPTION_KEY，"
                "当前从 AUTH_SECRET_KEY 派生，若轮换 JWT 密钥将导致加密数据无法解密"
            )

    if warnings:
        for w in warnings:
            logger.warning("启动自检警告: %s", w)

    if errors:
        for e in errors:
            logger.error("启动自检失败: %s", e)
        raise RuntimeError(f"启动自检失败: {'; '.join(errors)}")


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

    # 3. Rate limiter state 注入（供装饰器使用）
    app.state.limiter = limiter

    # 4. 中间件（注册顺序：后注册先执行）
    from slowapi.middleware import SlowAPIMiddleware
    app.add_middleware(SlowAPIMiddleware)
    setup_cors(app, settings)
    app.add_middleware(RequestIDMiddleware)

    # 5. 异常处理器
    register_exception_handlers(app)

    # 6. 路由注册
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """集中注册所有路由（受 FeatureFlags 控制）"""
    settings = get_settings()

    from app.api.v1 import health, auth, projects, chapters, worldbuilding, drafts
    from app.api.v1 import prompt_templates, model_configs
    from app.api.v1 import ai
    from app.api.v1 import knowledge
    from app.api.v1 import admin

    # 健康检查（无前缀）
    app.include_router(health.router)

    # 认证
    app.include_router(auth.router)

    # 核心业务
    app.include_router(projects.router)
    app.include_router(chapters.router)
    app.include_router(worldbuilding.router)
    app.include_router(drafts.router)

    # AI 辅助
    app.include_router(prompt_templates.router)
    app.include_router(model_configs.router)
    app.include_router(ai.router)

    # 知识库
    app.include_router(knowledge.router)

    # Admin
    app.include_router(admin.router)

    # 旧接口兼容层（受 Feature Flag 控制）
    if settings.ff.enable_legacy_compat:
        from app.api.v1 import ai_compat
        app.include_router(ai_compat.router)
        logger.info("旧接口兼容层已挂载（FF_ENABLE_LEGACY_COMPAT=true）")
    else:
        logger.info("旧接口兼容层已禁用")


# uvicorn 入口: uvicorn app.main:app --reload
app = create_app()
