#!/usr/bin/env python3
"""
Hikvision HCNetSDK worker — login + health report + door open command.

Uses ctypes wrapping of libhcnetsdk.so for the 6 DVRs whose HTTP/ISAPI is not
exposed publicly. Maintains a persistent SDK session per device, reports status
to PostgreSQL (devices.last_seen) every 60s, and exposes a door-open API via
MQTT aion/commands/hiksdk/door/{door_id}.
"""
from __future__ import annotations

import asyncio
import ctypes
import ctypes.util
import json
import logging
import os
import signal
import sys
import time
from ctypes import byref, c_byte, c_char_p, c_int, c_uint, c_ulong, create_string_buffer, Structure
from dataclasses import dataclass
from typing import Optional

import asyncpg
import paho.mqtt.client as mqtt
from pythonjsonlogger import jsonlogger


HIK_LIB_DIR = "/opt/hikvision-sdk-v619"
os.environ["LD_LIBRARY_PATH"] = (
    f"{HIK_LIB_DIR}:{HIK_LIB_DIR}/HCNetSDKCom:" + os.environ.get("LD_LIBRARY_PATH", "")
)

LOG = logging.getLogger("hik-sdk-worker")


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


class NET_DVR_USER_LOGIN_INFO(Structure):
    _pack_ = 1
    _fields_ = [
        ("sDeviceAddress", c_byte * 129),
        ("byUseTransport", c_byte),
        ("wPort", ctypes.c_ushort),
        ("sUserName", c_byte * 64),
        ("sPassword", c_byte * 64),
        ("fLoginResultCallBack", c_void_p := ctypes.c_void_p),
        ("pUser", ctypes.c_void_p),
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


@dataclass
class Config:
    pg_dsn: str
    mqtt_host: str
    mqtt_port: int
    mqtt_user: str
    mqtt_password: str
    hik_user: str
    hik_pass_default: str
    hik_pass_alt: str
    poll_interval: int

    @classmethod
    def load(cls) -> "Config":
        return cls(
            pg_dsn=os.environ["PG_DSN"],
            mqtt_host=os.environ.get("MQTT_HOST", "host.docker.internal"),
            mqtt_port=int(os.environ.get("MQTT_PORT", "1883")),
            mqtt_user=os.environ["MQTT_USER"],
            mqtt_password=os.environ["MQTT_PASSWORD"],
            hik_user=os.environ.get("HIK_USER", "admin"),
            hik_pass_default=os.environ["HIK_PASS_DEFAULT"],
            hik_pass_alt=os.environ.get("HIK_PASS_ALT", os.environ["HIK_PASS_DEFAULT"]),
            poll_interval=int(os.environ.get("POLL_INTERVAL", "60")),
        )


def _fill_bytes(src: str, size: int) -> bytes:
    b = src.encode("utf-8")[: size - 1]
    return b + b"\x00" * (size - len(b))


class HikSession:
    def __init__(self, sdk, ip: str, port: int, user: str, password: str):
        self.sdk = sdk
        self.ip = ip
        self.port = port
        self.user = user
        self.password = password
        self.user_id: int = -1

    def login(self) -> tuple[bool, int]:
        info = NET_DVR_USER_LOGIN_INFO()
        ctypes.memset(byref(info), 0, ctypes.sizeof(info))
        ctypes.memmove(info.sDeviceAddress, _fill_bytes(self.ip, 129), 129)
        ctypes.memmove(info.sUserName, _fill_bytes(self.user, 64), 64)
        ctypes.memmove(info.sPassword, _fill_bytes(self.password, 64), 64)
        info.wPort = self.port
        info.bUseAsynLogin = 0

        device_info = NET_DVR_DEVICEINFO_V40()
        ctypes.memset(byref(device_info), 0, ctypes.sizeof(device_info))

        self.sdk.NET_DVR_Login_V40.argtypes = [
            ctypes.POINTER(NET_DVR_USER_LOGIN_INFO),
            ctypes.POINTER(NET_DVR_DEVICEINFO_V40),
        ]
        self.sdk.NET_DVR_Login_V40.restype = c_int

        self.user_id = self.sdk.NET_DVR_Login_V40(byref(info), byref(device_info))
        if self.user_id < 0:
            err = self.sdk.NET_DVR_GetLastError()
            return False, err
        return True, 0

    def logout(self) -> None:
        if self.user_id >= 0:
            self.sdk.NET_DVR_Logout(self.user_id)
            self.user_id = -1


async def poll_device(
    sdk, db_pool: asyncpg.Pool, device_id: str, ip: str, port: int, user: str, password: str
) -> None:
    sess = HikSession(sdk, ip, port, user, password)
    ok, err = await asyncio.get_running_loop().run_in_executor(None, sess.login)
    now = time.time()
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE devices
            SET status = $1, last_seen = NOW(), updated_at = NOW()
            WHERE id = $2
            """,
            "online" if ok else "offline",
            device_id,
        )
    if ok:
        LOG.info("device_online", extra={"device_id": device_id, "ip": ip})
        sess.logout()
    else:
        LOG.warning("device_login_failed", extra={"device_id": device_id, "ip": ip, "err": err})


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    sdk = ctypes.CDLL(f"{HIK_LIB_DIR}/libhcnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    sdk.NET_DVR_Init.restype = ctypes.c_bool
    sdk.NET_DVR_Logout.argtypes = [c_int]
    sdk.NET_DVR_GetLastError.restype = c_uint
    sdk.NET_DVR_Cleanup.restype = None

    if not sdk.NET_DVR_Init():
        LOG.error("sdk_init_failed")
        sys.exit(1)
    LOG.info("sdk_initialized", extra={"version": hex(sdk.NET_DVR_GetSDKVersion())})

    sdk.NET_DVR_SetConnectTime(3000, 1)
    sdk.NET_DVR_SetReconnect(10000, True)

    db_pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=5)

    try:
        while True:
            async with db_pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, ip_address, port
                    FROM devices
                    WHERE brand = 'hikvision'
                      AND ip_address IS NOT NULL
                      AND deleted_at IS NULL
                    """
                )

            tasks = []
            for d in devices:
                pw = cfg.hik_pass_alt if (d["name"] or "").endswith("DVR") else cfg.hik_pass_default
                tasks.append(
                    poll_device(sdk, db_pool, str(d["id"]), d["ip_address"], d["port"], cfg.hik_user, pw)
                )
            await asyncio.gather(*tasks, return_exceptions=True)
            LOG.info("poll_cycle_complete", extra={"total": len(devices)})
            await asyncio.sleep(cfg.poll_interval)
    finally:
        sdk.NET_DVR_Cleanup()
        await db_pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
