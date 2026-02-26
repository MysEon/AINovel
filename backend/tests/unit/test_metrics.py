"""指标收集器单元测试"""

from app.core.metrics import MetricsCollector, _Counter, _Histogram


class TestCounter:

    def test_inc(self):
        c = _Counter()
        c.inc()
        c.inc(5)
        assert c.value == 6


class TestHistogram:

    def test_observe(self):
        h = _Histogram()
        h.observe(10.0)
        h.observe(20.0)
        snap = h.snapshot()
        assert snap["count"] == 2
        assert snap["avg"] == 15.0
        assert snap["min"] == 10.0
        assert snap["max"] == 20.0

    def test_empty_snapshot(self):
        h = _Histogram()
        snap = h.snapshot()
        assert snap["count"] == 0


class TestMetricsCollector:

    def test_record_request(self):
        m = MetricsCollector()
        m.record_request(200, 15.5)
        m.record_request(500, 120.0)
        snap = m.snapshot()
        assert snap["http"]["requests_total"] == 2
        assert snap["http"]["errors_total"] == 1
        assert snap["http"]["status_codes"][200] == 1
        assert snap["http"]["status_codes"][500] == 1

    def test_record_ai_run(self):
        m = MetricsCollector()
        m.record_ai_run(succeeded=True, duration_s=3.5, tokens=1500)
        m.record_ai_run(succeeded=False, duration_s=1.0)
        snap = m.snapshot()
        assert snap["ai"]["runs_total"] == 2
        assert snap["ai"]["runs_succeeded"] == 1
        assert snap["ai"]["runs_failed"] == 1
        assert snap["ai"]["tokens_used"] == 1500

    def test_record_provider(self):
        m = MetricsCollector()
        m.record_provider_call("openai")
        m.record_provider_call("openai", error=True)
        snap = m.snapshot()
        assert snap["providers"]["calls"]["openai"] == 2
        assert snap["providers"]["errors"]["openai"] == 1

    def test_record_node(self):
        m = MetricsCollector()
        m.record_node("generate", 2.5)
        m.record_node("generate", 3.5)
        snap = m.snapshot()
        assert snap["nodes"]["generate"]["count"] == 2
        assert snap["nodes"]["generate"]["avg"] == 3.0
