"""AION Hikvision Bridge — PTZ control via HCNetSDK.

Provides pan, tilt, zoom, iris, focus, and preset control
using the native SDK binary protocol (port 8000).
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.device_manager import device_manager
from app.models import PTZMoveRequest, PTZPresetRequest, PTZStopRequest

logger = structlog.get_logger("ptz_controller")

# HCNetSDK PTZ command codes
PTZ_COMMANDS: dict[str, int] = {
    "up": 21,
    "down": 22,
    "left": 23,
    "right": 24,
    "left_up": 25,
    "left_down": 26,
    "right_up": 27,
    "right_down": 28,
    "zoom_in": 11,
    "zoom_out": 12,
    "iris_open": 13,
    "iris_close": 14,
    "focus_near": 15,
    "focus_far": 16,
    "auto_pan": 29,
}

# Preset action codes
PRESET_ACTIONS: dict[str, int] = {
    "goto": 39,  # GOTO_PRESET
    "set": 8,    # SET_PRESET
    "clear": 9,  # CLEAR_PRESET
}


class PTZController:
    """Controls PTZ cameras via HCNetSDK commands."""

    async def move(self, request: PTZMoveRequest) -> dict[str, Any]:
        """Start PTZ movement in a direction at given speed."""
        direction = request.direction.lower().replace("-", "_")
        if direction not in PTZ_COMMANDS:
            raise ValueError(
                f"Invalid direction: {direction}. "
                f"Valid: {', '.join(PTZ_COMMANDS.keys())}"
            )

        login_id = device_manager.get_login_id(request.device_ip)
        cmd_code = PTZ_COMMANDS[direction]

        result = await asyncio.get_running_loop().run_in_executor(
            None,
            self._do_ptz_control,
            login_id,
            request.channel,
            cmd_code,
            0,  # action: 0 = start
            request.speed,
        )

        logger.info(
            "PTZ move",
            device_ip=request.device_ip,
            channel=request.channel,
            direction=direction,
            speed=request.speed,
        )
        return {"action": "move", "direction": direction, "speed": request.speed, "success": result}

    async def stop(self, request: PTZStopRequest) -> dict[str, Any]:
        """Stop all PTZ movement on a channel."""
        login_id = device_manager.get_login_id(request.device_ip)

        # Stop all possible movements
        result = await asyncio.get_running_loop().run_in_executor(
            None,
            self._do_ptz_control,
            login_id,
            request.channel,
            21,  # UP command (any direction works for stop)
            1,   # action: 1 = stop
            4,   # speed doesn't matter for stop
        )

        logger.info("PTZ stop", device_ip=request.device_ip, channel=request.channel)
        return {"action": "stop", "success": result}

    async def preset(self, request: PTZPresetRequest) -> dict[str, Any]:
        """Execute a preset action (goto, set, or clear)."""
        action = request.action.lower()
        if action not in PRESET_ACTIONS:
            raise ValueError(f"Invalid action: {action}. Valid: goto, set, clear")

        login_id = device_manager.get_login_id(request.device_ip)
        cmd_code = PRESET_ACTIONS[action]

        result = await asyncio.get_running_loop().run_in_executor(
            None,
            self._do_ptz_preset,
            login_id,
            request.channel,
            cmd_code,
            request.preset_index,
        )

        logger.info(
            "PTZ preset",
            device_ip=request.device_ip,
            channel=request.channel,
            action=action,
            preset=request.preset_index,
        )
        return {
            "action": action,
            "preset_index": request.preset_index,
            "success": result,
        }

    async def get_presets(self, device_ip: str, channel: int = 1) -> list[dict[str, Any]]:
        """List available PTZ presets for a device/channel."""
        login_id = device_manager.get_login_id(device_ip)

        presets = await asyncio.get_running_loop().run_in_executor(
            None, self._do_get_presets, login_id, channel
        )
        return presets

    # ═══════════════════════════════════════════
    # Blocking SDK calls (run in thread pool)
    # ═══════════════════════════════════════════

    def _do_ptz_control(
        self,
        login_id: int,
        channel: int,
        command: int,
        action: int,
        speed: int,
    ) -> bool:
        """Execute PTZ control command via SDK."""
        if not device_manager.sdk_available:
            return True  # Mock mode

        try:
            from hikvision_sdk import HikvisionSDK
            return HikvisionSDK.ptz_control(login_id, channel, command, action, speed)
        except Exception as exc:
            logger.error("PTZ control failed", login_id=login_id, error=str(exc))
            return False

    def _do_ptz_preset(
        self,
        login_id: int,
        channel: int,
        command: int,
        preset_index: int,
    ) -> bool:
        """Execute PTZ preset command via SDK."""
        if not device_manager.sdk_available:
            return True  # Mock mode

        try:
            from hikvision_sdk import HikvisionSDK
            return HikvisionSDK.ptz_preset(login_id, channel, command, preset_index)
        except Exception as exc:
            logger.error("PTZ preset failed", login_id=login_id, error=str(exc))
            return False

    def _do_get_presets(self, login_id: int, channel: int) -> list[dict[str, Any]]:
        """Get PTZ presets from device via SDK."""
        if not device_manager.sdk_available:
            # Mock mode: return sample presets
            return [
                {"index": i, "name": f"Preset {i}", "enabled": True}
                for i in range(1, 9)
            ]

        try:
            from hikvision_sdk import HikvisionSDK
            raw = HikvisionSDK.get_presets(login_id, channel)
            return [
                {
                    "index": getattr(p, "index", i),
                    "name": getattr(p, "name", f"Preset {i}"),
                    "enabled": getattr(p, "enabled", True),
                }
                for i, p in enumerate(raw, 1)
            ]
        except Exception as exc:
            logger.error("Get presets failed", login_id=login_id, error=str(exc))
            return []


# Singleton instance
ptz_controller = PTZController()
