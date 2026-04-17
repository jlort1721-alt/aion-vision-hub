#!/usr/bin/env python3
"""
Dahua NetSDK worker — login P2P + health + snapshot trigger.

Uses ctypes wrapping libdhnetsdk.so for the 13 Dahua P2P XVRs. For each serial
with P2P Online, logs in using CLIENT_LoginWithHighLevelSecurity with P2P mode,
reports status to devices.last_seen, and optionally triggers snapshots.
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
    Structure, byref, c_byte, c_int, c_uint, c_ulong, c_char, c_char_p,
    c_void_p, create_string_buffer, POINTER,
)
from dataclasses import dataclass
from typing import Optional

import asyncpg
from pythonjsonlogger import jsonlogger


DH_LIB_DIR = "/opt/dahua-sdk-v3/Bin"
os.environ["LD_LIBRARY_PATH"] = f"{DH_LIB_DIR}:" + os.environ.get("LD_LIBRARY_PATH", "")

LOG = logging.getLogger("dahua-sdk-worker")

# Dahua constants (from NetSDK docs)
EM_LOGIN_SPEC_CAP_TCP = 0
EM_LOGIN_SPEC_CAP_P2P = 17   # P2P login type


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


class NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY(Structure):
    _pack_ = 1
    _fields_ = [
        ("dwSize", c_uint),
        ("szIP", c_char * 64),
        ("nPort", c_int),
        ("szUserName", c_char * 64),
        ("szPassword", c_char * 64),
        ("emSpecCap", c_int),
        ("pCapParam", c_void_p),
    ]


class NET_DEVICEINFO_Ex(Structure):
    _pack_ = 1
    _fields_ = [
        ("sSerialNumber", c_byte * 48),
        ("nAlarmInPortNum", c_int),
        ("nAlarmOutPortNum", c_int),
        ("nDiskNum", c_int),
        ("nDVRType", c_int),
        ("nChanNum", c_int),
        ("szDevType", c_char * 32),
        ("szDevSoftwareVersion", c_char * 32),
        ("szDevSoftwareBuildDate", c_char * 32),
        ("szDevDSPSoftwareVersion", c_char * 32),
        ("szDevPanelSoftwareVersion", c_char * 32),
        ("byLimitedLoginTimes", c_byte),
        ("byLeftLogTimes", c_byte),
        ("byMaxPasswordLen", c_byte),
        ("byPasswordMinLevel", c_byte),
        ("szReserved", c_byte * 252),
    ]


class NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY(Structure):
    _pack_ = 1
    _fields_ = [
        ("dwSize", c_uint),
        ("stuDeviceInfo", NET_DEVICEINFO_Ex),
        ("nError", c_int),
    ]


@dataclass
class Config:
    pg_dsn: str
    dh_default_pass: str
    dh_arrezo_pass: str
    poll_interval: int

    @classmethod
    def load(cls) -> "Config":
        return cls(
            pg_dsn=os.environ["PG_DSN"],
            dh_default_pass=os.environ.get("DH_DEFAULT_PASS", "Clave.seg2023"),
            dh_arrezo_pass=os.environ.get("DH_ARREZO_PASS", "Seg2025."),
            poll_interval=int(os.environ.get("POLL_INTERVAL", "90")),
        )


def device_credentials(name: str, tags: list[str], cfg: Config) -> tuple[str, str]:
    """Infer (user, pass) from tags like 'user:aion' or 'user:AION'."""
    user = "admin"
    for t in tags or []:
        if t.startswith("user:"):
            user = t.split(":", 1)[1]
            break
    if any("arrezo" in t.lower() for t in tags or []):
        return user, cfg.dh_arrezo_pass
    return user, cfg.dh_default_pass


async def poll_device(
    sdk, db_pool: asyncpg.Pool, device_id: str, serial: str, user: str, password: str
) -> None:
    loop = asyncio.get_running_loop()

    def _login_sync() -> tuple[int, dict]:
        in_param = NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY()
        in_param.dwSize = ctypes.sizeof(in_param)
        in_param.szIP = serial.encode("utf-8")[:63] + b"\x00"
        in_param.nPort = 0  # P2P uses port 0
        in_param.szUserName = user.encode("utf-8")[:63] + b"\x00"
        in_param.szPassword = password.encode("utf-8")[:63] + b"\x00"
        in_param.emSpecCap = EM_LOGIN_SPEC_CAP_P2P
        in_param.pCapParam = None

        out_param = NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY()
        out_param.dwSize = ctypes.sizeof(out_param)

        login_id = sdk.CLIENT_LoginWithHighLevelSecurity(byref(in_param), byref(out_param))
        if login_id == 0:
            err = sdk.CLIENT_GetLastError()
            return 0, {"error": hex(err), "nerror": out_param.nError}

        channels = out_param.stuDeviceInfo.nChanNum
        dev_type = bytes(out_param.stuDeviceInfo.szDevType).rstrip(b"\x00").decode("utf-8", errors="ignore")
        fw = bytes(out_param.stuDeviceInfo.szDevSoftwareVersion).rstrip(b"\x00").decode("utf-8", errors="ignore")

        sdk.CLIENT_Logout(login_id)
        return login_id, {"channels": channels, "dev_type": dev_type, "firmware": fw}

    try:
        login_id, info = await loop.run_in_executor(None, _login_sync)
    except Exception as e:
        LOG.error("device_login_exception", extra={"serial": serial, "err": str(e)})
        return

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE devices
            SET status = $1, last_seen = NOW(), updated_at = NOW(),
                model = COALESCE(model, $2),
                firmware_version = COALESCE(firmware_version, $3)
            WHERE id = $4
            """,
            "online" if login_id > 0 else "offline",
            info.get("dev_type") or None,
            info.get("firmware") or None,
            device_id,
        )

    if login_id > 0:
        LOG.info("device_online", extra={"serial": serial, **info})
    else:
        LOG.warning("device_login_failed", extra={"serial": serial, **info})


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    sdk = ctypes.CDLL(f"{DH_LIB_DIR}/libdhnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    sdk.CLIENT_Init.restype = ctypes.c_bool
    sdk.CLIENT_Init.argtypes = [c_void_p, c_ulong]
    sdk.CLIENT_Cleanup.restype = None
    sdk.CLIENT_LoginWithHighLevelSecurity.argtypes = [
        POINTER(NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY),
        POINTER(NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY),
    ]
    sdk.CLIENT_LoginWithHighLevelSecurity.restype = c_int
    sdk.CLIENT_Logout.argtypes = [c_int]
    sdk.CLIENT_Logout.restype = ctypes.c_bool
    sdk.CLIENT_GetLastError.restype = c_uint

    if not sdk.CLIENT_Init(None, 0):
        LOG.error("sdk_init_failed")
        sys.exit(1)
    LOG.info("dahua_sdk_initialized", extra={"version": hex(sdk.CLIENT_GetSDKVersion())})
    sdk.CLIENT_SetNetworkParam  # just to ensure symbol is present

    db_pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=3)

    try:
        while True:
            async with db_pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, serial_number, tags
                    FROM devices
                    WHERE brand = 'dahua'
                      AND serial_number IS NOT NULL
                      AND deleted_at IS NULL
                    """
                )

            tasks = []
            for d in devices:
                user, password = device_credentials(d["name"] or "", d["tags"] or [], cfg)
                tasks.append(
                    poll_device(sdk, db_pool, str(d["id"]), d["serial_number"], user, password)
                )
            await asyncio.gather(*tasks, return_exceptions=True)
            LOG.info("poll_cycle_complete", extra={"total": len(devices)})
            await asyncio.sleep(cfg.poll_interval)
    finally:
        sdk.CLIENT_Cleanup()
        await db_pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
