"""AION Hikvision Bridge — Device connection pool manager.

Manages persistent SDK connections to Hikvision DVR/NVR/IPC devices.
- Singleton pattern (SDK is not fork-safe)
- Heartbeat loop for keepalive
- Exponential backoff reconnection
- Thread-safe via asyncio locks
- All blocking SDK calls run in executor
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from app.config import settings
from app.models import (
    ChannelInfo,
    DeviceCredentials,
    DeviceInfo,
    DeviceStatus,
)

logger = structlog.get_logger("device_manager")

# SDK initialization guard
_sdk_initialized = False
_sdk_lock = threading.Lock()

# Thread pool for blocking SDK calls (single thread — SDK is not thread-safe for login/logout)
_sdk_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="hik-sdk")


def _init_sdk() -> bool:
    """Initialize the HCNetSDK library (once, thread-safe)."""
    global _sdk_initialized
    with _sdk_lock:
        if _sdk_initialized:
            return True
        try:
            # Set LD_LIBRARY_PATH before importing SDK
            lib_path = settings.sdk_lib_path
            if os.path.isdir(lib_path):
                current = os.environ.get("LD_LIBRARY_PATH", "")
                if lib_path not in current:
                    os.environ["LD_LIBRARY_PATH"] = f"{lib_path}:{current}" if current else lib_path

            from hikvision_sdk import HikvisionSDK

            # Initialize the SDK globally
            HikvisionSDK.init(
                log_dir=settings.sdk_log_dir,
                log_level=settings.sdk_log_level,
            )
            _sdk_initialized = True
            logger.info("HCNetSDK initialized", lib_path=lib_path)
            return True
        except ImportError:
            logger.error("hikvision-sdk package not installed — running in MOCK mode")
            _sdk_initialized = False
            return False
        except Exception as exc:
            logger.error("Failed to initialize HCNetSDK", error=str(exc))
            _sdk_initialized = False
            return False


def _get_sdk_version() -> str:
    """Get the SDK version string."""
    try:
        from hikvision_sdk import HikvisionSDK
        return HikvisionSDK.get_version()
    except Exception:
        return "unknown"


class _DeviceConnection:
    """Internal state for a single device connection."""

    __slots__ = (
        "credentials",
        "login_id",
        "info",
        "channels",
        "online",
        "connected_at",
        "last_heartbeat",
        "reconnect_count",
        "reconnect_delay",
        "error",
        "_alarm_handle",
    )

    def __init__(self, credentials: DeviceCredentials) -> None:
        self.credentials = credentials
        self.login_id: int = -1
        self.info: DeviceInfo | None = None
        self.channels: list[ChannelInfo] = []
        self.online: bool = False
        self.connected_at: datetime | None = None
        self.last_heartbeat: datetime | None = None
        self.reconnect_count: int = 0
        self.reconnect_delay: float = 5.0  # Start at 5s
        self.error: str | None = None
        self._alarm_handle: int | None = None

    def reset_backoff(self) -> None:
        self.reconnect_delay = 5.0
        self.error = None

    def increase_backoff(self) -> None:
        self.reconnect_delay = min(
            self.reconnect_delay * 2, settings.reconnect_max_delay
        )

    def to_status(self) -> DeviceStatus:
        return DeviceStatus(
            ip=self.credentials.ip,
            port=self.credentials.port,
            name=self.credentials.name or "",
            device_id=self.credentials.device_id,
            site_id=self.credentials.site_id,
            online=self.online,
            login_id=self.login_id if self.online else None,
            channel_count=self.info.channel_count if self.info else 0,
            channels=self.channels,
            last_heartbeat=self.last_heartbeat,
            connected_at=self.connected_at,
            reconnect_count=self.reconnect_count,
            error=self.error,
        )


class DeviceManager:
    """Manages persistent HCNetSDK connections to multiple devices."""

    def __init__(self) -> None:
        self._devices: dict[str, _DeviceConnection] = {}
        self._lock = asyncio.Lock()
        self._heartbeat_task: asyncio.Task | None = None
        self._running = False
        self._start_time = time.monotonic()
        self._sdk_available = False

    @property
    def sdk_available(self) -> bool:
        return self._sdk_available

    @property
    def sdk_version(self) -> str:
        return _get_sdk_version() if self._sdk_available else "not-available"

    @property
    def connected_count(self) -> int:
        return sum(1 for d in self._devices.values() if d.online)

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._start_time

    async def start(self) -> None:
        """Initialize SDK and start heartbeat loop."""
        self._sdk_available = await asyncio.get_running_loop().run_in_executor(
            _sdk_executor, _init_sdk
        )
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info(
            "DeviceManager started",
            sdk_available=self._sdk_available,
        )

    async def stop(self) -> None:
        """Logout all devices and cleanup."""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        # Logout all connected devices
        tasks = []
        for ip in list(self._devices.keys()):
            tasks.append(self.logout_device(ip))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # Cleanup SDK
        if self._sdk_available:
            await asyncio.get_running_loop().run_in_executor(
                _sdk_executor, self._cleanup_sdk
            )
        logger.info("DeviceManager stopped")

    @staticmethod
    def _cleanup_sdk() -> None:
        global _sdk_initialized
        try:
            from hikvision_sdk import HikvisionSDK
            HikvisionSDK.cleanup()
        except Exception as exc:
            logger.warning("SDK cleanup error", error=str(exc))
        _sdk_initialized = False

    # ═══════════════════════════════════════════
    # Login / Logout
    # ═══════════════════════════════════════════

    async def login_device(self, credentials: DeviceCredentials) -> DeviceInfo:
        """Login to a device and add to connection pool."""
        ip = credentials.ip
        async with self._lock:
            # Already connected?
            if ip in self._devices and self._devices[ip].online:
                existing = self._devices[ip]
                if existing.info:
                    return existing.info
                raise ValueError(f"Device {ip} is connected but has no info")

            conn = _DeviceConnection(credentials)
            self._devices[ip] = conn

        # Run blocking SDK login in executor
        info = await asyncio.get_running_loop().run_in_executor(
            _sdk_executor, self._do_login, conn
        )

        async with self._lock:
            if conn.online:
                conn.reset_backoff()
                logger.info(
                    "Device logged in",
                    ip=ip,
                    serial=info.serial_number,
                    channels=info.channel_count,
                    login_id=info.login_id,
                )
            else:
                logger.warning("Device login failed", ip=ip, error=conn.error)
                raise ConnectionError(f"Login failed for {ip}: {conn.error}")

        return info

    def _do_login(self, conn: _DeviceConnection) -> DeviceInfo:
        """Blocking SDK login call — runs in thread pool."""
        if not self._sdk_available:
            # Mock mode for development without SDK
            return self._mock_login(conn)

        try:
            from hikvision_sdk import HikvisionSDK

            with HikvisionSDK(
                host=conn.credentials.ip,
                port=conn.credentials.port,
                username=conn.credentials.username,
                password=conn.credentials.password,
            ) as sdk:
                device_info = sdk.get_device_info()
                now = datetime.now(timezone.utc)

                info = DeviceInfo(
                    serial_number=getattr(device_info, "serial_number", ""),
                    device_name=getattr(device_info, "device_name", ""),
                    device_type=getattr(device_info, "device_type", 0),
                    channel_count=getattr(device_info, "channels", 0),
                    start_channel=getattr(device_info, "start_channel", 1),
                    disk_count=getattr(device_info, "disks", 0),
                    alarm_in_count=getattr(device_info, "alarm_in", 0),
                    alarm_out_count=getattr(device_info, "alarm_out", 0),
                    firmware_version=getattr(device_info, "firmware_version", ""),
                    encoder_version=getattr(device_info, "encoder_version", ""),
                    ip=conn.credentials.ip,
                    port=conn.credentials.port,
                    login_id=getattr(sdk, "_login_id", -1),
                )

                conn.info = info
                conn.login_id = info.login_id
                conn.online = True
                conn.connected_at = now
                conn.last_heartbeat = now
                return info

        except Exception as exc:
            conn.online = False
            conn.error = str(exc)
            conn.increase_backoff()
            return DeviceInfo(ip=conn.credentials.ip, port=conn.credentials.port)

    def _mock_login(self, conn: _DeviceConnection) -> DeviceInfo:
        """Mock login for development without HCNetSDK installed."""
        now = datetime.now(timezone.utc)
        info = DeviceInfo(
            serial_number=f"MOCK-{conn.credentials.ip.replace('.', '')}",
            device_name=conn.credentials.name or f"Mock-{conn.credentials.ip}",
            device_type=1,
            channel_count=8,
            start_channel=1,
            disk_count=1,
            firmware_version="V4.73.000 (mock)",
            ip=conn.credentials.ip,
            port=conn.credentials.port,
            login_id=hash(conn.credentials.ip) & 0xFFFF,
        )
        conn.info = info
        conn.login_id = info.login_id
        conn.online = True
        conn.connected_at = now
        conn.last_heartbeat = now
        return info

    async def logout_device(self, ip: str) -> bool:
        """Logout from a device and remove from pool."""
        async with self._lock:
            conn = self._devices.pop(ip, None)
        if not conn or not conn.online:
            return False

        await asyncio.get_running_loop().run_in_executor(
            _sdk_executor, self._do_logout, conn
        )
        logger.info("Device logged out", ip=ip)
        return True

    def _do_logout(self, conn: _DeviceConnection) -> None:
        """Blocking SDK logout — runs in thread pool."""
        if not self._sdk_available or conn.login_id < 0:
            return
        try:
            from hikvision_sdk import HikvisionSDK
            HikvisionSDK.logout(conn.login_id)
        except Exception as exc:
            logger.warning("Logout error", ip=conn.credentials.ip, error=str(exc))

    async def bulk_login(
        self, devices: list[DeviceCredentials]
    ) -> list[DeviceStatus]:
        """Login to multiple devices concurrently."""
        results = []
        tasks = [self._safe_login(cred) for cred in devices]
        statuses = await asyncio.gather(*tasks)
        return list(statuses)

    async def _safe_login(self, cred: DeviceCredentials) -> DeviceStatus:
        """Login with error handling, returning status regardless."""
        try:
            await self.login_device(cred)
        except Exception:
            pass
        conn = self._devices.get(cred.ip)
        if conn:
            return conn.to_status()
        return DeviceStatus(ip=cred.ip, port=cred.port, online=False, error="Login failed")

    # ═══════════════════════════════════════════
    # Device queries
    # ═══════════════════════════════════════════

    def get_device(self, ip: str) -> _DeviceConnection | None:
        """Get a device connection by IP."""
        return self._devices.get(ip)

    def get_device_info(self, ip: str) -> DeviceInfo | None:
        """Get device info for a connected device."""
        conn = self._devices.get(ip)
        return conn.info if conn and conn.online else None

    def list_devices(self) -> list[DeviceStatus]:
        """List all devices with their current status."""
        return [conn.to_status() for conn in self._devices.values()]

    def get_login_id(self, ip: str) -> int:
        """Get the SDK login ID for a device. Raises if not connected."""
        conn = self._devices.get(ip)
        if not conn or not conn.online or conn.login_id < 0:
            raise ConnectionError(f"Device {ip} is not connected")
        return conn.login_id

    # ═══════════════════════════════════════════
    # Credential fetching from AION API
    # ═══════════════════════════════════════════

    async def fetch_devices_from_aion(self) -> list[DeviceCredentials]:
        """Fetch Hikvision device credentials from AION Fastify API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers: dict[str, str] = {}
                if settings.aion_api_key:
                    headers["X-API-Key"] = settings.aion_api_key

                resp = await client.get(
                    f"{settings.aion_api_url}/devices",
                    params={"brand": "hikvision", "limit": "500"},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()

                devices_list = data.get("data", data) if isinstance(data, dict) else data
                if not isinstance(devices_list, list):
                    devices_list = []

                credentials = []
                for d in devices_list:
                    ip = d.get("ip_address") or d.get("ip", "")
                    username = d.get("username", "admin")
                    password = d.get("password", "")
                    if ip and password:
                        credentials.append(
                            DeviceCredentials(
                                ip=ip,
                                port=int(d.get("port", 8000)),
                                username=username,
                                password=password,
                                name=d.get("name", ""),
                                site_id=str(d.get("site_id", "")),
                                device_id=str(d.get("id", "")),
                            )
                        )
                logger.info("Fetched device credentials from AION", count=len(credentials))
                return credentials

        except Exception as exc:
            logger.error("Failed to fetch devices from AION API", error=str(exc))
            return []

    async def refresh_from_aion(self) -> list[DeviceStatus]:
        """Fetch devices from AION and login to any new ones."""
        credentials = await self.fetch_devices_from_aion()
        new_devices = [
            c for c in credentials
            if c.ip not in self._devices or not self._devices[c.ip].online
        ]
        if new_devices:
            logger.info("Logging in to new devices", count=len(new_devices))
            return await self.bulk_login(new_devices)
        return self.list_devices()

    # ═══════════════════════════════════════════
    # Heartbeat & Reconnection
    # ═══════════════════════════════════════════

    async def _heartbeat_loop(self) -> None:
        """Periodic heartbeat and reconnection for all devices."""
        while self._running:
            try:
                await asyncio.sleep(settings.heartbeat_interval)
                if not self._running:
                    break

                for ip, conn in list(self._devices.items()):
                    if not self._running:
                        break
                    if conn.online:
                        await self._check_heartbeat(conn)
                    else:
                        await self._try_reconnect(conn)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Heartbeat loop error", error=str(exc))
                await asyncio.sleep(5)

    async def _check_heartbeat(self, conn: _DeviceConnection) -> None:
        """Check if a connected device is still alive."""
        try:
            alive = await asyncio.get_running_loop().run_in_executor(
                _sdk_executor, self._ping_device, conn
            )
            if alive:
                conn.last_heartbeat = datetime.now(timezone.utc)
            else:
                logger.warning("Device heartbeat failed", ip=conn.credentials.ip)
                conn.online = False
                conn.error = "Heartbeat failed"
        except Exception as exc:
            conn.online = False
            conn.error = str(exc)

    def _ping_device(self, conn: _DeviceConnection) -> bool:
        """Blocking ping via SDK — runs in thread pool."""
        if not self._sdk_available:
            return True  # Mock mode always "alive"
        try:
            from hikvision_sdk import HikvisionSDK
            # Attempt a lightweight SDK call to verify connection
            return HikvisionSDK.check_connection(conn.login_id)
        except Exception:
            return False

    async def _try_reconnect(self, conn: _DeviceConnection) -> None:
        """Attempt reconnection with exponential backoff."""
        if conn.reconnect_delay > 0:
            # Check if enough time has elapsed since last attempt
            if conn.last_heartbeat:
                elapsed = (datetime.now(timezone.utc) - conn.last_heartbeat).total_seconds()
                if elapsed < conn.reconnect_delay:
                    return

        try:
            info = await asyncio.get_running_loop().run_in_executor(
                _sdk_executor, self._do_login, conn
            )
            if conn.online:
                conn.reconnect_count += 1
                conn.reset_backoff()
                logger.info(
                    "Device reconnected",
                    ip=conn.credentials.ip,
                    attempt=conn.reconnect_count,
                )
            else:
                conn.increase_backoff()
                conn.last_heartbeat = datetime.now(timezone.utc)  # Track attempt time
        except Exception as exc:
            conn.increase_backoff()
            conn.last_heartbeat = datetime.now(timezone.utc)
            conn.error = str(exc)


# Singleton instance
device_manager = DeviceManager()
