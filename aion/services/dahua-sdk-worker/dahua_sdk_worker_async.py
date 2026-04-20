#!/usr/bin/env python3
"""
Dahua NetSDK P2P worker — async CLIENT_PostLoginTask path.

The synchronous CLIENT_LoginWithHighLevelSecurity with EM_LOGIN_SPEC_CAP_P2P
returns NET_LOGIN_ERROR_CONNECT immediately because P2P login needs to
negotiate with the P2P rendezvous servers asynchronously. The correct
NetSDK pattern is CLIENT_PostLoginTask which takes a callback fired once
the device is reachable.
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
    CFUNCTYPE, POINTER, Structure, byref,
    c_byte, c_char, c_char_p, c_int, c_uint, c_long, c_void_p, c_ulong,
    c_longlong,
)
from queue import Queue
from typing import Optional

import asyncpg
from pythonjsonlogger import jsonlogger


DH_LIB_DIR = "/opt/dahua-sdk-v3/Bin"
os.environ["LD_LIBRARY_PATH"] = f"{DH_LIB_DIR}:" + os.environ.get("LD_LIBRARY_PATH", "")

LOG = logging.getLogger("dahua-sdk-async")

EM_LOGIN_SPEC_CAP_P2P = 19
EM_TCP_LOGIN_CONFIG_TYPE_UNKNOWN = 0


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


class NET_POST_LOGIN_TASK(Structure):
    _pack_ = 1
    _fields_ = [
        ("lLoginID", c_longlong),
        ("pchDVRIP", c_char_p),
        ("nDVRPort", c_long),
        ("bOnline", c_int),
        ("stuDeviceInfo", NET_DEVICEINFO_Ex),
        ("nError", c_int),
        ("szReserve", c_byte * 1024),
    ]


CALLBACK_TYPE = CFUNCTYPE(None, c_uint, POINTER(NET_POST_LOGIN_TASK), c_longlong)


class NET_IN_POST_LOGIN_TASK(Structure):
    _pack_ = 1
    _fields_ = [
        ("dwSize", c_uint),
        ("szReserve1", c_byte * 4),
        ("szIp", c_char_p),
        ("nPort", c_uint),
        ("szReserve2", c_byte * 4),
        ("szName", c_char_p),
        ("szPwd", c_char_p),
        ("emSpecCap", c_int),
        ("emConfigType", c_int),
        ("cbLogin", CALLBACK_TYPE),
        ("pUser", c_void_p),
        ("bHighLevelSecurity", c_int),
        ("emTLSCap", c_int),
        ("byReserved", c_byte * 128),
    ]


class NET_OUT_POST_LOGIN_TASK(Structure):
    _pack_ = 1
    _fields_ = [("dwSize", c_uint)]


_RESULT_QUEUE: Queue = Queue(maxsize=1000)
_PENDING: dict[int, str] = {}  # dwTaskID → serial


def _post_login_callback(dwTaskID, pOutParam, dwUser):
    try:
        task = pOutParam.contents
        online = bool(task.bOnline)
        err = int(task.nError)
        serial = _PENDING.pop(int(dwTaskID), None) or "unknown"
        info = {
            "task_id": int(dwTaskID),
            "serial": serial,
            "online": online,
            "error": hex(err & 0xFFFFFFFF),
            "login_id": int(task.lLoginID),
            "port": int(task.nDVRPort),
            "channels": int(task.stuDeviceInfo.nChanNum),
            "dev_type": bytes(task.stuDeviceInfo.szDevType).rstrip(b"\x00").decode("utf-8", errors="ignore"),
            "firmware": bytes(task.stuDeviceInfo.szDevSoftwareVersion).rstrip(b"\x00").decode("utf-8", errors="ignore"),
            "received_at": time.time(),
        }
        _RESULT_QUEUE.put_nowait(info)
    except Exception as e:
        LOG.error("callback_exception", extra={"err": str(e)})


_post_login_callback_c = CALLBACK_TYPE(_post_login_callback)


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


def device_credentials(name: str, tags: list[str]) -> tuple[str, str]:
    user = "admin"
    password = os.environ.get("DH_DEFAULT_PASS", "Clave.seg2023")
    for t in tags or []:
        if t.startswith("user:"):
            user = t.split(":", 1)[1]
    if any("arrezo" in (t or "").lower() for t in tags or []) or "arrezo" in name.lower():
        password = os.environ.get("DH_ARREZO_PASS", "Seg2025.")
    return user, password


async def drain_results(pool: asyncpg.Pool, stop: asyncio.Event) -> None:
    loop = asyncio.get_running_loop()
    while not stop.is_set():
        try:
            info = await loop.run_in_executor(None, _RESULT_QUEUE.get, True, 1.0)
        except Exception:
            continue

        status = "online" if info["online"] else "offline"
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE devices
                SET status = $1, last_seen = NOW(), updated_at = NOW(),
                    model = COALESCE(NULLIF($2, ''), model),
                    firmware_version = COALESCE(NULLIF($3, ''), firmware_version)
                WHERE serial_number = $4
                """,
                status,
                info.get("dev_type", "") or "",
                info.get("firmware", "") or "",
                info["serial"],
            )
        if info["online"]:
            LOG.info("device_online", extra=info)
        else:
            LOG.warning("device_login_failed", extra=info)


