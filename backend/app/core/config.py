"""
应用配置管理
使用 Pydantic Settings 统一管理所有配置项
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class AppSettings(BaseSettings):
    """应用基础配置"""
    app_name: str = "AINovel API"
    app_version: str = "0.2.0"
    debug: bool = False
    env: str = Field(default="dev", pattern="^(dev|test|prod)$")

    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


class DatabaseSettings(BaseSettings):
    """数据库配置"""
    url: str = Field(
        default="sqlite+aiosqlite:///./ainovel.db",
        description="异步数据库连接URL",
    )
    sync_url: str = Field(
        default="sqlite:///./ainovel.db",
        description="同步数据库连接URL (Alembic迁移用)",
    )
    echo: bool = False
    pool_pre_ping: bool = True
    pool_recycle: int = 3600

    model_config = SettingsConfigDict(
        env_prefix="DB_",
        env_file=".env",
        extra="ignore",
    )


class AuthSettings(BaseSettings):
    """认证配置"""
    secret_key: str = Field(
        ...,
        min_length=32,
        description="JWT签名密钥，生产环境必须配置",
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7  # 7天

    model_config = SettingsConfigDict(
        env_prefix="AUTH_",
        env_file=".env",
        extra="ignore",
    )


class EncryptionSettings(BaseSettings):
    """加密配置"""
    encryption_key: Optional[str] = Field(
        default=None,
        description="独立加密密钥（可选），未设置时从 AUTH_SECRET_KEY 派生",
    )
    pbkdf2_iterations: int = Field(
        default=480_000,
        description="PBKDF2 迭代次数（OWASP 2023 推荐）",
    )

    model_config = SettingsConfigDict(
        env_prefix="ENCRYPTION_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


class CORSSettings(BaseSettings):
    """CORS配置"""
    allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="允许的来源列表",
    )
    allow_credentials: bool = True
    allow_methods: List[str] = ["*"]
    allow_headers: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_prefix="CORS_",
        env_file=".env",
        extra="ignore",
    )


class FeatureFlags(BaseSettings):
    """功能开关 — 灰度切换控制"""
    use_new_ai_runtime: bool = Field(
        default=True,
        description="启用新 LangGraph AI Runtime（False 则走旧兼容层）",
    )
    enable_legacy_compat: bool = Field(
        default=True,
        description="是否挂载旧 /api/ai/* 兼容端点",
    )
    enable_metrics: bool = Field(
        default=True,
        description="是否暴露 /health/metrics 端点",
    )

    model_config = SettingsConfigDict(
        env_prefix="FF_",
        env_file=".env",
        extra="ignore",
    )


class Settings:
    """聚合所有配置，统一入口"""

    def __init__(self):
        self.app = AppSettings()
        self.db = DatabaseSettings()
        self.auth = AuthSettings()
        self.encryption = EncryptionSettings()
        self.cors = CORSSettings()
        self.ff = FeatureFlags()

    @property
    def is_dev(self) -> bool:
        return self.app.env == "dev"

    @property
    def is_prod(self) -> bool:
        return self.app.env == "prod"

    @property
    def is_test(self) -> bool:
        return self.app.env == "test"


def get_settings() -> Settings:
    """获取全局配置实例"""
    return Settings()
