#!/usr/bin/env python3
"""OpenClaw Prometheus Exporter — REAL, reads /home/openclaw/devops/reports/*.json.

Polls the latest report file every 30s and exposes gauges that feed the
aion-specific alert rules (docs/runbooks/alertmanager-aion-rules-apply.md):

  openclaw_iteration_last_completed_at  Unix ts of last report
  openclaw_iteration_count              Latest iteration number
  openclaw_health_errors                health.errors from last report
  openclaw_proactive_alerts             len(proactive_alerts) from last
  openclaw_recent_errors_count          recent_errors_count
  openclaw_pm2_restarts_seen            len(pm2_restarts) last report
  openclaw_reports_dir_files            total files in reports/
  openclaw_exporter_scrape_errors       counter of scrape failures

This replaces the fake random.randint() exporter that Gemini committed
in dc9b3ba (reverted via PR #66).

Runtime: stdlib + prometheus_client. Non-root (runs as openclaw).
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

from prometheus_client import Counter, Gauge, start_http_server

LOG = logging.getLogger("openclaw-exporter")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)

REPORTS_DIR = Path(os.environ.get("OPENCLAW_REPORTS_DIR", "/home/openclaw/devops/reports"))
SCRAPE_INTERVAL = int(os.environ.get("OPENCLAW_SCRAPE_INTERVAL", "30"))
LISTEN_PORT = int(os.environ.get("OPENCLAW_EXPORTER_PORT", "9109"))

# --- Metrics ---------------------------------------------------------------
M_ITER_LAST_AT = Gauge(
    "openclaw_iteration_last_completed_at",
    "Unix timestamp of the most recent OpenClaw report",
)
M_ITER_COUNT = Gauge(
    "openclaw_iteration_count",
    "OpenClaw iteration counter value from the latest report",
)
M_HEALTH_ERRORS = Gauge(
    "openclaw_health_errors",
    "Accumulated health.errors count from the latest report",
)
M_PROACTIVE_ALERTS = Gauge(
    "openclaw_proactive_alerts",
    "Number of proactive_alerts entries in the latest report",
)
M_RECENT_ERRORS = Gauge(
    "openclaw_recent_errors_count",
    "recent_errors_count field from the latest report",
)
M_PM2_RESTARTS = Gauge(
    "openclaw_pm2_restarts_seen",
    "Length of pm2_restarts[] in the latest report",
)
M_REPORTS_FILES = Gauge(
    "openclaw_reports_dir_files",
    "Total number of JSON report files in the reports directory",
)
M_SCRAPE_ERRORS = Counter(
    "openclaw_exporter_scrape_errors_total",
    "Errors encountered while scraping the latest report",
)
M_EXPORTER_UP = Gauge(
    "openclaw_exporter_up",
    "1 when exporter loop is actively updating metrics, 0 otherwise",
)


def latest_report_path() -> Path | None:
    try:
        files = sorted(REPORTS_DIR.glob("analysis-*.json"))
    except OSError as exc:
        LOG.warning("reports dir not readable: %s", exc)
        return None
    return files[-1] if files else None


def parse_iso_timestamp(text: str) -> float:
    """Parse a report timestamp (ISO-8601 with offset) into Unix seconds."""
    from datetime import datetime

    normalized = text.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).timestamp()


def scrape_once() -> bool:
    """Update all metrics from the latest report. Returns True on success."""
    path = latest_report_path()
    if path is None:
        LOG.debug("no reports found in %s", REPORTS_DIR)
        return False

    try:
        with path.open("r", encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        LOG.warning("failed to read %s: %s", path, exc)
        M_SCRAPE_ERRORS.inc()
        return False

    try:
        ts = report.get("timestamp")
        if ts:
            M_ITER_LAST_AT.set(parse_iso_timestamp(ts))
        if "iteration" in report:
            M_ITER_COUNT.set(int(report["iteration"]))
        health = report.get("health") or {}
        if isinstance(health, dict) and "errors" in health:
            M_HEALTH_ERRORS.set(int(health["errors"]))
        alerts = report.get("proactive_alerts") or []
        M_PROACTIVE_ALERTS.set(len(alerts) if isinstance(alerts, list) else 0)
        M_RECENT_ERRORS.set(int(report.get("recent_errors_count", 0)))
        restarts = report.get("pm2_restarts") or []
        M_PM2_RESTARTS.set(len(restarts) if isinstance(restarts, list) else 0)
        all_files = list(REPORTS_DIR.glob("analysis-*.json"))
        M_REPORTS_FILES.set(len(all_files))
        return True
    except (TypeError, ValueError) as exc:
        LOG.warning("report parse error in %s: %s", path, exc)
        M_SCRAPE_ERRORS.inc()
        return False


def main() -> int:
    LOG.info(
        "openclaw-exporter starting (reports=%s, port=%s, interval=%ds)",
        REPORTS_DIR,
        LISTEN_PORT,
        SCRAPE_INTERVAL,
    )
    if not REPORTS_DIR.exists():
        LOG.error("reports dir does not exist: %s", REPORTS_DIR)
        # Still start the HTTP server so Prometheus sees the exporter and
        # the openclaw_exporter_up=0 signal flags the misconfiguration.
    try:
        start_http_server(LISTEN_PORT)
    except OSError as exc:
        LOG.error("failed to bind :%d — %s", LISTEN_PORT, exc)
        return 1

    while True:
        ok = scrape_once()
        M_EXPORTER_UP.set(1 if ok else 0)
        time.sleep(SCRAPE_INTERVAL)


if __name__ == "__main__":
    sys.exit(main())
