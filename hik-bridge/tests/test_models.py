"""Tests for Pydantic models — validation and serialization."""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.models import (
    DeviceCredentials,
    DeviceInfo,
    DeviceStatus,
    PTZMoveRequest,
    PTZStopRequest,
    PTZPresetRequest,
    RecordingSearchRequest,
    RecordingDownloadRequest,
    SnapshotRequest,
    AlarmEvent,
    DiscoveredDevice,
    ApiResponse,
    HealthResponse,
    DownloadStatus,
)


class TestDeviceCredentials:
    def test_valid_credentials(self):
        cred = DeviceCredentials(
            ip="192.168.1.100", username="admin", password="pass123"
        )
        assert cred.ip == "192.168.1.100"
        assert cred.port == 8000
        assert cred.username == "admin"

    def test_default_port(self):
        cred = DeviceCredentials(ip="10.0.0.1", username="u", password="p")
        assert cred.port == 8000

    def test_custom_port(self):
        cred = DeviceCredentials(
            ip="10.0.0.1", port=8001, username="u", password="p"
        )
        assert cred.port == 8001

    def test_optional_fields(self):
        cred = DeviceCredentials(ip="10.0.0.1", username="u", password="p")
        assert cred.name is None
        assert cred.site_id is None
        assert cred.device_id is None

    def test_with_all_fields(self):
        cred = DeviceCredentials(
            ip="10.0.0.1",
            port=8000,
            username="admin",
            password="pass",
            name="DVR-Site1",
            site_id="site-uuid",
            device_id="device-uuid",
        )
        assert cred.name == "DVR-Site1"
        assert cred.site_id == "site-uuid"


class TestPTZMoveRequest:
    def test_valid_move(self):
        req = PTZMoveRequest(device_ip="192.168.1.100", direction="up")
        assert req.channel == 1
        assert req.speed == 4

    def test_custom_speed(self):
        req = PTZMoveRequest(
            device_ip="192.168.1.100", direction="zoom_in", speed=7
        )
        assert req.speed == 7

    def test_speed_range(self):
        with pytest.raises(ValidationError):
            PTZMoveRequest(device_ip="192.168.1.100", direction="up", speed=0)
        with pytest.raises(ValidationError):
            PTZMoveRequest(device_ip="192.168.1.100", direction="up", speed=8)


class TestPTZPresetRequest:
    def test_valid_preset(self):
        req = PTZPresetRequest(device_ip="10.0.0.1", preset_index=5)
        assert req.action == "goto"

    def test_preset_range(self):
        with pytest.raises(ValidationError):
            PTZPresetRequest(device_ip="10.0.0.1", preset_index=0)
        with pytest.raises(ValidationError):
            PTZPresetRequest(device_ip="10.0.0.1", preset_index=257)

    def test_set_action(self):
        req = PTZPresetRequest(
            device_ip="10.0.0.1", preset_index=1, action="set"
        )
        assert req.action == "set"


class TestRecordingSearchRequest:
    def test_valid_search(self):
        now = datetime.now(timezone.utc)
        req = RecordingSearchRequest(
            device_ip="192.168.1.100",
            channel=1,
            start_time=now,
            end_time=now,
        )
        assert req.file_type == 0xFF

    def test_default_channel(self):
        now = datetime.now(timezone.utc)
        req = RecordingSearchRequest(
            device_ip="192.168.1.100", start_time=now, end_time=now
        )
        assert req.channel == 1


class TestSnapshotRequest:
    def test_defaults(self):
        req = SnapshotRequest(device_ip="192.168.1.100")
        assert req.channel == 1
        assert req.quality == 2

    def test_quality_range(self):
        with pytest.raises(ValidationError):
            SnapshotRequest(device_ip="192.168.1.100", quality=3)
        with pytest.raises(ValidationError):
            SnapshotRequest(device_ip="192.168.1.100", quality=-1)


class TestAlarmEvent:
    def test_valid_event(self):
        event = AlarmEvent(
            id="uuid-1",
            device_ip="192.168.1.100",
            channel=1,
            event_type="motion",
            event_time=datetime.now(timezone.utc),
        )
        assert event.source == "hik_sdk"
        assert event.event_data == {}
        assert event.snapshot_path is None

    def test_with_all_fields(self):
        event = AlarmEvent(
            id="uuid-2",
            device_ip="192.168.1.100",
            device_name="DVR-1",
            device_id="dev-uuid",
            site_id="site-uuid",
            channel=3,
            event_type="intrusion",
            event_time=datetime.now(timezone.utc),
            event_data={"raw_type": "101", "state": "active"},
            snapshot_path="/opt/aion/snapshots/test.jpg",
        )
        assert event.device_name == "DVR-1"
        assert event.event_data["state"] == "active"


class TestDiscoveredDevice:
    def test_defaults(self):
        dev = DiscoveredDevice(ip="192.168.1.100")
        assert dev.port == 8000
        assert dev.is_activated is True
        assert dev.already_registered is False


class TestApiResponse:
    def test_success(self):
        resp = ApiResponse(data={"test": True})
        assert resp.success is True

    def test_error(self):
        resp = ApiResponse(success=False, error="Something failed")
        assert resp.error == "Something failed"


class TestHealthResponse:
    def test_defaults(self):
        resp = HealthResponse()
        assert resp.status == "ok"
        assert resp.sdk_initialized is False
        assert resp.connected_devices == 0


class TestDownloadStatus:
    def test_defaults(self):
        dl = DownloadStatus(
            download_id="abc",
            device_ip="192.168.1.100",
            filename="test.mp4",
        )
        assert dl.status == "pending"
        assert dl.progress == 0.0
        assert dl.file_size == 0


class TestDeviceStatus:
    def test_defaults(self):
        st = DeviceStatus(ip="192.168.1.100")
        assert st.online is False
        assert st.channels == []
        assert st.reconnect_count == 0
