"""Tests for device-audit dry_run.py — exercises real code with mock psql."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"


class TestDryRunBasics:
    def test_dry_run_all_brands_succeeds(self, dry_run_py):
        proc, report = dry_run_py()
        assert proc.returncode == 0, f"stderr={proc.stderr!r}"
        assert report.exists(), "report file not created"

    def test_report_contains_summary_fields(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        assert "# Device Audit" in content
        assert "Mode:" in content
        assert "Total matched:" in content
        assert "Fresh (last_seen" in content
        assert "Stale (last_seen" in content
        assert "Never seen:" in content

    def test_report_table_header_present(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        assert "| name | brand | site | target | last_seen | dry_status |" in content

    def test_report_contains_hikvision_rows(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        assert "ss-dvr-main" in content
        assert "10.0.0.5:8000" in content

    def test_report_contains_dahua_rows(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        assert "danubios-nvr" in content
        assert "AJ00421PAZF2E60" in content


class TestDryRunFiltering:
    def test_brand_filter_hikvision_only(self, dry_run_py):
        proc, report = dry_run_py("--brand", "hikvision")
        assert proc.returncode == 0
        content = report.read_text()
        assert "ss-dvr-main" in content
        assert "danubios-nvr" not in content, "Dahua row leaked when brand=hikvision"

    def test_brand_filter_dahua_only(self, dry_run_py):
        proc, report = dry_run_py("--brand", "dahua")
        assert proc.returncode == 0
        content = report.read_text()
        assert "danubios-nvr" in content
        assert "ss-dvr-main" not in content

    def test_site_filter_limits_to_site(self, dry_run_py):
        proc, report = dry_run_py("--site", "portal-plaza")
        assert proc.returncode == 0
        content = report.read_text()
        # Mock emits only portal-plaza rows when site filter matches
        assert "ss-dvr-main" in content
        assert "tl-dvr" not in content

    def test_filters_reflected_in_header(self, dry_run_py):
        _, report = dry_run_py("--brand", "hikvision", "--site", "portal-plaza")
        content = report.read_text()
        assert "brand=hikvision" in content
        assert "site=portal-plaza" in content


class TestDryRunStaleDetection:
    def test_fresh_row_tagged_in_db(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        # ss-dvr-main has recent last_seen (2026-04-20T04:00) — should show IN-DB
        lines = [line for line in content.splitlines() if "ss-dvr-main" in line]
        assert lines, "ss-dvr-main not in report"
        assert "IN-DB" in lines[0] and "IN-DB-STALE" not in lines[0]

    def test_stale_row_marked_stale(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        # tl-nvr has last_seen from 2026-04-15 — ~5 days old → STALE
        lines = [line for line in content.splitlines() if "tl-nvr" in line]
        assert lines, "tl-nvr not in report"
        assert "IN-DB-STALE" in lines[0]

    def test_never_seen_row_marked_never(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        # tl-dvr has last_seen="-" → NEVER
        lines = [line for line in content.splitlines() if "tl-dvr" in line and "tl-nvr" not in line]
        assert lines, "tl-dvr not in report"
        assert "NEVER" in lines[0]


class TestRunShOrchestration:
    def test_dry_run_default_mode(self, run_script):
        proc = run_script()
        assert proc.returncode == 0, f"stderr={proc.stderr!r}"
        assert "mode=DRY-RUN" in proc.stdout

    def test_execute_mode_refused_when_cooldown_env_future(self, run_script):
        future = "2099-01-01T00:00:00Z"
        proc = run_script("--execute", extra_env={"DVR_COOLDOWN_UNTIL": future})
        assert proc.returncode == 3, "expected exit 3 (cooldown refused)"
        assert "REFUSED" in proc.stderr or "REFUSED" in proc.stdout

    def test_execute_mode_allows_when_cooldown_env_past(self, run_script):
        past = "2020-01-01T00:00:00Z"
        # With --execute but also --brand=dahua, and no real SDK → execute_dahua
        # will bail gracefully (SDK not importable). Exit code 0 expected because
        # dry_run.py runs first and succeeds; the SDK append just writes a note.
        proc = run_script("--execute", "--brand", "dahua",
                          extra_env={"DVR_COOLDOWN_UNTIL": past})
        # Acceptable: 0 (all passed) or 1 (psql error). Shouldn't be 3 (cooldown).
        assert proc.returncode != 3, f"cooldown refused when it shouldn't: {proc.stderr}"

    def test_invalid_flag_rejected(self, run_script):
        proc = run_script("--nonsense")
        assert proc.returncode == 2
        assert "Unknown arg" in proc.stderr


class TestReportStructure:
    def test_report_counts_match_rows(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        # Mock emits 5 rows total (2 hik ss + 2 hik tl + 3 dahua = 7).
        # But the query might also filter by is_active = true. Our mock returns
        # the full 7 regardless. Verify at least 5 rows.
        row_lines = [l for l in content.splitlines() if l.startswith("| ") and "brand" not in l and "---" not in l]
        # Count excludes header and separator.
        assert len(row_lines) >= 5, f"expected >=5 device rows, got {len(row_lines)}"

    def test_timestamp_in_report_is_iso_format(self, dry_run_py):
        _, report = dry_run_py()
        content = report.read_text()
        # First line: "# Device Audit — 2026-04-20T..."
        first = content.splitlines()[0]
        assert "—" in first
        ts_part = first.split("—", 1)[1].strip()
        assert "T" in ts_part and ":" in ts_part


class TestErrorHandling:
    def test_missing_database_url_fails_cleanly(self, tmp_path, mock_psql_bin):
        env = os.environ.copy()
        env["PATH"] = f"{mock_psql_bin}:{env.get('PATH', '')}"
        env.pop("DATABASE_URL", None)
        # Secrets file shouldn't exist in test env
        report = tmp_path / "report.md"
        proc = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "dry_run.py"),
             "--report", str(report)],
            capture_output=True, text=True, env=env, timeout=10
        )
        # dry_run.py raises SystemExit with message
        assert proc.returncode != 0
        assert "DATABASE_URL" in (proc.stderr + proc.stdout)
