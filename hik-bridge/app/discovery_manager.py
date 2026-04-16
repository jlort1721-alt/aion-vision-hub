"""AION Hikvision Bridge — SADP device discovery via HCNetSDK.

Uses the SDK's SADP (Search Active Device Protocol) broadcast
to auto-discover Hikvision devices on the local network.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.device_manager import device_manager
from app.models import DiscoveredDevice

logger = structlog.get_logger("discovery_manager")


class DiscoveryManager:
    """Discovers Hikvision devices on the network via SADP broadcast."""

    async def scan(self, timeout: int = 10) -> list[DiscoveredDevice]:
        """Perform a SADP broadcast scan for Hikvision devices.

        Args:
            timeout: How long to listen for responses (seconds).

        Returns:
            List of discovered devices with their network info.
        """
        devices = await asyncio.get_running_loop().run_in_executor(
            None, self._do_scan, timeout
        )

        # Mark devices already registered in our pool
        connected_ips = {s.ip for s in device_manager.list_devices()}
        for d in devices:
            d.already_registered = d.ip in connected_ips

        logger.info(
            "SADP scan complete",
            found=len(devices),
            new=sum(1 for d in devices if not d.already_registered),
        )
        return devices

    def _do_scan(self, timeout: int) -> list[DiscoveredDevice]:
        """Blocking SADP scan via SDK — runs in executor."""
        if not device_manager.sdk_available:
            return self._mock_scan()

        try:
            from hikvision_sdk import HikvisionSDK

            raw_devices = HikvisionSDK.discover_devices(timeout=timeout)
            return [
                DiscoveredDevice(
                    ip=getattr(d, "ip", ""),
                    port=getattr(d, "port", 8000),
                    serial_number=getattr(d, "serial_number", ""),
                    device_type=getattr(d, "device_type", ""),
                    firmware_version=getattr(d, "firmware_version", ""),
                    mac_address=getattr(d, "mac_address", ""),
                    is_activated=getattr(d, "is_activated", True),
                )
                for d in raw_devices
                if getattr(d, "ip", "")
            ]
        except Exception as exc:
            logger.error("SADP scan failed", error=str(exc))
            return []

    @staticmethod
    def _mock_scan() -> list[DiscoveredDevice]:
        """Mock scan results for development."""
        return [
            DiscoveredDevice(
                ip="192.168.1.100",
                port=8000,
                serial_number="DS-7608NI-K2/8P20201234",
                device_type="NVR",
                firmware_version="V4.73.005",
                mac_address="c0:56:e3:aa:bb:cc",
                is_activated=True,
            ),
            DiscoveredDevice(
                ip="192.168.1.101",
                port=8000,
                serial_number="DS-2CD2143G2-I20205678",
                device_type="IPC",
                firmware_version="V5.7.11",
                mac_address="c0:56:e3:dd:ee:ff",
                is_activated=True,
            ),
        ]


# Singleton instance
discovery_manager = DiscoveryManager()
