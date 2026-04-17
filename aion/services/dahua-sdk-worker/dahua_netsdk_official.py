#!/usr/bin/env python3
"""
Dahua NetSDK oficial 2.0.0.1 worker — usa el paquete oficial Python
(General_NetSDK_ChnEng_Python_linux64_IS_V3.060.0000003.0.R.251201).

Requisitos:
  pip install /opt/dahua-python-sdk/dist/NetSDK-2.0.0.1-py3-none-linux_x86_64.whl

Uso:
  - Para devices Dahua enterprise (con IP pública o LAN accesible vía VPN):
    se pasa IP + port en lugar de serial.
  - Para devices Imou/Easy4Ip: el SDK oficial NO soporta (validado 2026-04-17).
    Para esos usar Imou Open Platform API via imou-live-server.

Endpoints cubiertos por NetClient:
  - LoginWithHighLevelSecurity (login con TLS high level)
  - Logout
  - RealPlayEx (video preview stream)
  - StopRealPlayEx
  - SaveRealData (save RTSP to file)
  - SetAlarmListenPattern + StartListenEx (receive real-time alarms)
  - PTZControl, PTZPreset (PTZ control)
  - QueryNewSystemInfo, QueryDevConfig (device config read)
  - SetDevConfig (device config write)
  - CapturePicture (snapshot on-demand)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from ctypes import sizeof
from dataclasses import dataclass

import asyncpg
from pythonjsonlogger import jsonlogger

from NetSDK.NetSDK import NetClient
from NetSDK.SDK_Enum import EM_LOGIN_SPAC_CAP_TYPE
from NetSDK.SDK_Struct import (
    NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY,
    NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY,
    LOG_SET_PRINT_INFO,
)
from NetSDK.SDK_Callback import fDisConnect, fHaveReConnect


LOG = logging.getLogger("dahua-netsdk-official")


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    ))
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


@dataclass
class Config:
    pg_dsn: str
    dh_default_pass: str
    dh_arrezo_pass: str
    poll_interval: int
    use_cap: str  # TCP | P2P | CLOUD

    @classmethod
    def load(cls) -> "Config":
        return cls(
            pg_dsn=os.environ["PG_DSN"],
            dh_default_pass=os.environ.get("DH_DEFAULT_PASS", "Clave.seg2023"),
            dh_arrezo_pass=os.environ.get("DH_ARREZO_PASS", "Seg2025."),
            poll_interval=int(os.environ.get("POLL_INTERVAL", "300")),
            use_cap=os.environ.get("DH_LOGIN_CAP", "P2P"),
        )


def device_credentials(name: str, tags: list[str], cfg: Config) -> tuple[str, str]:
    user = "admin"
    for t in tags or []:
        if t.startswith("user:"):
            user = t.split(":", 1)[1]
            break
    if any("arrezo" in (t or "").lower() for t in tags or []) or "arrezo" in name.lower():
        return user, cfg.dh_arrezo_pass
    return user, cfg.dh_default_pass


def disconnect_cb(lLoginID, pchDVRIP, nDVRPort, dwUser):
    LOG.info("sdk_disconnect", extra={"login_id": lLoginID})


def reconnect_cb(lLoginID, pchDVRIP, nDVRPort, dwUser):
    LOG.info("sdk_reconnect", extra={"login_id": lLoginID})


async def poll_device(
    sdk: NetClient, pool: asyncpg.Pool,
    device_id: str, endpoint: str, port: int, user: str, password: str, cap: int,
) -> None:
    """Attempt login. If success update devices.last_seen; on fail log."""
    loop = asyncio.get_running_loop()

    def _login_sync() -> tuple[int, str, int]:
        in_param = NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY()
        in_param.dwSize = sizeof(NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY)
        in_param.szIP = endpoint.encode()
        in_param.nPort = port
        in_param.szUserName = user.encode()
        in_param.szPassword = password.encode()
        in_param.emSpecCap = cap
        in_param.pCapParam = None

        out_param = NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY()
        out_param.dwSize = sizeof(NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY)

        login_id, device_info, error_msg = sdk.LoginWithHighLevelSecurity(in_param, out_param)
        chans = device_info.nChanNum if login_id else 0
        if login_id:
            sdk.Logout(login_id)
        return login_id, error_msg, chans

    login_id, error_msg, chans = await loop.run_in_executor(None, _login_sync)
    status = "online" if login_id else "offline"

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE devices
            SET status = $1, last_seen = NOW(), updated_at = NOW(),
                channels = COALESCE(NULLIF($2, 0), channels)
            WHERE id = $3::uuid
            """,
            status, chans, device_id,
        )

    if login_id:
        LOG.info("device_online", extra={"endpoint": endpoint, "chans": chans})
    else:
        LOG.warning("device_offline", extra={"endpoint": endpoint, "error": error_msg})


async def main() -> None:
    setup_logging()
    cfg = Config.load()

    # Init SDK once
    sdk = NetClient()
    m_dc = fDisConnect(disconnect_cb)
    m_rc = fHaveReConnect(reconnect_cb)
    sdk.InitEx(m_dc)
    sdk.SetAutoReconnect(m_rc)

    # Enable SDK log file
    log_info = LOG_SET_PRINT_INFO()
    log_info.dwSize = sizeof(LOG_SET_PRINT_INFO)
    log_info.bSetFilePath = 1
    log_info.szLogFilePath = b"/var/log/aion/dahua-netsdk.log"
    sdk.LogOpen(log_info)

    LOG.info("dahua_netsdk_official_started", extra={"cap": cfg.use_cap})

    cap_value = getattr(EM_LOGIN_SPAC_CAP_TYPE, cfg.use_cap, EM_LOGIN_SPAC_CAP_TYPE.TCP)

    pool = await asyncpg.create_pool(cfg.pg_dsn, min_size=1, max_size=3)
    try:
        while True:
            async with pool.acquire() as conn:
                devices = await conn.fetch(
                    """
                    SELECT id, name, serial_number, ip_address, port, tags
                    FROM devices
                    WHERE brand = 'dahua'
                      AND (serial_number IS NOT NULL OR ip_address IS NOT NULL)
                    """
                )

            LOG.info("poll_cycle_start", extra={"count": len(devices)})
            for d in devices:
                user, password = device_credentials(d["name"] or "", d["tags"] or [], cfg)
                # Use IP if available (enterprise), fall back to serial (P2P)
                if d["ip_address"]:
                    endpoint = d["ip_address"]
                    port = d["port"] or 37777
                else:
                    endpoint = d["serial_number"]
                    port = 0

                try:
                    await poll_device(sdk, pool, str(d["id"]), endpoint, port, user, password, cap_value)
                except Exception as e:
                    LOG.error("poll_error", extra={"device_id": str(d["id"]), "err": str(e)})

            await asyncio.sleep(cfg.poll_interval)
    finally:
        sdk.Cleanup()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
