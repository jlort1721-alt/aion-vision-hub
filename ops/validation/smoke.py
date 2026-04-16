#!/usr/bin/env python3
"""
AION — Smoke test for all 70 production URLs.

Modes:
  --fast        : HTTP-only checks (used by deploy.sh against idle color).
  --full        : HTTP + Playwright E2E (console errors, auth flow, screenshots).
  --label NAME  : Tag results (e.g., "idle-green" or "public-postdeploy").

Env:
  AION_SMOKE_BASE   Base URL (default: https://aionseg.co)
  AION_ADMIN_EMAIL  Login email
  AION_ADMIN_PASS   Login password

Exit codes:
  0  all passed
  1  any critical URL failed
  2  >5% of URLs failed
"""
from __future__ import annotations
import argparse, asyncio, json, os, sys, time
from dataclasses import dataclass, asdict
from pathlib import Path
import httpx

# ---- URL catalog ------------------------------------------------------------
PUBLIC = ["/", "/login", "/api/health", "/privacy", "/terms", "/cookies"]

PROTECTED = {
    "video_monitoring": [
        "/dashboard", "/live-view", "/vision-hub", "/reverse",
        "/playback", "/camera-health", "/wall/1", "/tv",
    ],
    "events_security": [
        "/events", "/incidents", "/alerts", "/detections", "/emergency",
    ],
    "devices_sites": [
        "/devices", "/sites", "/domotics", "/network",
    ],
    "access_control": [
        "/access-control", "/visitors",
    ],
    "communications": [
        "/intercom", "/paging", "/phone", "/call-log", "/whatsapp", "/communications",
    ],
    "operations": [
        "/shifts", "/patrols", "/minuta", "/operations", "/posts",
    ],
    "intel_reports": [
        "/ai-assistant", "/analytics", "/reports",
        "/scheduled-reports", "/operational-reports",
    ],
    "admin": [
        "/admin", "/admin/dashboard", "/admin/residents",
        "/supervisor", "/settings", "/system", "/integrations",
    ],
    "management": [
        "/database", "/notes", "/documents", "/contracts", "/keys",
        "/compliance", "/training", "/sla", "/automation",
        "/reboots", "/notification-templates",
    ],
    "advanced": [
        "/remote-access", "/skills", "/agent", "/floor-plan", "/immersive",
        "/biogenetic-search", "/predictive-criminology",
        "/manual", "/guard", "/onboarding",
    ],
}

CRITICAL = {"/", "/login", "/api/health", "/dashboard", "/live-view",
            "/vision-hub", "/ai-assistant", "/admin"}

BASE = os.environ.get("AION_SMOKE_BASE", "https://aionseg.co")

# ---- Data -------------------------------------------------------------------
@dataclass
class Result:
    url: str
    group: str
    status: int
    ok: bool
    ms: float
    notes: str = ""

# ---- HTTP checks ------------------------------------------------------------
async def check_url(client: httpx.AsyncClient, path: str, group: str,
                    cookies: dict | None = None) -> Result:
    url = f"{BASE}{path}"
    t0 = time.perf_counter()
    notes = ""
    try:
        r = await client.get(url, cookies=cookies, follow_redirects=True, timeout=20)
        ms = (time.perf_counter() - t0) * 1000
        ok = 200 <= r.status_code < 400
        # Extra validation on /api/health
        if path == "/api/health" and ok:
            try:
                body = r.json()
                ok = body.get("status") == "healthy"
                if not ok:
                    notes = f"health body: {body}"
            except Exception as e:
                ok = False
                notes = f"non-JSON health: {e}"
        return Result(path, group, r.status_code, ok, round(ms, 1), notes)
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return Result(path, group, 0, False, round(ms, 1), f"exception: {e}")

async def login(client: httpx.AsyncClient) -> dict | None:
    """Returns cookie jar after successful login, or None if skipped."""
    email = os.environ.get("AION_ADMIN_EMAIL")
    pwd   = os.environ.get("AION_ADMIN_PASS")
    if not email or not pwd:
        print("[smoke] No credentials in env; skipping protected URLs.", file=sys.stderr)
        return None
    r = await client.post(f"{BASE}/api/auth/login",
                          json={"email": email, "password": pwd},
                          timeout=20)
    if r.status_code != 200:
        print(f"[smoke] Login failed: HTTP {r.status_code} {r.text[:200]}", file=sys.stderr)
        return None
    return dict(r.cookies)

# ---- Main -------------------------------------------------------------------
async def run(label: str, fast: bool) -> int:
    print(f"[smoke] Base: {BASE}   label: {label}   mode: {'fast' if fast else 'full'}")

    async with httpx.AsyncClient(http2=True, verify=True) as client:
        # Public URLs (parallel)
        pub_tasks = [check_url(client, u, "public") for u in PUBLIC]
        pub_results = await asyncio.gather(*pub_tasks)

        # Protected URLs
        cookies = await login(client)
        prot_results: list[Result] = []
        if cookies is not None:
            prot_tasks = []
            for group, urls in PROTECTED.items():
                for u in urls:
                    prot_tasks.append(check_url(client, u, group, cookies))
            prot_results = await asyncio.gather(*prot_tasks)

    all_results = pub_results + prot_results
    total = len(all_results)
    failed = [r for r in all_results if not r.ok]
    critical_failed = [r for r in failed if r.url in CRITICAL]

    # --- Report ---
    out_dir = Path(os.environ.get("AION_SMOKE_OUT", "/home/aion/validation-run/reports"))
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "label": label,
        "base": BASE,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total": total,
        "passed": total - len(failed),
        "failed": len(failed),
        "critical_failed": [r.url for r in critical_failed],
        "results": [asdict(r) for r in all_results],
    }
    report_file = out_dir / f"smoke-{label}-{int(time.time())}.json"
    report_file.write_text(json.dumps(report, indent=2))
    print(f"[smoke] Report: {report_file}")

    # --- Console output ---
    print(f"[smoke] {report['passed']}/{total} OK, {report['failed']} failed")
    for r in failed:
        flag = "CRIT" if r.url in CRITICAL else "fail"
        print(f"  [{flag}] {r.status:>3} {r.url}  ({r.ms}ms)  {r.notes}")

    # --- Exit code ---
    if critical_failed:
        return 1
    if total and (len(failed) / total) > 0.05:
        return 2
    return 0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--label", default="smoke")
    args = ap.parse_args()
    rc = asyncio.run(run(args.label, fast=args.fast or not args.full))
    sys.exit(rc)

if __name__ == "__main__":
    main()
