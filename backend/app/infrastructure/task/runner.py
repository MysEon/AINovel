"""
后台任务运行器 — 轻量级 asyncio 方案

职责：
- 将长耗时 AI 图运行放入后台执行，不阻塞 API 响应
- 管理任务生命周期（提交、超时、取消）
- 预留队列升级接口（Celery/Arq 等）

注意：当前为单进程方案，适合中小规模。
生产环境建议升级为外部队列 + Worker。
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 默认超时 5 分钟
DEFAULT_TIMEOUT = 300


class TaskInfo:
    """后台任务元数据"""
    __slots__ = ("run_id", "task", "created_at", "timeout")

    def __init__(self, run_id: int, task: asyncio.Task, timeout: int):
        self.run_id = run_id
        self.task = task
        self.created_at = datetime.now(timezone.utc)
        self.timeout = timeout


class BackgroundTaskRunner:
    """
    后台任务运行器（单例）

    用法：
        runner = BackgroundTaskRunner()
        runner.submit(run_id, coroutine, timeout=300)
        runner.cancel(run_id)
        info = runner.get_status(run_id)
    """

    def __init__(self):
        self._tasks: dict[int, TaskInfo] = {}

    def submit(
        self, run_id: int, coro, *, timeout: int = DEFAULT_TIMEOUT,
    ) -> TaskInfo:
        """提交后台任务"""
        if run_id in self._tasks:
            existing = self._tasks[run_id]
            if not existing.task.done():
                logger.warning("run %s already has a running task, skipping", run_id)
                return existing

        async def _wrapped():
            try:
                await asyncio.wait_for(coro, timeout=timeout)
            except asyncio.TimeoutError:
                logger.error("run %s timed out after %ds", run_id, timeout)
            except asyncio.CancelledError:
                logger.info("run %s was cancelled", run_id)
            except Exception:
                logger.exception("run %s failed", run_id)
            finally:
                self._tasks.pop(run_id, None)

        task = asyncio.create_task(_wrapped(), name=f"ai-run-{run_id}")
        info = TaskInfo(run_id, task, timeout)
        self._tasks[run_id] = info
        logger.info("submitted background task for run %s (timeout=%ds)", run_id, timeout)
        return info

    def cancel(self, run_id: int) -> bool:
        """取消后台任务"""
        info = self._tasks.get(run_id)
        if not info or info.task.done():
            return False
        info.task.cancel()
        logger.info("cancelled background task for run %s", run_id)
        return True

    def get_status(self, run_id: int) -> Optional[dict]:
        """查询任务状态"""
        info = self._tasks.get(run_id)
        if not info:
            return None
        return {
            "run_id": run_id,
            "running": not info.task.done(),
            "cancelled": info.task.cancelled() if info.task.done() else False,
            "created_at": info.created_at.isoformat(),
            "timeout": info.timeout,
        }

    @property
    def active_count(self) -> int:
        return sum(1 for t in self._tasks.values() if not t.task.done())

    def cleanup_done(self) -> int:
        """清理已完成的任务记录"""
        done_ids = [rid for rid, t in self._tasks.items() if t.task.done()]
        for rid in done_ids:
            del self._tasks[rid]
        return len(done_ids)


# 全局单例
background_runner = BackgroundTaskRunner()
