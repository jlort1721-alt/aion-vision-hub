#!/usr/bin/env python3
"""
Hikvision HCNetSDK worker — login + health report.

Usa ctypes wrapping de libhcnetsdk.so para los 28 devices Hikvision. Prueba
múltiples passwords por device (Clave.seg2023, seg12345, Seg12345) y reporta
status a devices.status + last_seen cada 600s.
"""
from __future__ import annotations

import asyncio
import ctypes
import json
import logging
import os
import sys
import time
from ctypes import (
    Structure, POINTER, byref, c_byte, c_int, c_uint, c_void_p, c_ulong,
)
from dataclasses import dataclass

import asyncpg
from pythonjsonlogger import jsonlogger


HIK_LIB_DIR = "/opt/hikvision-sdk-v619"
os.environ["LD_LIBRARY_PATH"] = (
    f"{HIK_LIB_DIR}:{HIK_LIB_DIR}/HCNetSDKCom:" + os.environ.get("LD_LIBRARY_PATH", "")
)

LOG = logging.getLogger("hik-sdk-worker")


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


@dataclass
class Config:
    pg_dsn: str
    hik_user: str
    passwords: list[str]
    poll_interval: int

    @classmethod
    def load(cls) -> "Config":
        pws = [
            os.environ.get("HIK_PASS_DEFAULT", "Clave.seg2023"),
            os.environ.get("HIK_PASS_ALT", "seg12345"),
            os.environ.get("HIK_PASS_ALT2", "Seg12345"),
        ]
        # Dedup preservando orden
        seen = set()
        pws = [p for p in pws if not (p in seen or seen.add(p))]
        return cls(
            pg_dsn=os.environ["PG_DSN"],
            hik_user=os.environ.get("HIK_USER", "admin"),
            passwords=pws,
            poll_interval=int(os.environ.get("POLL_INTERVAL", "600")),
        )


def _fill_bytes(src: str, size: int) -> bytes:
    b = src.encode("utf-8")[: size - 1]
    return b + b"\x00" * (size - len(b))


def login_try_passwords(
    sdk, ip: str, port: int, user: str, passwords: list[str]
) -> tuple[int, str, int]:
    """Return (user_handle, winning_password, last_err). user_handle=-1 on total fail."""
    last_err = 0
    for pw in passwords:
        info = NET_DVR_USER_LOGIN_INFO()
        ctypes.memset(byref(info), 0, ctypes.sizeof(info))
        ctypes.memmove(info.sDeviceAddress, _fill_bytes(ip, 129), 129)
        ctypes.memmove(info.sUserName, _fill_bytes(user, 64), 64)
        ctypes.memmove(info.sPassword, _fill_bytes(pw, 64), 64)
        info.wPort = port

        dev_info = NET_DVR_DEVICEINFO_V40()
        ctypes.memset(byref(dev_info), 0, ctypes.sizeof(dev_info))

        handle = sdk.NET_DVR_Login_V40(byref(info), byref(dev_info))
        if handle >= 0:
            return handle, pw, 0
        last_err = sdk.NET_DVR_GetLastError()
        # Si NET_FAIL_CONNECT (7) o NET_TIMEOUT (153), no retry con otro password
        if last_err in (7, 153, 10):
            break
        time.sleep(0.3)
    return -1, "", last_err


async def poll_device(
    sdk, db_pool: asyncpg.Pool,
    device_id: str, name: str, ip: str, port: int, cfg: Config,
) -> None:
    loop = asyncio.get_running_loop()
    handle, winning_pw, last_err = await loop.run_in_executor(
        None, login_try_passwords, sdk, ip, port, cfg.hik_user, cfg.passwords,
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE devices
            SET status = $1, last_seen = NOW(), updated_at = NOW()
            WHERE id = $2::uuid
            """,
            "online" if handle >= 0 else "offline",
            device_id,
        )

    if handle >= 0:
        LOG.info("device_online", extra={"device_id": device_id, "ip": ip, "name": name, "pw_ok": winning_pw})
        sdk.NET_DVR_Logout(handle)
    else:
        err_name = {1: "PW_ERROR", 7: "NET_FAIL", 10: "SEND_ERR", 42: "MAX_USER", 153: "NET_TIMEOUT"}.get(
            last_err, f"err={last_err}"
        )
        LOG.warning("device_login_failed", extra={
            "device_id": device_id, "ip": ip, "name": name, "last_err": last_err, "err_name": err_name,
        })


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    sdk = ctypes.CDLL(f"{HIK_LIB_DIR}/libhcnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    sdk.NET_DVR_Init.restype = ctypes.c_bool
    sdk.NET_DVR_Logout.argtypes = [c_int]
    sdk.NET_DVR_Login_V40.argtypes = [POINTER(NET_DVR_USER_LOGIN_INFO), POINTER(NET_DVR_DEVICEINFO_V40)]
    sdk.NET_DVR_Login_V40.restype = c_int
    sdk.NET_DVR_GetLastError.restype = c_uint
    sdk.NET_DVR_SetConnectTime.argtypes = [c_uint, c_uint]
    sdk.NET_DVR_SetReconnect.argtypes = [c_uint, ctypes.c_bool]
    sdk.NET_DVR_Cleanup.restype = None

    if not sdk.NET_DVR_Init():
        LOG.error("sdk_init_failed")
        sys.exit(1)
    sdk.NET_DVR_SetConnectTime(5000, 1)
    sdk.NET_DVR_SetReconnect(10000, True)
    LOG.info("sdk_initialized", extra={"passwords_count": len(cfg.passwords)})

    db_pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=5)

    try:
        while True:
            async with db_pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, ip_address, port
                    FROM devices
                    WHERE brand = 'hikvision' AND ip_address IS NOT NULL
                    ORDER BY name
                    """
                )

            # Rate limit: sequential, not parallel, avoid DVR lockout
            for d in devices:
                try:
                    await poll_device(
                        sdk, db_pool, str(d["id"]), d["name"] or "",
                        d["ip_address"], d["port"], cfg,
                    )
                except Exception as exc:
                    LOG.error("poll_error", extra={"device_id": str(d["id"]), "err": str(exc)})
                await asyncio.sleep(0.5)  # Spacing between device logins

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
