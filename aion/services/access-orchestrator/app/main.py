"""
access-orchestrator — ejecuta comandos físicos contra controladores
Hikvision AccessControl vía ISAPI HTTP.

Flujo:
  1. Subscribe MQTT aion/events/system/aion_db (trigger de INSERT en
     access_door_events con event_type='remote_open_requested').
  2. Lee metadata → device_ip, device_port, command_id, duration_seconds.
  3. Ejecuta PUT ISAPI /ISAPI/AccessControl/RemoteControl/door/1 con digest auth.
  4. INSERT access_door_events con event_type='door_opened' o 'door_open_failed'.
"""
import asyncio
import json
import logging
import os
import sys
import time
from typing import Any

import asyncpg
import httpx
import paho.mqtt.client as mqtt
from pythonjsonlogger import jsonlogger


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s",
            rename_fields={"asctime": "ts", "levelname": "level"},
        )
    )
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


log = logging.getLogger("access-orchestrator")


class Config:
    pg_dsn: str
    mqtt_host: str
    mqtt_port: int
    mqtt_user: str
    mqtt_password: str
    topic_filter: str
    hik_user: str
    hik_pass_default: str
    hik_pass_alt: str

    @classmethod
    def load(cls) -> "Config":
        c = cls()
        c.pg_dsn = os.environ["PG_DSN"]
        c.mqtt_host = os.environ.get("MQTT_HOST", "host.docker.internal")
        c.mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
        c.mqtt_user = os.environ["MQTT_USER"]
        c.mqtt_password = os.environ["MQTT_PASSWORD"]
        c.topic_filter = os.environ.get("TOPIC_FILTER", "aion/events/system/aion_db")
        c.hik_user = os.environ.get("HIK_USER", "admin")
        c.hik_pass_default = os.environ["HIK_PASS_DEFAULT"]
        c.hik_pass_alt = os.environ.get("HIK_PASS_ALT", c.hik_pass_default)
        return c


class State:
    processed = 0
    succeeded = 0
    failed = 0
    pg_pool: asyncpg.Pool | None = None
    http: httpx.AsyncClient | None = None
    ready = False


STATE = State()


async def execute_isapi_open(
    cfg: Config,
    ip: str,
    port: int,
    duration: int,
    use_alt_pass: bool = False,
) -> tuple[bool, int, str]:
    """Call Hikvision AccessControl RemoteControl endpoint.

    Returns (ok, http_status, detail).
    """
    pwd = cfg.hik_pass_alt if use_alt_pass else cfg.hik_pass_default
    url = f"http://{ip}:{port}/ISAPI/AccessControl/RemoteControl/door/1"
    body = f"<RemoteControlDoor><cmd>open</cmd><duration>{duration}</duration></RemoteControlDoor>"
    try:
        auth = httpx.DigestAuth(cfg.hik_user, pwd)
        r = await STATE.http.put(url, content=body, auth=auth, timeout=10.0)
        detail = r.text[:200] if r.text else ""
        return (r.status_code in (200, 204), r.status_code, detail)
    except httpx.TimeoutException:
        return (False, 0, "timeout")
    except Exception as e:
        return (False, 0, f"{type(e).__name__}: {str(e)[:120]}")


async def handle_event(cfg: Config, canonical: dict[str, Any]) -> None:
    payload = canonical.get("payload") or {}
    if payload.get("db_table") != "access_door_events":
        return
    row = payload.get("row") or {}
    if row.get("event_type") != "remote_open_requested":
        return

    door_id = row.get("door_id")
    meta = row.get("metadata") or {}
    ip = meta.get("device_ip")
    port = meta.get("device_port")
    duration = int(meta.get("duration_seconds", 5))
    command_id = meta.get("command_id")

    STATE.processed += 1
    log.info(
        "processing_open_command",
        extra={"door_id": door_id, "command_id": command_id, "ip": ip, "port": port},
    )

    if not ip or not port:
        await record_result(door_id, command_id, False, 0, "missing device info", meta)
        return

    start = time.monotonic()
    ok, http_code, detail = await execute_isapi_open(cfg, ip, int(port), duration)
    if not ok and http_code == 401:
        ok, http_code, detail = await execute_isapi_open(cfg, ip, int(port), duration, use_alt_pass=True)
    latency_ms = int((time.monotonic() - start) * 1000)

    if ok:
        STATE.succeeded += 1
    else:
        STATE.failed += 1

    await record_result(door_id, command_id, ok, http_code, detail, {**meta, "latency_ms": latency_ms})


async def record_result(
    door_id: str,
    command_id: str,
    ok: bool,
    http_code: int,
    detail: str,
    meta: dict[str, Any],
) -> None:
    event_type = "door_opened" if ok else "door_open_failed"
    async with STATE.pg_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO access_door_events
              (id, tenant_id, door_id, event_type, metadata, occurred_at, created_at)
            VALUES (gen_random_uuid(),
                    'a0000000-0000-0000-0000-000000000001'::uuid,
                    $1::uuid, $2, $3::jsonb, NOW(), NOW())
            """,
            door_id,
            event_type,
            json.dumps({**meta, "command_id": command_id, "http_code": http_code, "detail": detail}),
        )


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    STATE.pg_pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=5)
    STATE.http = httpx.AsyncClient()

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict] = asyncio.Queue()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="aion-access-orchestrator")
    client.username_pw_set(cfg.mqtt_user, cfg.mqtt_password)

    def on_connect(c, userdata, flags, rc, props=None):
        if rc == 0:
            c.subscribe(cfg.topic_filter, qos=1)
            STATE.ready = True
            log.info("mqtt_connected", extra={"topic": cfg.topic_filter})

    def on_message(c, userdata, msg):
        try:
            canonical = json.loads(msg.payload.decode())
            loop.call_soon_threadsafe(queue.put_nowait, canonical)
        except Exception as exc:
            log.warning("bad_message", extra={"err": str(exc)})

    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(cfg.mqtt_host, cfg.mqtt_port, keepalive=30)
    client.loop_start()

    log.info("access_orchestrator_started")

    try:
        while True:
            canonical = await queue.get()
            try:
                await handle_event(cfg, canonical)
            except Exception as exc:
                STATE.failed += 1
                log.error("handler_error", extra={"err": str(exc)})
    finally:
        client.loop_stop()
        client.disconnect()
        await STATE.http.aclose()
        await STATE.pg_pool.close()


if __name__ == "__main__":
    asyncio.run(main())
