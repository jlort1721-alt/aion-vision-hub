#!/usr/bin/env python3
"""
Hikvision HCNetSDK alarm receiver — NET_DVR_SetupAlarmChan_V41 + MSGCallBack.

Mantiene sesiones persistentes con cada DVR Hikvision, registra un callback
C que recibe eventos (motion, line_crossing, intrusion, face, tamper) y los
inserta en isapi_events vía PostgreSQL. Complementa el HTTP ISAPI push
(para los 6 DVRs cuyo puerto 80 no está expuesto al VPS).
"""
from __future__ import annotations

import asyncio
import ctypes
import json
import logging
import os
import sys
import threading
import time
from ctypes import (
    CFUNCTYPE, POINTER, Structure, byref,
    c_byte, c_char, c_int, c_uint, c_long, c_void_p, c_ulong,
)
from queue import Queue
from typing import Optional

import asyncpg
from pythonjsonlogger import jsonlogger


HIK_LIB_DIR = "/opt/hikvision-sdk-v619"
os.environ["LD_LIBRARY_PATH"] = (
    f"{HIK_LIB_DIR}:{HIK_LIB_DIR}/HCNetSDKCom:" + os.environ.get("LD_LIBRARY_PATH", "")
)

LOG = logging.getLogger("hik-sdk-alarms")

# Alarm command codes (subset, see HCNetSDK docs)
COMM_ALARM_V30 = 0x4000              # motion detection
COMM_ALARM_RULE = 0x1102             # VCA: line_cross, intrusion, loitering
COMM_VCA_ALARM = 0x4993              # VCA alarm (face, license_plate, etc.)
COMM_ALARM_PDC = 0x1105              # people counting
COMM_ALARMHOST_CID_ALARM_V40 = 0x2501

ALARM_TYPE_MAP = {
    COMM_ALARM_V30: "motion",
    COMM_ALARM_RULE: "vca_rule",
    COMM_VCA_ALARM: "vca_alarm",
    COMM_ALARM_PDC: "people_count",
    COMM_ALARMHOST_CID_ALARM_V40: "alarm_host",
}


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


class NET_DVR_SETUPALARM_PARAM_V50(Structure):
    _pack_ = 1
    _fields_ = [
        ("dwSize", c_uint),
        ("byLevel", c_byte),
        ("byAlarmInfoType", c_byte),
        ("byRetAlarmTypeV40", c_byte),
        ("byRetDevInfoVersion", c_byte),
        ("byRetVQDAlarmType", c_byte),
        ("byFaceAlarmDetection", c_byte),
        ("bySupport", c_byte),
        ("byBrokenNetHttp", c_byte),
        ("wTaskNo", ctypes.c_ushort),
        ("byDeployType", c_byte),
        ("bySubScription", c_byte),
        ("byRes1", c_byte * 4),
        ("byAlarmTypeURL", c_byte),
        ("byCustomCtrl", c_byte),
    ]


# Global callback needs to be kept alive (Python ctypes callback lifetime)
CALLBACK_TYPE = CFUNCTYPE(None, c_long, c_void_p, c_void_p, c_uint, c_void_p)

# Shared queue between C callback thread and asyncio loop
_ALARM_QUEUE: Queue = Queue(maxsize=5000)


def _alarm_callback(lCommand, pAlarmer, pAlarmInfo, dwBufLen, pUser):
    """C callback runs in SDK thread. Minimal work, just enqueue."""
    try:
        alarm_type = ALARM_TYPE_MAP.get(lCommand, f"unknown_{hex(lCommand)}")
        _ALARM_QUEUE.put_nowait({
            "command": lCommand,
            "alarm_type": alarm_type,
            "user_id": pUser if pUser else 0,
            "buf_len": dwBufLen,
            "received_at": time.time(),
        })
    except Exception:
        # Queue full; drop event silently (backpressure)
        pass


# Persistent reference to prevent GC (critical for ctypes callbacks)
_alarm_callback_c = CALLBACK_TYPE(_alarm_callback)


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


def _fill_bytes(src: str, size: int) -> bytes:
    b = src.encode("utf-8")[: size - 1]
    return b + b"\x00" * (size - len(b))


class HikAlarmSession:
    def __init__(self, sdk, device_id: str, ip: str, port: int, user: str, password: str):
        self.sdk = sdk
        self.device_id = device_id
        self.ip = ip
        self.port = port
        self.user = user
        self.password = password
        self.user_handle: int = -1
        self.alarm_handle: int = -1

    def login(self) -> bool:
        info = NET_DVR_USER_LOGIN_INFO()
        ctypes.memset(byref(info), 0, ctypes.sizeof(info))
        ctypes.memmove(info.sDeviceAddress, _fill_bytes(self.ip, 129), 129)
        ctypes.memmove(info.sUserName, _fill_bytes(self.user, 64), 64)
        ctypes.memmove(info.sPassword, _fill_bytes(self.password, 64), 64)
        info.wPort = self.port

        device_info = NET_DVR_DEVICEINFO_V40()
        ctypes.memset(byref(device_info), 0, ctypes.sizeof(device_info))

        self.user_handle = self.sdk.NET_DVR_Login_V40(byref(info), byref(device_info))
        return self.user_handle >= 0

    def setup_alarm(self) -> bool:
        params = NET_DVR_SETUPALARM_PARAM_V50()
        ctypes.memset(byref(params), 0, ctypes.sizeof(params))
        params.dwSize = ctypes.sizeof(params)
        params.byLevel = 1
        params.byAlarmInfoType = 1
        params.byRetAlarmTypeV40 = 1
        params.byFaceAlarmDetection = 1
        params.byDeployType = 0

        self.alarm_handle = self.sdk.NET_DVR_SetupAlarmChan_V50(
            self.user_handle, byref(params), None, 0
        )
        return self.alarm_handle >= 0

    def cleanup(self) -> None:
        if self.alarm_handle >= 0:
            self.sdk.NET_DVR_CloseAlarmChan_V30(self.alarm_handle)
            self.alarm_handle = -1
        if self.user_handle >= 0:
            self.sdk.NET_DVR_Logout(self.user_handle)
            self.user_handle = -1


