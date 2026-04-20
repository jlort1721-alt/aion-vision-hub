#!/usr/bin/env python3
"""
PTZ Executor worker — consume aion/commands/ptz/+ from MQTT and dispatch
to Hikvision (NET_DVR_PTZControlWithSpeed_Other) or Dahua (DH_PTZ_ControlEx).
Publishes results back to aion/events/ptz/ack/<command_id>.
"""
from __future__ import annotations

import asyncio
import ctypes
import json
import logging
import os
import sys
import time
from ctypes import Structure, byref, c_byte, c_char, c_int, c_uint, c_void_p, c_ulong, POINTER
from queue import Queue
from typing import Optional

import asyncpg
import paho.mqtt.client as mqtt
from pythonjsonlogger import jsonlogger


HIK_LIB_DIR = "/opt/hikvision-sdk-v619"
DH_LIB_DIR = "/opt/dahua-sdk-v3/Bin"
os.environ["LD_LIBRARY_PATH"] = (
    f"{HIK_LIB_DIR}:{HIK_LIB_DIR}/HCNetSDKCom:{DH_LIB_DIR}:"
    + os.environ.get("LD_LIBRARY_PATH", "")
)

LOG = logging.getLogger("ptz-executor")

# Hikvision PTZ command codes (HCNetSDK.h)
HIK_PTZ_CMDS = {
    "zoom_in": 11,
    "zoom_out": 12,
    "up": 21,
    "down": 22,
    "left": 23,
    "right": 24,
}

# Dahua PTZ command codes (dhnetsdk.h enum DH_PTZ_ControlType)
DH_PTZ_CMDS = {
    "up": 0,      # DH_PTZ_UP_CONTROL
    "down": 1,    # DH_PTZ_DOWN_CONTROL
    "left": 2,    # DH_PTZ_LEFT_CONTROL
    "right": 3,   # DH_PTZ_RIGHT_CONTROL
    "zoom_in": 4, # DH_PTZ_ZOOM_ADD_CONTROL
    "zoom_out": 5,  # DH_PTZ_ZOOM_DEC_CONTROL
}


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


# --- Hikvision login structures ---
class NET_DVR_USER_LOGIN_INFO(Structure):
    _pack_ = 1
    _fields_ = [
        ("sDeviceAddress", c_byte * 129),
        ("byUseTransport", c_byte),
        ("wPort", ctypes.c_ushort),
        ("sUserName", c_byte * 64),
        ("sPassword", c_byte * 64),
        ("fLoginResultCallBack", c_void_p),
        ("pUser", c_void_p),
        ("bUseAsynLogin", c_byte),
        ("byProxyType", c_byte),
        ("byUseUTCTime", c_byte),
        ("byLoginMode", c_byte),
        ("byHttps", c_byte),
        ("iProxyID", c_int),
        ("byVerifyMode", c_byte),
        ("byRes3", c_byte * 119),
    ]


class NET_DVR_DEVICEINFO_V40(Structure):
    _pack_ = 1
    _fields_ = [
        ("struDeviceV30", c_byte * 556),
        ("bySupportLock", c_byte),
        ("byRetryLoginTime", c_byte),
        ("byPasswordLevel", c_byte),
        ("byProxyType", c_byte),
        ("dwSurplusLockTime", c_uint),
        ("byCharEncodeType", c_byte),
        ("bySupportDev5", c_byte),
        ("bySupport", c_byte),
        ("byLoginMode", c_byte),
        ("dwOEMCode", c_uint),
        ("iResidualValidity", c_int),
        ("byResidualValidity", c_byte),
        ("bySingleStartDTalkChan", c_byte),
        ("bySingleDTalkChanNums", c_byte),
        ("byPassWordResetLevel", c_byte),
        ("bySupportStreamEncrypt", c_byte),
        ("byMarketType", c_byte),
        ("byRes2", c_byte * 238),
    ]


def _fill_bytes(src: str, size: int) -> bytes:
    b = src.encode("utf-8")[: size - 1]
    return b + b"\x00" * (size - len(b))


