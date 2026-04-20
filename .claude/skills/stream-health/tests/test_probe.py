"""Tests for stream-health probe.sh — exercises against a mock go2rtc server."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
PROBE_SH = SKILL_DIR / "scripts" / "probe.sh"


class TestProbeBasics:
    def test_probe_default_succeeds(self, run_probe, tmp_path):
        proc = run_probe()
        assert proc.returncode == 0, f"stderr={proc.stderr}"
        report = tmp_path / "stream-report.md"
        assert report.exists()

    def test_probe_aborts_if_go2rtc_unreachable(self, tmp_path):
        env = os.environ.copy()
        env["GO2RTC_API"] = "http://127.0.0.1:1"  # invalid port
        output = tmp_path / "stream-report.md"
        proc = subprocess.run(
            ["bash", str(PROBE_SH), f"--output={output}"],
            capture_output=True, text=True, env=env, timeout=10,
        )
        assert proc.returncode == 3
        assert "not reachable" in proc.stderr

    def test_report_has_markdown_header(self, run_probe, tmp_path):
        run_probe()
        content = (tmp_path / "stream-report.md").read_text()
        assert content.startswith("# stream-health")
        assert "go2rtc endpoint:" in content
        assert "streams matched:" in content

    def test_table_header_present(self, run_probe, tmp_path):
        run_probe()
        content = (tmp_path / "stream-report.md").read_text()
        assert "| name | producer | consumers | src | hls_http | ttfb_ms | notes |" in content


class TestProbeContent:
    def test_all_mock_streams_appear_in_report(self, run_probe, tmp_path):
        run_probe()
        content = (tmp_path / "stream-report.md").read_text()
        assert "hik_portal_plaza_ch1" in content
        assert "hik_portal_plaza_ch2" in content
        assert "da-danubios-ch0" in content

    def test_stream_count_matches_fixture(self, run_probe, tmp_path):
        run_probe()
        content = (tmp_path / "stream-report.md").read_text()
        # Fixture has 3 streams
        assert "streams matched: 3" in content


class TestProbeFiltering:
    def test_filter_limits_streams_in_report(self, run_probe, tmp_path):
        run_probe("--filter=^hik_.*")
        content = (tmp_path / "stream-report.md").read_text()
        assert "hik_portal_plaza_ch1" in content
        assert "da-danubios-ch0" not in content, "filter leak: da- included"

    def test_filter_reflected_in_header(self, run_probe, tmp_path):
        run_probe("--filter=test-pattern")
        content = (tmp_path / "stream-report.md").read_text()
        assert "filter: test-pattern" in content


class TestProbeHLS:
    def test_probe_hls_default_off(self, run_probe, tmp_path):
        run_probe()
        content = (tmp_path / "stream-report.md").read_text()
        # Without --probe-hls, hls_http column should show "-"
        # (table row value). Look for at least one such row
        rows = [l for l in content.splitlines() if l.startswith("| hik_") or l.startswith("| da-")]
        assert rows, "no data rows found"
        for row in rows:
            cells = [c.strip() for c in row.split("|") if c.strip()]
            # cells: name, producer, consumers, src, hls_http, ttfb_ms, notes
            if len(cells) >= 5:
                assert cells[4] == "-", f"hls_http should be '-' without --probe-hls: {row}"

    def test_probe_hls_fetches_http_status(self, run_probe, tmp_path):
        run_probe("--probe-hls")
        content = (tmp_path / "stream-report.md").read_text()
        rows = [l for l in content.splitlines() if l.startswith("| hik_") or l.startswith("| da-")]
        assert rows, "no data rows found"
        # With --probe-hls, at least one row should have 200 (connected streams)
        has_200 = any("| 200 |" in row for row in rows)
        has_404 = any("| 404 |" in row for row in rows)
        assert has_200, "expected at least one HLS 200 response"
        # The disconnected stream should be 404
        assert has_404, "expected at least one HLS 404 response for disconnected stream"


class TestProbeArgValidation:
    def test_unknown_arg_rejected(self, run_probe):
        proc = run_probe("--nonsense")
        assert proc.returncode == 2
        assert "Unknown arg" in proc.stderr
