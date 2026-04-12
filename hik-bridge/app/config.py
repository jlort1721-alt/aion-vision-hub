"""AION Hikvision Bridge — Configuration from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from .env file or environment."""

    # Server
    host: str = Field(default="0.0.0.0", alias="HIK_BRIDGE_HOST")
    port: int = Field(default=8100, alias="HIK_BRIDGE_PORT")

    # Authentication
    api_key: str = Field(default="", alias="HIK_BRIDGE_API_KEY")

    # AION Backend
    aion_api_url: str = Field(default="http://localhost:3001", alias="AION_API_URL")
    aion_api_key: str = Field(default="", alias="AION_API_KEY")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/3", alias="REDIS_URL")

    # HCNetSDK
    sdk_lib_path: str = Field(
        default="/opt/aion/hik-bridge/venv/lib/python3.11/site-packages/hikvision_sdk/lib",
        alias="HIK_SDK_LIB_PATH",
    )
    sdk_log_dir: str = Field(
        default="/var/log/aion/hik-bridge/sdk", alias="HIK_SDK_LOG_DIR"
    )
    sdk_log_level: int = Field(default=3, alias="HIK_SDK_LOG_LEVEL")

    # Storage
    snapshots_dir: str = Field(
        default="/opt/aion/hik-bridge/snapshots", alias="HIK_SNAPSHOTS_DIR"
    )
    downloads_dir: str = Field(
        default="/opt/aion/hik-bridge/downloads", alias="HIK_DOWNLOADS_DIR"
    )

    # Connection pool
    max_connections: int = Field(default=50, alias="HIK_MAX_CONNECTIONS")
    heartbeat_interval: int = Field(default=30, alias="HIK_HEARTBEAT_INTERVAL")
    reconnect_max_delay: int = Field(default=300, alias="HIK_RECONNECT_MAX_DELAY")
    login_timeout: int = Field(default=10, alias="HIK_LOGIN_TIMEOUT")
    search_timeout: int = Field(default=30, alias="HIK_SEARCH_TIMEOUT")
    download_timeout: int = Field(default=300, alias="HIK_DOWNLOAD_TIMEOUT")

    # Logging
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "populate_by_name": True,
    }


settings = Settings()