class HikPTZExecutor:
    def __init__(self, sdk):
        self.sdk = sdk
        self._sessions: dict[str, int] = {}  # device_id -> user_handle

    def login(self, device_id: str, ip: str, port: int, user: str, password: str) -> int:
        if device_id in self._sessions:
            return self._sessions[device_id]
        info = NET_DVR_USER_LOGIN_INFO()
        ctypes.memset(byref(info), 0, ctypes.sizeof(info))
        ctypes.memmove(info.sDeviceAddress, _fill_bytes(ip, 129), 129)
        ctypes.memmove(info.sUserName, _fill_bytes(user, 64), 64)
        ctypes.memmove(info.sPassword, _fill_bytes(password, 64), 64)
        info.wPort = port

        dev_info = NET_DVR_DEVICEINFO_V40()
        ctypes.memset(byref(dev_info), 0, ctypes.sizeof(dev_info))

        handle = self.sdk.NET_DVR_Login_V40(byref(info), byref(dev_info))
        if handle >= 0:
            self._sessions[device_id] = handle
        return handle

    def ptz(self, device_id: str, ip: str, port: int, user: str, password: str,
            channel: int, action: str, speed: int, duration_ms: int) -> tuple[bool, str]:
        cmd = HIK_PTZ_CMDS.get(action)
        if cmd is None:
            return False, f"unknown_action: {action}"
        handle = self.login(device_id, ip, port, user, password)
        if handle < 0:
            err = self.sdk.NET_DVR_GetLastError()
            return False, f"login_failed err={err}"

        # Start: dwStop=0 with speed
        ok_start = self.sdk.NET_DVR_PTZControlWithSpeed_Other(
            handle, channel, cmd, 0, speed
        )
        if not ok_start:
            err = self.sdk.NET_DVR_GetLastError()
            return False, f"ptz_start_failed err={err}"

        time.sleep(duration_ms / 1000.0)

        # Stop: dwStop=1
        self.sdk.NET_DVR_PTZControlWithSpeed_Other(handle, channel, cmd, 1, speed)
        return True, f"executed action={action} duration={duration_ms}ms"


class DahuaPTZExecutor:
    def __init__(self, sdk):
        self.sdk = sdk
        self._sessions: dict[str, int] = {}

    def ptz(self, device_id: str, serial: str, user: str, password: str,
            channel: int, action: str, speed: int, duration_ms: int) -> tuple[bool, str]:
        # Dahua P2P login is async and currently WIP; for now only log the attempt.
        return False, "dahua_ptz_pending_sdk_p2p_tuning"


class State:
    processed = 0
    succeeded = 0
    failed = 0
    pg_pool: asyncpg.Pool | None = None
    mqtt_client: mqtt.Client | None = None
    hik: HikPTZExecutor | None = None
    dh: DahuaPTZExecutor | None = None


STATE = State()
_QUEUE: Queue = Queue(maxsize=1000)


