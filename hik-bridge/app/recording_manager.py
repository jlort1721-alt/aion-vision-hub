"""AION Hikvision Bridge — Recording search and download via HCNetSDK.

Provides SDK-based recording file search and binary download,
which is more reliable than ISAPI ContentMgmt for large files.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from app.config import settings
from app.device_manager import device_manager
from app.models import (
    DownloadStatus,
    RecordingDownloadRequest,
    RecordingFile,
    RecordingSearchRequest,
)

logger = structlog.get_logger("recording_manager")


class RecordingManager:
    """Manages recording search and download via HCNetSDK."""

    def __init__(self) -> None:
        self._downloads: dict[str, DownloadStatus] = {}
        self._active_downloads: dict[str, asyncio.Task] = {}

    async def search(self, request: RecordingSearchRequest) -> list[RecordingFile]:
        """Search for recording files on a device."""
        login_id = device_manager.get_login_id(request.device_ip)

        files = await asyncio.get_running_loop().run_in_executor(
            None,
            self._do_search,
            login_id,
            request.channel,
            request.start_time,
            request.end_time,
            request.file_type,
        )

        logger.info(
            "Recording search",
            device_ip=request.device_ip,
            channel=request.channel,
            start=request.start_time.isoformat(),
            end=request.end_time.isoformat(),
            results=len(files),
        )
        return files

    async def start_download(self, request: RecordingDownloadRequest) -> DownloadStatus:
        """Start downloading a recording file from a device."""
        login_id = device_manager.get_login_id(request.device_ip)

        download_id = str(uuid.uuid4())[:8]
        safe_filename = request.filename.replace("/", "_").replace("\\", "_")
        local_filename = f"{request.device_ip.replace('.', '_')}_{safe_filename}"
        local_path = os.path.join(settings.downloads_dir, local_filename)

        status = DownloadStatus(
            download_id=download_id,
            device_ip=request.device_ip,
            filename=request.filename,
            status="downloading",
            local_path=local_path,
        )
        self._downloads[download_id] = status

        # Start download in background task
        task = asyncio.create_task(
            self._download_task(download_id, login_id, request.filename, local_path)
        )
        self._active_downloads[download_id] = task

        logger.info(
            "Download started",
            download_id=download_id,
            device_ip=request.device_ip,
            filename=request.filename,
        )
        return status

    async def _download_task(
        self,
        download_id: str,
        login_id: int,
        remote_filename: str,
        local_path: str,
    ) -> None:
        """Background task for downloading a recording file."""
        status = self._downloads[download_id]
        try:
            success = await asyncio.get_running_loop().run_in_executor(
                None,
                self._do_download,
                login_id,
                remote_filename,
                local_path,
                download_id,
            )

            if success and os.path.exists(local_path):
                status.status = "completed"
                status.progress = 100.0
                status.file_size = os.path.getsize(local_path)
                logger.info(
                    "Download completed",
                    download_id=download_id,
                    size=status.file_size,
                )
            else:
                status.status = "failed"
                status.error = "Download failed — file not created"
                logger.warning("Download failed", download_id=download_id)

        except Exception as exc:
            status.status = "failed"
            status.error = str(exc)
            logger.error("Download error", download_id=download_id, error=str(exc))

        finally:
            self._active_downloads.pop(download_id, None)

    def get_download_status(self, download_id: str) -> DownloadStatus | None:
        """Get the current status of a download."""
        return self._downloads.get(download_id)

    def list_downloads(self) -> list[DownloadStatus]:
        """List all downloads with their status."""
        return list(self._downloads.values())

    def get_download_path(self, download_id: str) -> str | None:
        """Get the local file path for a completed download."""
        status = self._downloads.get(download_id)
        if not status or status.status != "completed" or not status.local_path:
            return None

        # Verify file exists and prevent path traversal
        real_path = os.path.realpath(status.local_path)
        real_dir = os.path.realpath(settings.downloads_dir)
        if not real_path.startswith(real_dir):
            return None

        if not os.path.exists(real_path):
            return None

        return real_path

    async def cleanup_old_downloads(self, max_age_hours: int = 72) -> int:
        """Remove downloaded files older than max_age_hours."""
        if not os.path.isdir(settings.downloads_dir):
            return 0

        now = datetime.now(timezone.utc).timestamp()
        max_age_seconds = max_age_hours * 3600
        removed = 0

        for filename in os.listdir(settings.downloads_dir):
            filepath = os.path.join(settings.downloads_dir, filename)
            if os.path.isfile(filepath):
                age = now - os.path.getmtime(filepath)
                if age > max_age_seconds:
                    os.remove(filepath)
                    # Clean up status entry too
                    for did, status in list(self._downloads.items()):
                        if status.local_path == filepath:
                            del self._downloads[did]
                    removed += 1

        if removed > 0:
            logger.info("Cleaned up old downloads", removed=removed)
        return removed

    # ═══════════════════════════════════════════
    # Blocking SDK calls
    # ═══════════════════════════════════════════

    def _do_search(
        self,
        login_id: int,
        channel: int,
        start_time: datetime,
        end_time: datetime,
        file_type: int,
    ) -> list[RecordingFile]:
        """Search recordings via SDK — blocking, runs in executor."""
        if not device_manager.sdk_available:
            return self._mock_search(channel, start_time, end_time)

        try:
            from hikvision_sdk import HikvisionSDK

            results = HikvisionSDK.find_files(
                login_id,
                channel=channel,
                start_time=start_time,
                end_time=end_time,
                file_type=file_type,
            )

            return [
                RecordingFile(
                    filename=getattr(r, "filename", f"ch{channel}_{i}.mp4"),
                    start_time=getattr(r, "start_time", start_time),
                    end_time=getattr(r, "end_time", end_time),
                    file_size=getattr(r, "file_size", 0),
                    channel=channel,
                )
                for i, r in enumerate(results)
            ]
        except Exception as exc:
            logger.error("SDK recording search failed", login_id=login_id, error=str(exc))
            return []

    def _do_download(
        self,
        login_id: int,
        remote_filename: str,
        local_path: str,
        download_id: str,
    ) -> bool:
        """Download recording file via SDK — blocking, runs in executor."""
        if not device_manager.sdk_available:
            return self._mock_download(local_path)

        try:
            from hikvision_sdk import HikvisionSDK

            def progress_callback(progress: float) -> None:
                status = self._downloads.get(download_id)
                if status:
                    status.progress = progress

            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            return HikvisionSDK.download_file(
                login_id,
                filename=remote_filename,
                save_path=local_path,
                progress_callback=progress_callback,
            )
        except Exception as exc:
            logger.error("SDK download failed", login_id=login_id, error=str(exc))
            return False

    @staticmethod
    def _mock_search(
        channel: int, start_time: datetime, end_time: datetime
    ) -> list[RecordingFile]:
        """Mock search results for development."""
        from datetime import timedelta

        files = []
        current = start_time
        while current < end_time:
            segment_end = min(current + timedelta(hours=1), end_time)
            files.append(
                RecordingFile(
                    filename=f"ch{channel:02d}_{current.strftime('%Y%m%d%H%M%S')}.mp4",
                    start_time=current,
                    end_time=segment_end,
                    file_size=50 * 1024 * 1024,  # 50MB mock
                    channel=channel,
                )
            )
            current = segment_end
        return files

    @staticmethod
    def _mock_download(local_path: str) -> bool:
        """Mock download for development."""
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(b"\x00" * 1024)  # 1KB placeholder
        return True


# Singleton instance
recording_manager = RecordingManager()
