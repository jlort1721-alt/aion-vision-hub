#!/usr/bin/env python3
"""Real HCNetSDK login probe for Hikvision devices.

Runs ONLY when `--execute` was passed to run.sh, and after the cooldown
guard has cleared. Spacing between logins is 1.5 s; concurrency is 1.

Appends a section to the report produced by dry_run.py.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from ctypes import CDLL, Structure, byref, c_byte, c_char, c_int, c_long, c_ubyte
from datetime import datetime, timezone
from pathlib import Path

LIB = os.environ.get("HCNETSDK_LIB", "/opt/hik-sdk/lib64/libhcnetsdk.so")
LOGIN_TIMEOUT_MS = 5000
SPACING_S = 1.5

PWD_FIELDS = ("password", "password_alt", "password_alt2")


class NetDvrUserLoginV40(Structure):
    # Truncated struct — only sDeviceAddress, wPort, sUserName, sPassword.
    _fields_ = [
        ("sDeviceAddress", c_char * 129),
        ("byUseTransport", c_byte),
        ("wPort", c_int),
        ("sUserName", c_char * 64),
        ("sPassword", c_char * 64),
        ("cbLoginResult", c_long),
        ("pUser", c_long),
        ("bUseAsynLogin", c_int),
        ("byProxyType", c_byte),
        ("byUseUTCTime", c_byte),
        ("byRes3", c_byte * 120),
    ]


def load_sdk():
    try:
        lib = CDLL(LIB)
    except OSError as e:
        sys.stderr.write(f"[execute_hik] failed to load {LIB}: {e}\n")
        return None
    lib.NET_DVR_Init()
    lib.NET_DVR_SetConnectTime(LOGIN_TIMEOUT_MS, 1)
    return lib


def psql_rows(query: str) -> list[list[str]]:
    url = os.environ.get("DATABASE_URL") or _load_db_url()
    cmd = ["psql", url, "-At", "-F", "\t", "-c", query]
    out = subprocess.run(cmd, check=True, text=True, capture_output=True)
    return [line.split("\t") for line in out.stdout.splitlines() if line]


def _load_db_url() -> str:
    secrets = Path("/etc/aion/secrets/device-credentials.env")
    if not secrets.exists():
        sys.exit("DATABASE_URL missing")
    for line in secrets.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    sys.exit("DATABASE_URL missing in secrets")


def probe(lib, ip: str, port: int, user: str, password: str) -> tuple[bool, int]:
    info = NetDvrUserLoginV40()
    info.sDeviceAddress = ip.encode()
    info.wPort = port
    info.sUserName = user.encode()
    info.sPassword = password.encode()
    dev = info.NET_DVR_Login_V40 = lib.NET_DVR_Login_V40(byref(info), 0)
    if dev < 0:
        return False, lib.NET_DVR_GetLastError()
    lib.NET_DVR_Logout(dev)
    return True, 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--append", required=True, type=Path)
    p.add_argument("--brand", default=None)
    p.add_argument("--site", default=None)
    p.add_argument("--device", default=None)
    args = p.parse_args()

    lib = load_sdk()
    if lib is None:
        args.append.write_text(
            args.append.read_text()
            + "\n\n## Hikvision live probe — SKIPPED\n\n_SDK not available in this environment._\n"
        )
        return 0

    where = "d.brand='hikvision' AND d.is_active=true"
    if args.site:
        where += f" AND s.slug='{args.site}'"
    if args.device:
        where += f" AND d.id='{args.device}'"
    rows = psql_rows(
        f"SELECT d.id,d.name,d.ip,d.port,d.username,d.password,d.password_alt,d.password_alt2 "
        f"FROM devices d LEFT JOIN sites s ON s.id=d.site_id WHERE {where} ORDER BY d.name"
    )

    report_lines = [
        "",
        f"## Hikvision live probe — {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        "| device | ip:port | login | code | password_field |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        dev_id, name, ip, port, user, *passwords = r
        ok = False
        code = 0
        used_field = "-"
        for idx, pwd in enumerate(passwords):
            if not pwd:
                continue
            ok, code = probe(lib, ip, int(port), user, pwd)
            used_field = PWD_FIELDS[idx]
            if ok:
                break
            if code in (7, 153, 10):  # NET_FAIL, NET_TIMEOUT, SEND_ERR — stop trying
                break
        status = "OK" if ok else "FAIL"
        report_lines.append(f"| {name} | {ip}:{port} | {status} | {code} | {used_field if ok else '-'} |")
        time.sleep(SPACING_S)

    lib.NET_DVR_Cleanup()
    existing = args.append.read_text() if args.append.exists() else ""
    args.append.write_text(existing + "\n".join(report_lines) + "\n")
    print(f"[execute_hik] appended {len(rows)} devices to {args.append}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
