"""AION Hikvision Bridge — JPEG snapshot capture via HCNetSDK."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

import structlog

from app.config import settings
from app.device_manager import device_manager
from app.models import SnapshotRequest, SnapshotResult

logger = structlog.get_logger("snapshot_manager")


class SnapshotManager:
    """Captures JPEG snapshots from Hikvision devices via SDK."""

    async def capture(
        self, device_ip: str, channel: int = 1, quality: int = 2
    ) -> SnapshotResult:
        """Capture a JPEG snapshot from a device channel."""
        login_id = device_manager.get_login_id(device_ip)
        now = datetime.now(timezone.utc)

        # Generate filename: {ip}_ch{channel}_{timestamp}.jpg
        ts = now.strftime("%Y%m%d_%H%M%S")
        filename = f"{device_ip.replace('.', '_')}_ch{channel}_{ts}.jpg"
        filepath = os.path.join(settings.snapshots_dir, filename)

        success = await asyncio.get_running_loop().run_in_executor(
            None, self._do_capture, login_id, channel, filepath, quality
        )

        if not success:
            raise RuntimeError(f"Snapshot capture failed for {device_ip} ch{channel}")

        file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0

        logger.info(
            "Snapshot captured",
            device_ip=device_ip,
            channel=channel,
            filename=filename,
            size=file_size,
        )

        return SnapshotResult(
            filename=filename,
            path=filepath,
            size=file_size,
            captured_at=now,
        )

    async def list_snapshots(self, device_ip: str | None = None) -> list[dict[str, Any]]:
        """List saved snapshot files, optionally filtered by device IP."""
        snapshots = []
        prefix = device_ip.replace(".", "_") if device_ip else None

        if not os.path.isdir(settings.snapshots_dir):
            return snapshots

        for filename in sorted(os.listdir(settings.snapshots_dir), reverse=True):
            if not filename.endswith(".jpg"):
                continue
            if prefix and not filename.startswith(prefix):
                continue

            filepath = os.path.join(settings.snapshots_dir, filename)
            stat = os.stat(filepath)
            snapshots.append({
                "filename": filename,
                "path": filepath,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
            })

        return snapshots[:100]  # Limit to last 100

    async def delete_snapshot(self, filename: str) -> bool:
        """Delete a snapshot file."""
        filepath = os.path.join(settings.snapshots_dir, filename)
        if not os.path.exists(filepath):
            return False

        # Prevent path traversal
        real_path = os.path.realpath(filepath)
        real_dir = os.path.realpath(settings.snapshots_dir)
        if not real_path.startswith(real_dir):
            raise ValueError("Invalid filename — path traversal detected")

        os.remove(filepath)
        logger.info("Snapshot deleted", filename=filename)
        return True

    async def cleanup_old_snapshots(self, max_age_hours: int = 24) -> int:
        """Remove snapshots older than max_age_hours."""
        if not os.path.isdir(settings.snapshots_dir):
            return 0

        now = datetime.now(timezone.utc).timestamp()
        max_age_seconds = max_age_hours * 3600
        removed = 0

        for filename in os.listdir(settings.snapshots_dir):
            filepath = os.path.join(settings.snapshots_dir, filename)
            if os.path.isfile(filepath):
                age = now - os.path.getmtime(filepath)
                if age > max_age_seconds:
                    os.remove(filepath)
                    removed += 1

        if removed > 0:
            logger.info("Cleaned up old snapshots", removed=removed)
        return removed

    # ═══════════════════════════════════════════
    # Blocking SDK calls
    # ═══════════════════════════════════════════

    def _do_capture(
        self, login_id: int, channel: int, filepath: str, quality: int
    ) -> bool:
        """Capture JPEG snapshot via SDK — blocking, runs in executor."""
        if not device_manager.sdk_available:
            return self._mock_capture(filepath)

        try:
            from hikvision_sdk import HikvisionSDK
            return HikvisionSDK.capture_jpeg(login_id, channel, filepath)
        except Exception as exc:
            logger.error("SDK snapshot capture failed", login_id=login_id, error=str(exc))
            return False

    @staticmethod
    def _mock_capture(filepath: str) -> bool:
        """Create a mock JPEG file for development."""
        # Minimal valid JPEG (1x1 pixel, gray)
        mock_jpeg = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x40,
            0xFF, 0xD9,
        ])
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(mock_jpeg)
        return True


# Singleton instance
snapshot_manager = SnapshotManager()
