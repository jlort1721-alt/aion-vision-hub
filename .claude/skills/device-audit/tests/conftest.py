"""Shared fixtures for device-audit tests.

Uses a PATH-injected mock `psql` binary + DATABASE_URL env so the real scripts
run their actual logic without hitting a real database.
"""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def mock_psql_bin(tmp_path: Path) -> Path:
    """Create a tmp directory with a mock `psql` executable on PATH."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    src = FIXTURES_DIR / "bin" / "psql"
    dst = bin_dir / "psql"
    shutil.copy(src, dst)
    dst.chmod(dst.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir


@pytest.fixture
def run_env(mock_psql_bin: Path, tmp_path: Path) -> dict:
    """Env dict pointing PATH to mock binaries and DATABASE_URL to a dummy value."""
    env = os.environ.copy()
    env["PATH"] = f"{mock_psql_bin}:{env.get('PATH', '')}"
    env["DATABASE_URL"] = "postgresql://dummy@localhost/dummy"
    # Clear cooldown — --execute can run in tests
    env.pop("DVR_COOLDOWN_UNTIL", None)
    return env


@pytest.fixture
def run_script(tmp_path: Path, run_env: dict):
    """Return a helper that invokes the skill's run.sh with args and captures output."""

    def _run(*args: str, extra_env: dict | None = None) -> subprocess.CompletedProcess:
        env = {**run_env, **(extra_env or {})}
        return subprocess.run(
            ["bash", str(SCRIPTS_DIR / "run.sh"), *args],
            capture_output=True,
            text=True,
            env=env,
            cwd=tmp_path,
            timeout=15,
        )

    return _run


@pytest.fixture
def dry_run_py(run_env: dict, tmp_path: Path):
    """Invoke dry_run.py directly with mock psql + a temp --report path."""

    def _run(*args: str) -> tuple[subprocess.CompletedProcess, Path]:
        report = tmp_path / "report.md"
        proc = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "dry_run.py"), "--report", str(report), *args],
            capture_output=True,
            text=True,
            env=run_env,
            cwd=tmp_path,
            timeout=10,
        )
        return proc, report

    return _run
