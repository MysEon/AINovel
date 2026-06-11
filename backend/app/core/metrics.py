"""
轻量级指标收集器（内存方案）

职责：
- 收集请求量、响应时间、错误率
- 收集 AI run 成功率、耗时、token 使用量
- 提供 /metrics 端点供运维查询
- 预留 Prometheus 导出接口

注意：单进程内存方案，重启后清零。
生产环境建议接入 Prometheus / StatsD。
"""

import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class _Counter:
    """线程安全计数器"""

    _value: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def inc(self, n: int = 1) -> None:
        with self._lock:
            self._value += n

    @property
    def value(self) -> int:
        return self._value


@dataclass
class _Histogram:
    """简易直方图（只记录 count / sum / min / max）"""

    count: int = 0
    total: float = 0.0
    min_val: float = float("inf")
    max_val: float = 0.0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def observe(self, val: float) -> None:
        with self._lock:
            self.count += 1
            self.total += val
            if val < self.min_val:
                self.min_val = val
            if val > self.max_val:
                self.max_val = val

    def snapshot(self) -> dict:
        if self.count == 0:
            return {"count": 0, "avg": 0, "min": 0, "max": 0}
        return {
            "count": self.count,
            "avg": round(self.total / self.count, 2),
            "min": round(self.min_val, 2),
            "max": round(self.max_val, 2),
        }


class MetricsCollector:
    """全局指标收集器（单例）"""

    def __init__(self):
        # ── HTTP 请求指标 ──
        self.http_requests = _Counter()
        self.http_errors = _Counter()  # 4xx + 5xx
        self.http_latency = _Histogram()  # ms
        self.http_status: dict[int, int] = defaultdict(int)

        # ── AI Run 指标 ──
        self.ai_runs_total = _Counter()
        self.ai_runs_succeeded = _Counter()
        self.ai_runs_failed = _Counter()
        self.ai_run_latency = _Histogram()  # seconds
        self.ai_tokens_used = _Counter()

        # ── Provider 指标 ──
        self.provider_calls: dict[str, int] = defaultdict(int)
        self.provider_errors: dict[str, int] = defaultdict(int)

        # ── Graph 节点指标 ──
        self.node_latency: dict[str, _Histogram] = defaultdict(_Histogram)

        self._started_at = time.time()

    # ── HTTP 记录 ──

    def record_request(self, status_code: int, latency_ms: float) -> None:
        self.http_requests.inc()
        self.http_latency.observe(latency_ms)
        self.http_status[status_code] = self.http_status.get(status_code, 0) + 1
        if status_code >= 400:
            self.http_errors.inc()

    # ── AI Run 记录 ──

    def record_ai_run(
        self,
        *,
        succeeded: bool,
        duration_s: float,
        tokens: int = 0,
    ) -> None:
        self.ai_runs_total.inc()
        if succeeded:
            self.ai_runs_succeeded.inc()
        else:
            self.ai_runs_failed.inc()
        self.ai_run_latency.observe(duration_s)
        if tokens:
            self.ai_tokens_used.inc(tokens)

    def record_provider_call(self, provider: str, error: bool = False) -> None:
        self.provider_calls[provider] = self.provider_calls.get(provider, 0) + 1
        if error:
            self.provider_errors[provider] = self.provider_errors.get(provider, 0) + 1

    def record_node(self, node_name: str, duration_s: float) -> None:
        self.node_latency[node_name].observe(duration_s)

    # ── 快照导出 ──

    def snapshot(self) -> dict:
        """导出当前指标快照（供 /metrics 端点使用）"""
        uptime = round(time.time() - self._started_at, 1)
        return {
            "uptime_seconds": uptime,
            "http": {
                "requests_total": self.http_requests.value,
                "errors_total": self.http_errors.value,
                "latency_ms": self.http_latency.snapshot(),
                "status_codes": dict(self.http_status),
            },
            "ai": {
                "runs_total": self.ai_runs_total.value,
                "runs_succeeded": self.ai_runs_succeeded.value,
                "runs_failed": self.ai_runs_failed.value,
                "run_latency_s": self.ai_run_latency.snapshot(),
                "tokens_used": self.ai_tokens_used.value,
            },
            "providers": {
                "calls": dict(self.provider_calls),
                "errors": dict(self.provider_errors),
            },
            "nodes": {name: hist.snapshot() for name, hist in self.node_latency.items()},
        }


# 全局单例
metrics = MetricsCollector()
