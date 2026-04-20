#!/usr/bin/env python3
"""Imou Open Platform — HLS URL refresher.

Endpoint ref: https://open.imoulife.com/book/
Algorithm: signed request with sign = md5(appId + appSecret + time + nonce).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
from pathlib import Path

API_BASE = os.environ.get("IMOU_API_BASE", "https://openapi.easy4ip.com/openapi")
APP_ID = os.environ["IMOU_APP_ID"]
APP_SECRET = os.environ["IMOU_APP_SECRET"]
GO2RTC_FRAGMENT = Path("/etc/aion/go2rtc-imou.fragment.yaml")


def imou_call(method: str, params: dict) -> dict:
    now = str(int(time.time()))
    nonce = uuid.uuid4().hex
    sign_raw = f"time:{now},nonce:{nonce},appSecret:{APP_SECRET}"
    sign = hashlib.md5(sign_raw.encode()).hexdigest()
    body = {
        "system": {
            "ver": "1.0",
            "sign": sign,
            "appId": APP_ID,
            "time": now,
            "nonce": nonce,
        },
        "params": params,
        "id": str(int(time.time() * 1000)),
    }
    url = f"{API_BASE}/{method}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "body": e.read().decode("utf-8", "ignore")}
    except Exception as e:
        return {"error": str(e)}
    return data


def db_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    secrets = Path("/etc/aion/secrets/device-credentials.env")
    if secrets.exists():
        for line in secrets.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    sys.exit("DATABASE_URL missing")


def psql(query: str) -> list[list[str]]:
    cmd = ["psql", db_url(), "-At", "-F", "\t", "-c", query]
    out = subprocess.run(cmd, check=True, text=True, capture_output=True)
    return [line.split("\t") for line in out.stdout.splitlines() if line]


def obfuscate(url: str) -> str:
    if not url:
        return "-"
    return url.split("?", 1)[0] + "?…(signature redacted)"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--device", default=None)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    where = "brand='dahua' AND is_active=true AND serial IS NOT NULL"
    if args.device:
        where += f" AND serial='{args.device}'"
    rows = psql(f"SELECT id, name, serial FROM devices WHERE {where} ORDER BY name")

    lines = [
        f"# imou-refresh — {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        f"",
        f"- dry-run: {args.dry_run}",
        f"- devices matched: {len(rows)}",
        "",
        "| serial | name | hls_url | expires_at | status |",
        "|---|---|---|---|---|",
    ]

    fragment_lines = ["streams:"]
    ok = 0
    for dev_id, name, serial in rows:
        resp = imou_call("accessToken", {})
        token = (resp.get("result") or {}).get("data", {}).get("accessToken")
        if not token:
            lines.append(f"| {serial} | {name} | - | - | ACCESS-TOKEN-FAIL |")
            continue
        live = imou_call("getLiveStreamInfo", {"token": token, "deviceId": serial, "channelId": "0"})
        streams = (live.get("result") or {}).get("data", {}).get("streams", [])
        hls = next((s.get("hls") for s in streams if s.get("hls")), None)
        expires_at = None
        if hls:
            # HLS URLs embed a 'time=' epoch param; best-effort parse.
            for part in hls.split("&"):
                if part.startswith(("time=", "expire=", "t=")):
                    try:
                        expires_at = datetime.fromtimestamp(int(part.split("=", 1)[1]), tz=timezone.utc).isoformat()
                    except Exception:
                        pass
        status = "OK" if hls else "NO-STREAM"
        lines.append(f"| {serial} | {name} | {obfuscate(hls or '')} | {expires_at or '-'} | {status} |")
        if hls:
            ok += 1
            fragment_lines.append(f"  imou_{serial.lower()}: {hls}")
            if not args.dry_run:
                subprocess.run(
                    ["psql", db_url(), "-c",
                     f"UPDATE devices SET hls_url=%s, hls_expires_at=%s WHERE id='{dev_id}'"],
                    check=False,
                )
        time.sleep(0.25)  # rate limit
    args.out.write_text("\n".join(lines) + "\n")

    if not args.dry_run and ok:
        try:
            GO2RTC_FRAGMENT.write_text("\n".join(fragment_lines) + "\n")
            os.chmod(GO2RTC_FRAGMENT, 0o640)
        except PermissionError:
            sys.stderr.write("[imou-refresh] cannot write go2rtc fragment (run as root)\n")

    print(f"[imou-refresh] ok={ok}/{len(rows)} → {args.out}")
    return 0 if ok == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