async def db_writer(pool: asyncpg.Pool, stop_event: asyncio.Event) -> None:
    """Drain alarm queue and INSERT into isapi_events."""
    loop = asyncio.get_running_loop()
    while not stop_event.is_set():
        try:
            alarm = await loop.run_in_executor(None, _ALARM_QUEUE.get, True, 1.0)
        except Exception:
            continue

        async with pool.acquire() as conn:
            try:
                await conn.execute(
                    """
                    INSERT INTO isapi_events (
                        id, tenant_id, event_type, severity,
                        occurred_at, raw_json
                    ) VALUES (
                        gen_random_uuid(),
                        'a0000000-0000-0000-0000-000000000001'::uuid,
                        $1, $2, NOW(), $3::jsonb
                    )
                    """,
                    alarm["alarm_type"],
                    "medium" if "motion" in alarm["alarm_type"] else "high",
                    json.dumps({
                        "source": "hik_sdk",
                        "command_hex": hex(alarm["command"]),
                        "user_handle": alarm["user_id"],
                        "buf_len": alarm["buf_len"],
                    }),
                )
            except Exception as e:
                LOG.warning("insert_alarm_failed", extra={"err": str(e)})


async def main() -> None:
    setup_logging()

    pg_dsn = os.environ["PG_DSN"]
    poll_interval = int(os.environ.get("POLL_INTERVAL", "300"))

    sdk = ctypes.CDLL(f"{HIK_LIB_DIR}/libhcnetsdk.so", mode=ctypes.RTLD_GLOBAL)
    sdk.NET_DVR_Init.restype = ctypes.c_bool
    sdk.NET_DVR_Login_V40.argtypes = [POINTER(NET_DVR_USER_LOGIN_INFO), POINTER(NET_DVR_DEVICEINFO_V40)]
    sdk.NET_DVR_Login_V40.restype = c_int
    sdk.NET_DVR_Logout.argtypes = [c_int]
    sdk.NET_DVR_SetupAlarmChan_V50.argtypes = [c_int, POINTER(NET_DVR_SETUPALARM_PARAM_V50), c_void_p, c_uint]
    sdk.NET_DVR_SetupAlarmChan_V50.restype = c_int
    sdk.NET_DVR_CloseAlarmChan_V30.argtypes = [c_int]
    sdk.NET_DVR_CloseAlarmChan_V30.restype = ctypes.c_bool
    sdk.NET_DVR_SetDVRMessageCallBack_V51.argtypes = [c_int, CALLBACK_TYPE, c_void_p]
    sdk.NET_DVR_SetDVRMessageCallBack_V51.restype = ctypes.c_bool
    sdk.NET_DVR_Cleanup.restype = None

    if not sdk.NET_DVR_Init():
        LOG.error("sdk_init_failed")
        sys.exit(1)

    # Register global message callback (once, before any SetupAlarmChan)
    sdk.NET_DVR_SetDVRMessageCallBack_V51(0, _alarm_callback_c, None)
    LOG.info("hik_alarm_sdk_initialized")

    pool = await asyncpg.create_pool(pg_dsn, min_size=1, max_size=3)
    stop_event = asyncio.Event()
    asyncio.create_task(db_writer(pool, stop_event))

    hik_user = os.environ.get("HIK_USER", "admin")
    hik_pass = os.environ["HIK_PASS_DEFAULT"]
    hik_pass_alt = os.environ.get("HIK_PASS_ALT", hik_pass)

    sessions: dict[str, HikAlarmSession] = {}

    try:
        while True:
            async with pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, ip_address, port
                    FROM devices
                    WHERE brand = 'hikvision' AND ip_address IS NOT NULL
                    """
                )

            for d in devices:
                dev_id = str(d["id"])
                if dev_id in sessions:
                    continue  # session already active
                pw = hik_pass_alt if any(tag in (d["name"] or "").lower()
                                          for tag in ["sur ", "norte", "terraza", "gym",
                                                      "pisquines", "portalegre", "ac ", "dvr "]) else hik_pass
                sess = HikAlarmSession(sdk, dev_id, d["ip_address"], d["port"], hik_user, pw)
                ok = await asyncio.get_running_loop().run_in_executor(None, sess.login)
                if ok:
                    if await asyncio.get_running_loop().run_in_executor(None, sess.setup_alarm):
                        sessions[dev_id] = sess
                        LOG.info("alarm_channel_registered", extra={"device_id": dev_id, "ip": d["ip_address"]})
                    else:
                        sess.cleanup()
                        LOG.warning("alarm_setup_failed", extra={"device_id": dev_id, "ip": d["ip_address"]})

            LOG.info("alarm_sessions_status", extra={"active": len(sessions), "total_devices": len(devices)})
            await asyncio.sleep(poll_interval)
    finally:
        stop_event.set()
        for s in sessions.values():
            s.cleanup()
        sdk.NET_DVR_Cleanup()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
