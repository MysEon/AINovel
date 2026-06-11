# ── AINovel Backend ──
# 多阶段构建：依赖安装 → 运行镜像

FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim AS runtime

# 非 root 用户
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /usr/local/bin /usr/local/bin

# 仅复制应用代码（排除测试、文档等）
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY requirements.txt .

# 创建数据目录并设置权限
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/live')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