async def main() -> None:
    setup_logging()
    pg_dsn = os.environ["PG_DSN"]
    poll_interval = int(os.environ.get("POLL_INTERVAL", "180"))

    sdk = ctypes.CDLL(f"{DH_LIB_DIR}/libdhnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    sdk.CLIENT_Init.argtypes = [c_void_p, c_ulong]
    sdk.CLIENT_Init.restype = ctypes.c_bool
    sdk.CLIENT_Cleanup.restype = None
    sdk.CLIENT_PostLoginTask.argtypes = [POINTER(NET_IN_POST_LOGIN_TASK), POINTER(NET_OUT_POST_LOGIN_TASK)]
    sdk.CLIENT_PostLoginTask.restype = c_uint
    sdk.CLIENT_CancelLoginTask.argtypes = [c_uint]
    sdk.CLIENT_CancelLoginTask.restype = ctypes.c_bool
    sdk.CLIENT_Logout.argtypes = [c_longlong]
    sdk.CLIENT_Logout.restype = ctypes.c_bool

    if not sdk.CLIENT_Init(None, 0):
        LOG.error("sdk_init_failed")
        sys.exit(1)
    LOG.info("dahua_sdk_async_initialized")

    pool = await asyncpg.create_pool(pg_dsn, min_size=1, max_size=3)
    stop = asyncio.Event()
    asyncio.create_task(drain_results(pool, stop))

    # Keep references to allocated C strings
    _str_refs: list = []

    try:
        while True:
            async with pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, serial_number, tags
                    FROM devices
                    WHERE brand = 'dahua' AND serial_number IS NOT NULL
                    """
                )

            LOG.info("post_login_cycle", extra={"count": len(devices)})

            for d in devices:
                serial = d["serial_number"]
                user, password = device_credentials(d["name"] or "", d["tags"] or [])

                # Allocate c_char_p and keep refs
                ip_c = ctypes.c_char_p(serial.encode("utf-8"))
                user_c = ctypes.c_char_p(user.encode("utf-8"))
                pass_c = ctypes.c_char_p(password.encode("utf-8"))
                _str_refs.extend([ip_c, user_c, pass_c])

                in_param = NET_IN_POST_LOGIN_TASK()
                ctypes.memset(byref(in_param), 0, ctypes.sizeof(in_param))
                in_param.dwSize = ctypes.sizeof(in_param)
                in_param.szIp = ip_c
                in_param.nPort = 0  # not used for P2P
                in_param.szName = user_c
                in_param.szPwd = pass_c
                in_param.emSpecCap = EM_LOGIN_SPEC_CAP_P2P
                in_param.emConfigType = EM_TCP_LOGIN_CONFIG_TYPE_UNKNOWN
                in_param.cbLogin = _post_login_callback_c
                in_param.pUser = None
                in_param.bHighLevelSecurity = 1
                in_param.emTLSCap = 0

                out_param = NET_OUT_POST_LOGIN_TASK()
                out_param.dwSize = ctypes.sizeof(out_param)

                task_id = await asyncio.get_running_loop().run_in_executor(
                    None,
                    lambda: sdk.CLIENT_PostLoginTask(byref(in_param), byref(out_param)),
                )

                if task_id > 0:
                    _PENDING[int(task_id)] = serial
                    LOG.info("task_posted", extra={"serial": serial, "task_id": int(task_id)})
                else:
                    LOG.warning("task_post_failed", extra={"serial": serial})

            # Wait for callbacks (async results drain themselves)
            await asyncio.sleep(poll_interval)

            # Trim refs to avoid unbounded growth
            if len(_str_refs) > 500:
                _str_refs.clear()
    finally:
        stop.set()
        sdk.CLIENT_Cleanup()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
