"""Tests for configuration loading."""

from app.config import Settings


class TestSettings:
    def test_defaults(self):
        s = Settings(
            _env_file=None,
            HIK_BRIDGE_HOST="0.0.0.0",
            HIK_BRIDGE_PORT=8100,
        )
        assert s.host == "0.0.0.0"
        assert s.port == 8100
        assert s.max_connections == 50
        assert s.heartbeat_interval == 30
        assert s.reconnect_max_delay == 300
        assert s.login_timeout == 10
        assert s.search_timeout == 30
        assert s.download_timeout == 300
        assert s.log_level == "info"

    def test_custom_values(self):
        s = Settings(
            _env_file=None,
            HIK_BRIDGE_PORT=9000,
            HIK_BRIDGE_API_KEY="my-key",
            HIK_MAX_CONNECTIONS=100,
            LOG_LEVEL="debug",
        )
        assert s.port == 9000
        assert s.api_key == "my-key"
        assert s.max_connections == 100
        assert s.log_level == "debug"

    def test_redis_url_default(self):
        s = Settings(_env_file=None)
        assert s.redis_url == "redis://localhost:6379/3"

    def test_aion_api_url_default(self):
        s = Settings(_env_file=None)
        assert s.aion_api_url == "http://localhost:3001"
