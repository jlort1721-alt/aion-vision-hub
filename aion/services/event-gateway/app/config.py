import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    pg_dsn: str
    pg_channel: str
    mqtt_host: str
    mqtt_port: int
    mqtt_user: str
    mqtt_password: str
    mqtt_topic_prefix: str
    log_level: str

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            pg_dsn=os.environ["PG_DSN"],
            pg_channel=os.environ.get("PG_CHANNEL", "aion_event"),
            mqtt_host=os.environ.get("MQTT_HOST", "127.0.0.1"),
            mqtt_port=int(os.environ.get("MQTT_PORT", "1883")),
            mqtt_user=os.environ["MQTT_USER"],
            mqtt_password=os.environ["MQTT_PASSWORD"],
            mqtt_topic_prefix=os.environ.get("MQTT_TOPIC_PREFIX", "aion/events"),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )
