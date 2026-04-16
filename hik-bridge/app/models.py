"""AION Hikvision Bridge — Pydantic models for API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════
# Device models
# ═══════════════════════════════════════════


class DeviceCredentials(BaseModel):
    """Credentials for connecting to a Hikvision device via SDK."""

    ip: str
    port: int = 8000
    username: str
    password: str
    name: str | None = None
    site_id: str | None = None
    device_id: str | None = None


class DeviceInfo(BaseModel):
    """Information returned after successful SDK login."""

    serial_number: str = ""
    device_name: str = ""
    device_type: int = 0
    channel_count: int = 0
    start_channel: int = 1
    disk_count: int = 0
    alarm_in_count: int = 0
    alarm_out_count: int = 0
    firmware_version: str = ""
    encoder_version: str = ""
    ip: str = ""
    port: int = 8000
    login_id: int = -1


class ChannelInfo(BaseModel):
    """Video channel information from a device."""

    channel_id: int
    channel_name: str = ""
    online: bool = True
    resolution_width: int = 0
    resolution_height: int = 0


class DeviceStatus(BaseModel):
    """Runtime status of a connected device."""

    ip: str
    port: int = 8000
    name: str = ""
    device_id: str | None = None
    site_id: str | None = None
    online: bool = False
    login_id: int | None = None
    channel_count: int = 0
    channels: list[ChannelInfo] = []
    last_heartbeat: datetime | None = None
    connected_at: datetime | None = None
    reconnect_count: int = 0
    error: str | None = None


# ═══════════════════════════════════════════
# PTZ models
# ═══════════════════════════════════════════


class PTZMoveRequest(BaseModel):
    """PTZ movement command."""

    device_ip: str
    channel: int = 1
    direction: str = Field(
        ...,
        description="up, down, left, right, left_up, left_down, right_up, right_down, zoom_in, zoom_out, iris_open, iris_close, focus_near, focus_far",
    )
    speed: int = Field(default=4, ge=1, le=7)


class PTZStopRequest(BaseModel):
    """Stop PTZ movement."""

    device_ip: str
    channel: int = 1


class PTZPresetRequest(BaseModel):
    """PTZ preset command."""

    device_ip: str
    channel: int = 1
    preset_index: int = Field(..., ge=1, le=256)
    action: str = Field(default="goto", description="goto, set, clear")


# ═══════════════════════════════════════════
# Recording models
# ═══════════════════════════════════════════


class RecordingSearchRequest(BaseModel):
    """Search for recordings on a device."""

    device_ip: str
    channel: int = 1
    start_time: datetime
    end_time: datetime
    file_type: int = Field(
        default=0xFF,
        description="0xFF=all, 0=timing, 1=motion, 2=alarm, 3=manual",
    )


class RecordingFile(BaseModel):
    """A recording file found on the device."""

    filename: str
    start_time: datetime
    end_time: datetime
    file_size: int = 0
    channel: int = 1


class RecordingDownloadRequest(BaseModel):
    """Request to download a recording file."""

    device_ip: str
    filename: str
    channel: int = 1


class DownloadStatus(BaseModel):
    """Status of an ongoing recording download."""

    download_id: str
    device_ip: str
    filename: str
    status: str = "pending"  # pending, downloading, completed, failed
    progress: float = 0.0  # 0-100
    local_path: str | None = None
    file_size: int = 0
    error: str | None = None


# ═══════════════════════════════════════════
# Snapshot models
# ═══════════════════════════════════════════


class SnapshotRequest(BaseModel):
    """Request to capture a snapshot."""

    device_ip: str
    channel: int = 1
    quality: int = Field(default=2, ge=0, le=2, description="0=best, 1=better, 2=normal")


class SnapshotResult(BaseModel):
    """Result of a snapshot capture."""

    filename: str
    path: str
    size: int = 0
    captured_at: datetime


# ═══════════════════════════════════════════
# Alarm models
# ═══════════════════════════════════════════


class AlarmEvent(BaseModel):
    """Normalized alarm event from SDK callback."""

    id: str
    device_ip: str
    device_name: str = ""
    device_id: str | None = None
    site_id: str | None = None
    channel: int = 0
    event_type: str  # motion, line_crossing, intrusion, face_detection, etc.
    event_time: datetime
    event_data: dict[str, Any] = {}
    snapshot_path: str | None = None
    source: str = "hik_sdk"


class AlarmSubscription(BaseModel):
    """Status of alarm subscription for a device."""

    device_ip: str
    device_name: str = ""
    subscribed: bool = False
    subscribed_at: datetime | None = None
    event_count: int = 0


# ═══════════════════════════════════════════
# Discovery models
# ═══════════════════════════════════════════


class DiscoveredDevice(BaseModel):
    """Device found via SADP broadcast."""

    ip: str
    port: int = 8000
    serial_number: str = ""
    device_type: str = ""
    firmware_version: str = ""
    mac_address: str = ""
    is_activated: bool = True
    already_registered: bool = False


# ═══════════════════════════════════════════
# API response models
# ═══════════════════════════════════════════


class ApiResponse(BaseModel):
    """Standard API response wrapper."""

    success: bool = True
    data: Any = None
    error: str | None = None
    meta: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    sdk_initialized: bool = False
    sdk_version: str = ""
    connected_devices: int = 0
    alarm_subscriptions: int = 0
    uptime_seconds: float = 0.0
