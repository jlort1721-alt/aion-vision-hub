import asyncio
import json
import logging
import signal
import sys
from contextlib import asynccontextmanager

import asyncpg
import paho.mqtt.client as mqtt
from fastapi import FastAPI
from pythonjsonlogger import jsonlogger

from .canonical import build_canonical, topic_for
from .config import Config


def setup_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s",
            rename_fields={"asctime": "ts", "levelname": "level"},
        )
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


log = logging.getLogger("event-gateway")


class State:
    def __init__(self) -> None:
        self.published = 0
        self.failed = 0
        self.pg_conn: asyncpg.Connection | None = None
        self.mqtt_client: mqtt.Client | None = None
        self.ready = False


STATE = State()


def build_mqtt_client(cfg: Config) -> mqtt.Client:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="aion-event-gateway")
    client.username_pw_set(cfg.mqtt_user, cfg.mqtt_password)
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    def on_connect(c, userdata, flags, rc, props=None):
        if rc == 0:
            log.info("mqtt_connected", extra={"host": cfg.mqtt_host, "port": cfg.mqtt_port})
            STATE.ready = True
        else:
            log.error("mqtt_connect_failed", extra={"rc": str(rc)})
            STATE.ready = False

    def on_disconnect(c, userdata, flags, rc, props=None):
        log.warning("mqtt_disconnected", extra={"rc": str(rc)})
        STATE.ready = False

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.connect(cfg.mqtt_host, cfg.mqtt_port, keepalive=30)
    client.loop_start()
    return client


async def pg_listener(cfg: Config) -> None:
    while True:
        try:
            conn = await asyncpg.connect(cfg.pg_dsn)
            STATE.pg_conn = conn
            log.info("pg_connected", extra={"channel": cfg.pg_channel})

            def handler(conn, pid, channel, payload):
                try:
                    parsed = json.loads(payload)
                    canonical = build_canonical(parsed)
                    topic = topic_for(canonical, cfg.mqtt_topic_prefix)
                    if STATE.mqtt_client is None:
                        STATE.failed += 1
                        return
                    result = STATE.mqtt_client.publish(topic, json.dumps(canonical), qos=1)
                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        STATE.published += 1
                        if STATE.published % 50 == 1:
                            log.info(
                                "published_batch",
                                extra={
                                    "count": STATE.published,
                                    "topic_example": topic,
                                    "category": canonical["category"],
                                },
                            )
                    else:
                        STATE.failed += 1
                        log.warning("mqtt_publish_failed", extra={"rc": str(result.rc)})
                except Exception as exc:
                    STATE.failed += 1
                    log.error("handler_error", extra={"err": str(exc)})

            await conn.add_listener(cfg.pg_channel, handler)
            while True:
                await asyncio.sleep(60)
        except Exception as exc:
            log.error("pg_listener_reconnect", extra={"err": str(exc)})
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = Config.from_env()
    setup_logging(cfg.log_level)
    STATE.mqtt_client = build_mqtt_client(cfg)
    task = asyncio.create_task(pg_listener(cfg))
    log.info("event_gateway_started", extra={"pg_channel": cfg.pg_channel})
    try:
        yield
    finally:
        task.cancel()
        if STATE.pg_conn is not None:
            await STATE.pg_conn.close()
        if STATE.mqtt_client is not None:
            STATE.mqtt_client.loop_stop()
            STATE.mqtt_client.disconnect()


app = FastAPI(title="aion-event-gateway", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    if STATE.ready and STATE.pg_conn is not None and not STATE.pg_conn.is_closed():
        return {"status": "ready"}
    return {"status": "starting", "mqtt_ready": STATE.ready}, 503


@app.get("/metrics-lite")
def metrics_lite():
    return {
        "published": STATE.published,
        "failed": STATE.failed,
        "mqtt_ready": STATE.ready,
        "pg_connected": STATE.pg_conn is not None and not STATE.pg_conn.is_closed(),
    }
