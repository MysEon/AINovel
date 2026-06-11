"""
健康检查 & 运维端点
- /health/live   进程存活探针 (K8s liveness)
- /health/ready  就绪探针 (K8s readiness) — 含 DB 检查
- /health/metrics 指标快照（仅 dev/内部环境）
- /health/diag   运行时诊断（仅 dev）
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def liveness():
    """进程存活检查"""
    return {"status": "ok"}


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """就绪检查：验证关键依赖可用"""
    checks = {}

    # 数据库连接检查
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.warning("readiness: database check failed: %s", e)
        checks["database"] = "fail"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }


@router.get("/metrics")
async def metrics_snapshot():
    """指标快照（供运维 / 监控拉取）"""
    from app.core.metrics import metrics
    return metrics.snapshot()


@router.get("/diag")
async def diagnostics(db: AsyncSession = Depends(get_db)):
    """运行时诊断（仅 dev / 内部环境开放）"""
    import sys
    import asyncio
    from app.core.config import get_settings
    from app.infrastructure.task.runner import background_runner

    settings = get_settings()
    if settings.is_prod:
        return {"error": "diagnostics disabled in production"}

    return {
        "python_version": sys.version,
        "env": settings.app.env,
        "app_version": settings.app.app_version,
        "debug": settings.app.debug,
        "db_url_masked": settings.db.url.split("@")[-1] if "@" in settings.db.url else "(local)",
        "background_tasks_active": background_runner.active_count,
        "asyncio_tasks": len(asyncio.all_tasks()),
    }
