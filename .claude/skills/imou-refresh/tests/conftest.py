"""Fixtures for imou-refresh tests.

Strategy:
- Spin up a mini HTTP server that mimics the Imou Open Platform responses.
- Point `IMOU_API_BASE` at it via env.
- Reuse the PATH-injected mock `psql` from device-audit (for DB ops).
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"

# Reuse the mock psql from device-audit
DEV_AUDIT_BIN = Path(__file__).resolve().parent.parent.parent / "device-audit" / "tests" / "fixtures" / "bin"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class _ImouHandler(BaseHTTPRequestHandler):
    """Records requests + returns canned responses based on endpoint."""

    server_log: list = []

    def log_message(self, *_args, **_kwargs):
        pass  # silence default stderr logging

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {}
        path = self.path
        self.server_log.append({"path": path, "body": data})

        scenario = getattr(self.server, "scenario", "ok")

        if path.endswith("/accessToken"):
            if scenario == "auth_fail":
                resp = {"result": {"code": "TK_0001", "msg": "AccessTokenInvalid"}}
            else:
                resp = {"result": {"code": "0", "msg": "OK",
                                   "data": {"accessToken": "fake-token-123"}}}
        elif path.endswith("/getLiveStreamInfo"):
            device_id = (data.get("params") or {}).get("deviceId", "UNKNOWN")
            if scenario == "no_stream":
                resp = {"result": {"code": "0", "data": {"streams": []}}}
            elif scenario == "device_offline":
                resp = {"result": {"code": "DV1001", "msg": "DeviceOffline"}}
            else:
                ts = int(1776700000)
                hls = f"http://fake.imoulife.com/LCO/{device_id}/0/0/test/abc.m3u8?time={ts}"
                resp = {"result": {"code": "0", "data": {"streams": [{"hls": hls}]}}}
        else:
            resp = {"result": {"code": "Unknown", "msg": f"unknown path {path}"}}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode())


@pytest.fixture
def imou_mock_server():
    _ImouHandler.server_log = []
    port = _free_port()
    server = HTTPServer(("127.0.0.1", port), _ImouHandler)
    server.scenario = "ok"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield {"url": f"http://127.0.0.1:{port}", "server": server, "log": _ImouHandler.server_log}
    finally:
        server.shutdown()


@pytest.fixture
def mock_psql_bin(tmp_path: Path) -> Path:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    src = DEV_AUDIT_BIN / "psql"
    dst = bin_dir / "psql"
    shutil.copy(src, dst)
    dst.chmod(dst.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir


@pytest.fixture
def refresh_env(imou_mock_server, mock_psql_bin: Path):
    env = os.environ.copy()
    env["PATH"] = f"{mock_psql_bin}:{env.get('PATH', '')}"
    env["DATABASE_URL"] = "postgresql://dummy@localhost/dummy"
    env["IMOU_APP_ID"] = "test-app-id"
    env["IMOU_APP_SECRET"] = "test-app-secret"
    env["IMOU_API_BASE"] = imou_mock_server["url"]
    return env


@pytest.fixture
def run_refresh(tmp_path: Path, refresh_env: dict, imou_mock_server):
    def _run(*args: str, scenario: str = "ok") -> tuple[subprocess.CompletedProcess, Path]:
        imou_mock_server["server"].scenario = scenario
        out = tmp_path / "refresh-report.md"
        proc = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "refresh.py"),
             "--out", str(out), "--dry-run", *args],
            capture_output=True, text=True, env=refresh_env, cwd=tmp_path, timeout=15,
        )
        return proc, out
    return _run
