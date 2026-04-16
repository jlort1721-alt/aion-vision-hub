"""AION Hikvision Bridge — SDK alarm subscription and event callback manager.

Handles:
- Subscribing to alarm callbacks on connected devices via HCNetSDK
- Normalizing raw SDK alarm types to match ISAPI event type map
- Auto-capturing snapshots on alarm events
- Publishing events to Redis (with deduplication)
- Thread-safe bridging from C callback threads to asyncio event loop
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
from app.models import AlarmEvent, AlarmSubscription
from app.redis_client import redis_publisher

logger = structlog.get_logger("alarm_manager")

# ═══════════════════════════════════════════
# SDK alarm type → normalized event type
# Must match EVENT_TYPE_MAP in isapi-alert-listener.ts
# ═══════════════════════════════════════════

SDK_EVENT_TYPE_MAP: dict[int, str] = {
    # Standard alarm types (from HCNetSDK documentation)
    0: "alarm_input",          # External alarm input
    1: "disk_full",            # Disk full
    2: "video_loss",           # Video loss
    3: "motion",               # Motion detection (VMD)
    4: "disk_unformatted",     # Disk unformatted
    5: "disk_error",           # Disk read/write error
    6: "video_tampering",      # Video tampering (shelteralarm)
    7: "illegal_access",       # Illegal access attempt
    8: "network_fail",         # Network disconnected
    9: "ip_conflict",          # IP conflict
    10: "bad_video",           # Bad video signal
    11: "record_error",        # Recording error

    # VCA / Smart events (COMM_ALARM_V30 subtypes)
    100: "line_crossing",      # linedetection
    101: "intrusion",          # fielddetection / region intrusion
    102: "region_entrance",    # regionEntrance
    103: "region_exit",        # regionExiting
    104: "loitering",          # loiteringDetection
    105: "people_gathering",   # peopleGathering
    106: "parking",            # parkingDetection
    107: "unattended_object",  # unattendedBaggageDetection
    108: "object_removal",     # attendedBaggageDetection
    109: "fast_moving",        # fastMoving
    110: "face_detection",     # facedetection
    111: "scene_change",       # sceneChangeDetection
    112: "audio_exception",    # audioException
    113: "defocus",            # defocusDetection

    # License plate
    200: "lpr_detection",      # License plate recognition
}

# String-based fallback map (SDK sometimes uses string types)
SDK_EVENT_STR_MAP: dict[str, str] = {
    "vmd": "motion",
    "videomotiondetection": "motion",
    "fielddetection": "intrusion",
    "linedetection": "line_crossing",
    "tamperdetection": "tamper",
    "videoloss": "video_loss",
    "shelteralarm": "tamper",
    "regionentrance": "region_entrance",
    "regionexiting": "region_exit",
    "unattendedbaggagedetection": "unattended_object",
    "attendedbaggagedetection": "object_removal",
    "facedetection": "face_detection",
    "scenechangedetection": "scene_change",
}


def normalize_sdk_event_type(raw: int | str) -> str:
    """Normalize SDK event type to match ISAPI event naming."""
    if isinstance(raw, int):
        return SDK_EVENT_TYPE_MAP.get(raw, f"unknown_{raw}")
    key = str(raw).lower().replace(" ", "").replace("_", "")
    return SDK_EVENT_STR_MAP.get(key, str(raw).lower())


class AlarmManager:
    """Manages SDK alarm subscriptions and event routing."""

    def __init__(self) -> None:
        self._subscriptions: dict[str, AlarmSubscription] = {}
        self._event_loop: asyncio.AbstractEventLoop | None = None
        self._snapshot_enabled = True

    @property
    def subscription_count(self) -> int:
        return sum(1 for s in self._subscriptions.values() if s.subscribed)

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Set the main asyncio event loop for thread-safe callback bridging."""
        self._event_loop = loop

    async def subscribe(self, device_ip: str) -> AlarmSubscription:
        """Subscribe to alarm callbacks for a device."""
        conn = device_manager.get_device(device_ip)
        if not conn or not conn.online:
            raise ConnectionError(f"Device {device_ip} is not connected")

        if device_ip in self._subscriptions and self._subscriptions[device_ip].subscribed:
            return self._subscriptions[device_ip]

        login_id = device_manager.get_login_id(device_ip)

        # Run blocking SDK call in executor
        success = await asyncio.get_running_loop().run_in_executor(
            None, self._do_subscribe, device_ip, login_id
        )

        sub = AlarmSubscription(
            device_ip=device_ip,
            device_name=conn.credentials.name or device_ip,
            subscribed=success,
            subscribed_at=datetime.now(timezone.utc) if success else None,
        )
        self._subscriptions[device_ip] = sub

        if success:
            logger.info("Alarm subscription active", device_ip=device_ip)
        else:
            logger.warning("Alarm subscription failed", device_ip=device_ip)

        return sub

    def _do_subscribe(self, device_ip: str, login_id: int) -> bool:
        """Blocking SDK alarm setup — runs in thread pool."""
        if not device_manager.sdk_available:
            # Mock mode: simulate subscription
            return True

        try:
            from hikvision_sdk import HikvisionSDK

            def alarm_callback(alarm_info: Any) -> None:
                """Called from SDK C thread on alarm event."""
                self._on_alarm(device_ip, alarm_info)

            handle = HikvisionSDK.setup_alarm(login_id, callback=alarm_callback)
            conn = device_manager.get_device(device_ip)
            if conn:
                conn._alarm_handle = handle
            return True
        except Exception as exc:
            logger.error("SDK alarm setup failed", device_ip=device_ip, error=str(exc))
            return False

    async def unsubscribe(self, device_ip: str) -> bool:
        """Unsubscribe from alarm callbacks for a device."""
        sub = self._subscriptions.get(device_ip)
        if not sub or not sub.subscribed:
            return False

        conn = device_manager.get_device(device_ip)
        if conn and conn._alarm_handle is not None:
            await asyncio.get_running_loop().run_in_executor(
                None, self._do_unsubscribe, conn._alarm_handle
            )
            conn._alarm_handle = None

        sub.subscribed = False
        logger.info("Alarm unsubscribed", device_ip=device_ip)
        return True

    def _do_unsubscribe(self, handle: int) -> None:
        """Blocking SDK alarm teardown — runs in thread pool."""
        if not device_manager.sdk_available:
            return
        try:
            from hikvision_sdk import HikvisionSDK
            HikvisionSDK.close_alarm(handle)
        except Exception as exc:
            logger.warning("SDK alarm close error", error=str(exc))

    def _on_alarm(self, device_ip: str, alarm_info: Any) -> None:
        """Called from SDK C thread — bridges to asyncio for Redis publish.

        IMPORTANT: This runs in a C-level thread from the SDK,
        NOT in the asyncio event loop. We use run_coroutine_threadsafe
        to safely publish events.
        """
        if not self._event_loop:
            logger.warning("No event loop set — alarm dropped")
            return

        try:
            # Extract alarm data from SDK struct
            raw_type = getattr(alarm_info, "alarm_type", getattr(alarm_info, "type", 0))
            channel = getattr(alarm_info, "channel", getattr(alarm_info, "channel_id", 0))
            event_type = normalize_sdk_event_type(raw_type)

            conn = device_manager.get_device(device_ip)
            now = datetime.now(timezone.utc)

            event = AlarmEvent(
                id=str(uuid.uuid4()),
                device_ip=device_ip,
                device_name=conn.credentials.name if conn else device_ip,
                device_id=conn.credentials.device_id if conn else None,
                site_id=conn.credentials.site_id if conn else None,
                channel=channel,
                event_type=event_type,
                event_time=now,
                event_data={
                    "raw_type": str(raw_type),
                    "state": getattr(alarm_info, "state", "active"),
                },
                source="hik_sdk",
            )

            # Bridge to asyncio event loop
            future = asyncio.run_coroutine_threadsafe(
                self._process_alarm(event), self._event_loop
            )
            # Don't block waiting for result — fire and forget

        except Exception as exc:
            logger.error("Alarm callback error", device_ip=device_ip, error=str(exc))

    async def _process_alarm(self, event: AlarmEvent) -> None:
        """Process an alarm event (runs in asyncio event loop)."""
        # Update subscription event count
        sub = self._subscriptions.get(event.device_ip)
        if sub:
            sub.event_count += 1

        # Attempt snapshot capture
        if self._snapshot_enabled:
            snapshot_path = await self._capture_alarm_snapshot(event)
            if snapshot_path:
                event.snapshot_path = snapshot_path

        # Publish to Redis (dedup handled inside publisher)
        published = await redis_publisher.publish_alarm(event.model_dump())

        if published:
            logger.info(
                "Alarm event",
                device_ip=event.device_ip,
                channel=event.channel,
                type=event.event_type,
                snapshot=bool(event.snapshot_path),
            )

    async def _capture_alarm_snapshot(self, event: AlarmEvent) -> str | None:
        """Capture a snapshot on alarm — best-effort, non-blocking."""
        try:
            # Import lazily to avoid circular dependency
            from app.snapshot_manager import snapshot_manager

            result = await snapshot_manager.capture(event.device_ip, event.channel)
            return result.path if result else None
        except Exception as exc:
            logger.debug("Alarm snapshot failed", device_ip=event.device_ip, error=str(exc))
            return None

    def list_subscriptions(self) -> list[AlarmSubscription]:
        """List all alarm subscriptions."""
        return list(self._subscriptions.values())

    async def subscribe_all_connected(self) -> int:
        """Subscribe to alarms for all connected devices."""
        count = 0
        for status in device_manager.list_devices():
            if status.online and status.ip not in self._subscriptions:
                try:
                    await self.subscribe(status.ip)
                    count += 1
                except Exception as exc:
                    logger.warning("Auto-subscribe failed", ip=status.ip, error=str(exc))
        return count


# Singleton instance
alarm_manager = AlarmManager()
