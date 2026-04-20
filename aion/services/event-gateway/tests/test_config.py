import os
import pytest

from app.config import Config


@pytest.fixture
def min_env(monkeypatch):
    monkeypatch.setenv("PG_DSN", "postgresql://u:p@h:5432/d")
    monkeypatch.setenv("MQTT_USER", "user")
    monkeypatch.setenv("MQTT_PASSWORD", "pass")


class TestConfig:
    def test_defaults(self, min_env):
        cfg = Config.from_env()
        assert cfg.pg_channel == "aion_event"
        assert cfg.mqtt_host == "127.0.0.1"
        assert cfg.mqtt_port == 1883
        assert cfg.mqtt_topic_prefix == "aion/events"
        assert cfg.log_level == "INFO"

    def test_overrides(self, min_env, monkeypatch):
        monkeypatch.setenv("PG_CHANNEL", "custom_channel")
        monkeypatch.setenv("MQTT_HOST", "mqtt.example.com")
        monkeypatch.setenv("MQTT_PORT", "8883")
        monkeypatch.setenv("MQTT_TOPIC_PREFIX", "custom/prefix")
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")

        cfg = Config.from_env()
        assert cfg.pg_channel == "custom_channel"
        assert cfg.mqtt_host == "mqtt.example.com"
        assert cfg.mqtt_port == 8883
        assert cfg.mqtt_topic_prefix == "custom/prefix"
        assert cfg.log_level == "DEBUG"

    def test_missing_pg_dsn_raises(self, monkeypatch):
        monkeypatch.delenv("PG_DSN", raising=False)
        monkeypatch.setenv("MQTT_USER", "u")
        monkeypatch.setenv("MQTT_PASSWORD", "p")
        with pytest.raises(KeyError):
            Config.from_env()

    def test_missing_mqtt_user_raises(self, monkeypatch):
        monkeypatch.setenv("PG_DSN", "postgresql://u:p@h:5432/d")
        monkeypatch.setenv("MQTT_PASSWORD", "p")
        monkeypatch.delenv("MQTT_USER", raising=False)
        with pytest.raises(KeyError):
            Config.from_env()

    def test_frozen_cannot_mutate(self, min_env):
        cfg = Config.from_env()
        with pytest.raises((AttributeError, TypeError)):
            cfg.pg_channel = "mutated"
