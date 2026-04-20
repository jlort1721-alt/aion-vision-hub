#!/usr/bin/env python3
"""Dry-run inventory for device-audit skill.

Queries aionseg_prod.devices and last_event timestamps without
touching any DVR/NVR SDK. Writes a Markdown report.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Iterable

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


def env_db_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    secrets = Path("/etc/aion/secrets/device-credentials.env")
    if secrets.exists():
        for line in secrets.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("DATABASE_URL not set and secrets file missing")


def psql(query: str) -> list[list[str]]:
    url = env_db_url()
    cmd = ["psql", url, "-At", "-F", "\t", "-c", query]
    out = subprocess.run(cmd, check=True, text=True, capture_output=True)
    rows = [line.split("\t") for line in out.stdout.splitlines() if line]
    return rows


def build_where(brand: str | None, site: str | None, device: str | None) -> str:
    clauses = ["d.is_active = true"]
    if brand:
        clauses.append(f"LOWER(d.brand) = '{brand.lower()}'")
    if site:
        clauses.append(f"s.slug = '{site}'")
    if device:
        clauses.append(f"d.id = '{device}'")
    return "WHERE " + " AND ".join(clauses)


def stale_flag(last_seen: str) -> str:
    if not last_seen or last_seen == "":
        return "NEVER"
    try:
        ts = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
    except ValueError:
        return "UNKNOWN"
    age = datetime.now(timezone.utc) - ts
    if age.total_seconds() > 6 * 3600:
        return "IN-DB-STALE"
    return "IN-DB"


def format_rows(rows: Iterable[list[str]]) -> str:
    lines = []
    for r in rows:
        if len(r) < 6:
            continue
        name, brand, site, target, last_seen, firmware = r[:6]
        lines.append(
            f"| {name} | {brand} | {site} | {target} | {last_seen or '-'} | {stale_flag(last_seen)} |"
        )
    return "\n".join(lines)


def summarize(rows: list[list[str]]) -> dict:
    total = len(rows)
    stale = sum(1 for r in rows if stale_flag(r[4] if len(r) > 4 else "") == "IN-DB-STALE")
    never = sum(1 for r in rows if stale_flag(r[4] if len(r) > 4 else "") == "NEVER")
    return {"total": total, "stale": stale, "never": never, "fresh": total - stale - never}


def render(report: Path, rows: list[list[str]], mode: str, filters: dict) -> None:
    tpl = (TEMPLATE_DIR / "report.md.tpl").read_text()
    body = format_rows(rows) or "_(no devices match filters)_"
    summary = summarize(rows)
    out = Template(tpl).safe_substitute(
        timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        mode=mode,
        brand_filter=filters.get("brand") or "all",
        site_filter=filters.get("site") or "all",
        device_filter=filters.get("device") or "all",
        body=body,
        total=summary["total"],
        fresh=summary["fresh"],
        stale=summary["stale"],
        never=summary["never"],
    )
    report.write_text(out)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--report", required=True, type=Path)
    p.add_argument("--brand", default=None)
    p.add_argument("--site", default=None)
    p.add_argument("--device", default=None)
    args = p.parse_args()

    where = build_where(args.brand, args.site, args.device)
    query = f"""
        SELECT d.name, d.brand, COALESCE(s.slug, '-'),
               COALESCE(d.ip || ':' || d.port, d.serial, '-'),
               to_char(d.last_seen, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
               COALESCE(d.firmware, '-')
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        {where}
        ORDER BY d.brand, s.slug NULLS LAST, d.name
    """
    try:
        rows = psql(query)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(f"[dry_run] psql failed:\n{e.stderr}\n")
        return 1
    render(args.report, rows, "DRY-RUN", {"brand": args.brand, "site": args.site, "device": args.device})
    print(f"[dry_run] wrote {args.report} ({len(rows)} devices)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
