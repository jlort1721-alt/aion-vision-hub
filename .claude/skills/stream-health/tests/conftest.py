"""Fixtures for stream-health tests.

Mocks go2rtc REST API with a tiny local HTTP server, points GO2RTC_API at it,
and invokes probe.sh via bash.
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
PROBE_SH = SKILL_DIR / "scripts" / "probe.sh"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


STREAMS_FIXTURE = {
    "hik_portal_plaza_ch1": {
        "producers": [{"url": "rtsp://dvr.local/ch1", "state": "connected"}],
        "consumers": [{"type": "hls"}],
    },
    "hik_portal_plaza_ch2": {
        "producers": [{"url": "rtsp://dvr.local/ch2", "state": "disconnected"}],
        "consumers": [],
    },
    "da-danubios-ch0": {
        "producers": [{"url": "http://imou.example/abc.m3u8", "state": "connected"}],
        "consumers": [],
    },
}


class _GoHandler(BaseHTTPRequestHandler):
    def log_message(self, *_a, **_k):
        pass

    def _send_json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/streams":
            self._send_json(STREAMS_FIXTURE)
            return
        if self.path.startswith("/api/streams?"):
            # parse src=key
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            src = (q.get("src") or [""])[0]
            stream = STREAMS_FIXTURE.get(src, {})
            self._send_json(stream)
            return
        if self.path.startswith("/api/stream.m3u8"):
            # simulate HLS endpoint — 200 if the stream exists, 404 otherwise
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            src = (q.get("src") or [""])[0]
            if src in STREAMS_FIXTURE and STREAMS_FIXTURE[src]["producers"][0]["state"] == "connected":
                self.send_response(200)
                self.send_header("Content-Type", "application/x-mpegURL")
                self.end_headers()
                self.wfile.write(b"#EXTM3U\n")
            else:
                self.send_response(404)
                self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()  # same dispatch, send_response doesn't write body on HEAD inherently


@pytest.fixture
def go2rtc_mock():
    port = _free_port()
    server = HTTPServer(("127.0.0.1", port), _GoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()


@pytest.fixture
def run_probe(tmp_path: Path, go2rtc_mock: str):
    def _run(*args: str, env_overrides: dict | None = None) -> subprocess.CompletedProcess:
        env = os.environ.copy()
        env["GO2RTC_API"] = go2rtc_mock
        env.update(env_overrides or {})
        output = tmp_path / "stream-report.md"
        return subprocess.run(
            ["bash", str(PROBE_SH), f"--output={output}", *args],
            capture_output=True, text=True, env=env, cwd=tmp_path, timeout=15,
        )
    return _run


@pytest.fixture
def output_file(tmp_path: Path) -> Path:
    return tmp_path / "stream-report.md"