async def handle_command(cfg, canonical: dict) -> None:
    """Execute a PTZ canonical event received from MQTT."""
    STATE.processed += 1
    try:
        cmd = canonical.get("payload", {}).get("command", {})
        device_id = cmd.get("device_id")
        action = cmd.get("action")
        channel = int(cmd.get("channel", 1))
        speed = int(cmd.get("speed", 4))
        duration_ms = int(cmd.get("duration_ms", 500))
        command_id = cmd.get("command_id", "?")

        async with STATE.pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, brand, ip_address, port, serial_number
                FROM devices WHERE id = $1::uuid LIMIT 1
                """,
                device_id,
            )
        if not row:
            STATE.failed += 1
            LOG.warning("device_not_found", extra={"command_id": command_id, "device_id": device_id})
            return

        if row["brand"] == "hikvision":
            pw = cfg.hik_pass_alt if any(
                t in (row["name"] or "").lower()
                for t in ["sur ", "norte", "terraza", "gym", "pisquines", "portalegre", "ac ", "dvr "]
            ) else cfg.hik_pass_default
            ok, detail = await asyncio.get_running_loop().run_in_executor(
                None,
                STATE.hik.ptz,
                device_id, row["ip_address"], row["port"], cfg.hik_user, pw,
                channel, action, speed, duration_ms,
            )
        elif row["brand"] == "dahua":
            ok, detail = await asyncio.get_running_loop().run_in_executor(
                None,
                STATE.dh.ptz,
                device_id, row["serial_number"], "admin", cfg.dh_default_pass,
                channel, action, speed, duration_ms,
            )
        else:
            ok, detail = False, f"unsupported_brand: {row['brand']}"

        if ok:
            STATE.succeeded += 1
        else:
            STATE.failed += 1

        # Publish ACK to MQTT
        if STATE.mqtt_client:
            STATE.mqtt_client.publish(
                f"aion/events/ptz/ack/{command_id}",
                json.dumps({
                    "command_id": command_id,
                    "device_id": device_id,
                    "action": action,
                    "ok": ok,
                    "detail": detail,
                    "timestamp": time.time(),
                }),
                qos=1,
            )
        LOG.info("ptz_executed", extra={
            "command_id": command_id, "ok": ok, "detail": detail,
            "brand": row["brand"], "device": row["name"],
        })
    except Exception as e:
        STATE.failed += 1
        LOG.error("handler_error", extra={"err": str(e)})


class Config:
    pg_dsn: str
    mqtt_host: str
    mqtt_port: int
    mqtt_user: str
    mqtt_password: str
    topic: str
    hik_user: str
    hik_pass_default: str
    hik_pass_alt: str
    dh_default_pass: str

    @classmethod
    def load(cls) -> "Config":
        c = cls()
        c.pg_dsn = os.environ["PG_DSN"]
        c.mqtt_host = os.environ.get("MQTT_HOST", "127.0.0.1")
        c.mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
        c.mqtt_user = os.environ["MQTT_USER"]
        c.mqtt_password = os.environ["MQTT_PASSWORD"]
        c.topic = os.environ.get("TOPIC_FILTER", "aion/commands/ptz/#")
        c.hik_user = os.environ.get("HIK_USER", "admin")
        c.hik_pass_default = os.environ["HIK_PASS_DEFAULT"]
        c.hik_pass_alt = os.environ.get("HIK_PASS_ALT", c.hik_pass_default)
        c.dh_default_pass = os.environ.get("DH_DEFAULT_PASS", "Clave.seg2023")
        return c


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    # Load SDKs
    hik_sdk = ctypes.CDLL(f"{HIK_LIB_DIR}/libhcnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    hik_sdk.NET_DVR_Init.restype = ctypes.c_bool
    hik_sdk.NET_DVR_Login_V40.argtypes = [POINTER(NET_DVR_USER_LOGIN_INFO), POINTER(NET_DVR_DEVICEINFO_V40)]
    hik_sdk.NET_DVR_Login_V40.restype = c_int
    hik_sdk.NET_DVR_Logout.argtypes = [c_int]
    hik_sdk.NET_DVR_PTZControlWithSpeed_Other.argtypes = [c_int, c_int, c_uint, c_uint, c_uint]
    hik_sdk.NET_DVR_PTZControlWithSpeed_Other.restype = ctypes.c_bool
    hik_sdk.NET_DVR_GetLastError.restype = c_uint
    hik_sdk.NET_DVR_Cleanup.restype = None

    if not hik_sdk.NET_DVR_Init():
        LOG.error("hik_sdk_init_failed")
        sys.exit(1)

    dh_sdk = ctypes.CDLL(f"{DH_LIB_DIR}/libdhnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    dh_sdk.CLIENT_Init.argtypes = [c_void_p, c_ulong]
    dh_sdk.CLIENT_Init.restype = ctypes.c_bool
    dh_sdk.CLIENT_Cleanup.restype = None
    if not dh_sdk.CLIENT_Init(None, 0):
        LOG.error("dh_sdk_init_failed")

    STATE.hik = HikPTZExecutor(hik_sdk)
    STATE.dh = DahuaPTZExecutor(dh_sdk)
    STATE.pg_pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=3)

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="aion-ptz-executor")
    client.username_pw_set(cfg.mqtt_user, cfg.mqtt_password)

    def on_connect(c, userdata, flags, rc, props=None):
        if rc == 0:
            c.subscribe(cfg.topic, qos=1)
            LOG.info("mqtt_connected", extra={"topic": cfg.topic})

    def on_message(c, userdata, msg):
        try:
            parsed = json.loads(msg.payload.decode())
            loop.call_soon_threadsafe(queue.put_nowait, parsed)
        except Exception as exc:
            LOG.warning("bad_message", extra={"err": str(exc)})

    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(cfg.mqtt_host, cfg.mqtt_port, keepalive=30)
    client.loop_start()
    STATE.mqtt_client = client

    LOG.info("ptz_executor_started")
    try:
        while True:
            canonical = await queue.get()
            await handle_command(cfg, canonical)
    finally:
        client.loop_stop()
        client.disconnect()
        hik_sdk.NET_DVR_Cleanup()
        dh_sdk.CLIENT_Cleanup()
        await STATE.pg_pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
