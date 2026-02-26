"""
健康检查端点
- /health/live  进程存活探针 (K8s liveness)
- /health/ready 就绪探针 (K8s readiness)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def liveness():
    """进程存活检查"""
    return {"status": "ok"}


@router.get("/ready")
async def readiness():
    """就绪检查：验证关键依赖可用"""
    checks = {}

    # TODO Phase 2: 数据库连接检查
    # try:
    #     async with get_session() as session:
    #         await session.execute(text("SELECT 1"))
    #     checks["database"] = "ok"
    # except Exception:
    #     checks["database"] = "fail"

    all_ok = all(v == "ok" for v in checks.values()) if checks else True
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
