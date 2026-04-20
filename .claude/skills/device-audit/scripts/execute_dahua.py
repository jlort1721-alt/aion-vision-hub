#!/usr/bin/env python3
"""Real NetSDK Python 2.0.0.1 login probe for Dahua devices.

Runs ONLY when --execute was passed to run.sh and cooldown is clear.
Spacing 2.0 s, sequential. Dahua consumer Imou P2P logins typically
fail (SDK enterprise-only) — this is recorded rather than retried.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SPACING_S = 2.0
LOGIN_TIMEOUT_S = 5

try:  # NetSDK Python 2.0.0.1 — installed in /opt/dahua-netsdk-python/
    sys.path.insert(0, os.environ.get("DAHUA_NETSDK_PATH", "/opt/dahua-netsdk-python"))
    from NetSDK.NetSDK import NetClient  # type: ignore
    from NetSDK.SDK_Enum import EM_LOGIN_SPAC_CAP_TYPE  # type: ignore
    from NetSDK.SDK_Struct import NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY, NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY  # type: ignore
    SDK_OK = True
except Exception as exc:  # pragma: no cover — env without SDK
    SDK_OK = False
    SDK_ERR = str(exc)


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


def probe(client, host: str, port: int, user: str, password: str) -> tuple[bool, int]:
    inp = NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY()
    inp.dwSize = 148  # from NetSDK docs
    inp.szIP = host.encode()
    inp.nPort = port
    inp.szUserName = user.encode()
    inp.szPassword = password.encode()
    inp.emSpecCap = EM_LOGIN_SPAC_CAP_TYPE.TCP
    out = NET_OUT_LOGIN_WITH_HIGHLEVEL_SECURITY()
    login_id, err = client.LoginWithHighLevelSecurity(inp, out)
    if login_id:
        client.Logout(login_id)
        return True, 0
    return False, err


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--append", required=True, type=Path)
    p.add_argument("--brand", default=None)
    p.add_argument("--site", default=None)
    p.add_argument("--device", default=None)
    args = p.parse_args()

    header = f"\n\n## Dahua live probe — {datetime.now(timezone.utc).isoformat(timespec='seconds')}\n\n"
    if not SDK_OK:
        args.append.write_text(args.append.read_text() + header + f"_SDK not available_ (`{SDK_ERR}`)\n")
        return 0

    where = "d.brand='dahua' AND d.is_active=true"
    if args.site:
        where += f" AND s.slug='{args.site}'"
    if args.device:
        where += f" AND d.id='{args.device}'"
    rows = psql_rows(
        f"SELECT d.id,d.name,COALESCE(d.ip,''),COALESCE(d.port,37777),"
        f"COALESCE(d.username,'admin'),COALESCE(d.password,''),COALESCE(d.serial,'')"
        f" FROM devices d LEFT JOIN sites s ON s.id=d.site_id WHERE {where} ORDER BY d.name"
    )

    client = NetClient()
    client.InitEx()

    lines = [header, "| device | host | login | code | notes |", "|---|---|---|---|---|"]
    for dev_id, name, ip, port, user, password, serial in rows:
        host = ip or serial
        try:
            port_i = int(port)
        except ValueError:
            port_i = 37777
        if not host or not password:
            lines.append(f"| {name} | {host} | SKIP | - | missing host or password |")
            continue
        ok, code = probe(client, host, port_i, user, password)
        notes = "imou-p2p-incompatible" if code == 0x80000068 else ""
        lines.append(f"| {name} | {host}:{port_i} | {'OK' if ok else 'FAIL'} | {code} | {notes} |")
        time.sleep(SPACING_S)

    client.Cleanup()
    args.append.write_text(args.append.read_text() + "\n".join(lines) + "\n")
    print(f"[execute_dahua] appended {len(rows)} devices to {args.append}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
