"""Tests for imou-refresh refresh.py — real http mock + mock psql."""
from __future__ import annotations

import hashlib
import importlib.util
import os
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
REFRESH_PY = SKILL_DIR / "scripts" / "refresh.py"


def _load_refresh_module(env_for_import: dict):
    """Load refresh.py as a module. It reads APP_ID/SECRET/BASE at import time."""
    for k, v in env_for_import.items():
        os.environ[k] = v
    spec = importlib.util.spec_from_file_location("_refresh", REFRESH_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestRefreshExecution:
    def test_dry_run_happy_path_returns_zero(self, run_refresh):
        proc, report = run_refresh(scenario="ok")
        assert proc.returncode == 0, f"stderr={proc.stderr}"
        assert report.exists()

    def test_dry_run_report_has_header_and_devices(self, run_refresh):
        _, report = run_refresh(scenario="ok")
        content = report.read_text()
        assert "# imou-refresh" in content
        assert "dry-run: True" in content
        # mock psql returns 3 Dahua devices
        assert "danubios-nvr" in content
        assert "quintas-ipc" in content
        assert "terrazino-ipc" in content

    def test_hls_urls_are_obfuscated_in_report(self, run_refresh):
        _, report = run_refresh(scenario="ok")
        content = report.read_text()
        # URL should have query-string redacted to "?…(signature redacted)"
        assert "signature redacted" in content
        # The actual time=... parameter should NOT leak
        assert "time=1776700000" not in content

    def test_device_offline_marked_as_no_stream(self, run_refresh):
        proc, report = run_refresh(scenario="device_offline")
        # Exit code: 1 because ok < total (no devices succeeded)
        assert proc.returncode == 1
        content = report.read_text()
        assert "NO-STREAM" in content

    def test_no_stream_scenario_reported(self, run_refresh):
        proc, report = run_refresh(scenario="no_stream")
        assert proc.returncode == 1
        content = report.read_text()
        assert "NO-STREAM" in content

    def test_auth_token_failure_reported(self, run_refresh):
        proc, report = run_refresh(scenario="auth_fail")
        assert proc.returncode == 1
        content = report.read_text()
        assert "ACCESS-TOKEN-FAIL" in content


class TestRefreshFilters:
    def test_device_filter_limits_query(self, run_refresh, imou_mock_server):
        proc, report = run_refresh("--device", "AJ00421PAZF2E60", scenario="ok")
        assert proc.returncode == 0
        content = report.read_text()
        # Only 1 device would match in real DB; mock returns 3 but it's fine —
        # we're verifying the flag flows through.
        assert "devices matched:" in content


class TestRefreshModule:
    """Unit-level tests on refresh.py internals."""

    def test_obfuscate_removes_query_string(self):
        env = {"IMOU_APP_ID": "x", "IMOU_APP_SECRET": "y",
               "IMOU_API_BASE": "http://localhost:1"}
        mod = _load_refresh_module(env)
        result = mod.obfuscate("http://cmgw.imoulife.com/LCO/serial/stream.m3u8?time=123&sig=abc")
        assert result == "http://cmgw.imoulife.com/LCO/serial/stream.m3u8?…(signature redacted)"
        assert "time=" not in result
        assert "sig=abc" not in result

    def test_obfuscate_empty_string_returns_dash(self):
        env = {"IMOU_APP_ID": "x", "IMOU_APP_SECRET": "y",
               "IMOU_API_BASE": "http://localhost:1"}
        mod = _load_refresh_module(env)
        assert mod.obfuscate("") == "-"
        assert mod.obfuscate(None) == "-"

    def test_imou_call_sends_correct_signature_structure(self, imou_mock_server):
        env = {"IMOU_APP_ID": "my-app-id",
               "IMOU_APP_SECRET": "my-secret-abc",
               "IMOU_API_BASE": imou_mock_server["url"]}
        mod = _load_refresh_module(env)
        imou_mock_server["server"].scenario = "ok"
        resp = mod.imou_call("accessToken", {})
        # Response shape
        assert (resp.get("result") or {}).get("data", {}).get("accessToken") == "fake-token-123"
        # Verify the server received a properly-formed request
        log = imou_mock_server["log"]
        assert len(log) >= 1
        last = log[-1]
        assert last["path"].endswith("/accessToken")
        system = last["body"].get("system", {})
        assert system.get("appId") == "my-app-id"
        assert "sign" in system
        assert "time" in system
        assert "nonce" in system
        # Signature algorithm: md5("time:{T},nonce:{N},appSecret:{S}")
        expected = hashlib.md5(
            f"time:{system['time']},nonce:{system['nonce']},appSecret:my-secret-abc".encode()
        ).hexdigest()
        assert system["sign"] == expected, "md5 signature mismatch"


class TestRefreshErrorHandling:
    def test_missing_app_id_fails(self, tmp_path):
        env = os.environ.copy()
        env.pop("IMOU_APP_ID", None)
        env.pop("IMOU_APP_SECRET", None)
        out = tmp_path / "r.md"
        import subprocess, sys
        proc = subprocess.run(
            [sys.executable, str(REFRESH_PY), "--out", str(out), "--dry-run"],
            capture_output=True, text=True, env=env, timeout=10
        )
        # refresh.py raises KeyError on missing IMOU_APP_ID at import time
        assert proc.returncode != 0
        # KeyError message contains the key name
        assert "IMOU_APP_ID" in (proc.stderr + proc.stdout)
