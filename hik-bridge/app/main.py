"""AION Hikvision Bridge — FastAPI application entry point.

Microservice that bridges AION (Node.js/Fastify) with Hikvision HCNetSDK
(native binary protocol on port 8000). Runs as a sidecar on port 8100.
"""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.auth import verify_api_key
from app.config import settings
from app.device_manager import device_manager
from app.models import (
    ApiResponse,
    DeviceCredentials,
    DeviceInfo,
    DeviceStatus,
    HealthResponse,
    PTZMoveRequest,
    PTZPresetRequest,
    PTZStopRequest,
    RecordingDownloadRequest,
    RecordingSearchRequest,
    SnapshotRequest,
)
from app.redis_client import redis_publisher
from app.alarm_manager import alarm_manager
from app.ptz_controller import ptz_controller
from app.snapshot_manager import snapshot_manager
from app.recording_manager import recording_manager
from app.discovery_manager import discovery_manager

logger = structlog.get_logger("main")

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.log_level == "debug" else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        structlog.get_level_from_name(settings.log_level)
    ),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    logger.info(
        "AION Hikvision Bridge starting",
        port=settings.port,
        sdk_lib_path=settings.sdk_lib_path,
    )

    # Ensure storage directories exist
    os.makedirs(settings.snapshots_dir, exist_ok=True)
    os.makedirs(settings.downloads_dir, exist_ok=True)
    os.makedirs(settings.sdk_log_dir, exist_ok=True)

    # Start services
    await redis_publisher.connect()
    await device_manager.start()

    # Set event loop for alarm callbacks (thread-safe bridging)
    alarm_manager.set_event_loop(asyncio.get_running_loop())

    # Auto-connect to devices from AION API
    try:
        await device_manager.refresh_from_aion()
    except Exception as exc:
        logger.warning("Auto-connect failed — devices can be added manually", error=str(exc))

    yield

    # Shutdown
    logger.info("AION Hikvision Bridge shutting down")
    await device_manager.stop()
    await redis_publisher.disconnect()


app = FastAPI(
    title="AION Hikvision Bridge",
    description="HCNetSDK bridge for AION Vision Hub — PTZ, alarms, recordings, discovery",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# CORS (internal service, but allow frontend dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.aion_api_url.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════
# Health endpoints (no auth required)
# ═══════════════════════════════════════════


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check — returns SDK status and connected device count."""
    return HealthResponse(
        status="ok" if device_manager.sdk_available else "degraded",
        sdk_initialized=device_manager.sdk_available,
        sdk_version=device_manager.sdk_version,
        connected_devices=device_manager.connected_count,
        alarm_subscriptions=alarm_manager.subscription_count,
        uptime_seconds=device_manager.uptime_seconds,
    )


@app.get("/health/sdk", tags=["Health"])
async def sdk_health():
    """Detailed SDK health information."""
    return {
        "sdk_available": device_manager.sdk_available,
        "sdk_version": device_manager.sdk_version,
        "redis_connected": redis_publisher.connected,
        "sdk_lib_path": settings.sdk_lib_path,
        "sdk_lib_exists": os.path.isdir(settings.sdk_lib_path),
    }


@app.get("/metrics", tags=["Health"])
async def metrics():
    """Connection metrics for monitoring."""
    devices = device_manager.list_devices()
    online = [d for d in devices if d.online]
    offline = [d for d in devices if not d.online]
    return {
        "total_devices": len(devices),
        "online_devices": len(online),
        "offline_devices": len(offline),
        "total_reconnections": sum(d.reconnect_count for d in devices),
        "redis_connected": redis_publisher.connected,
        "uptime_seconds": device_manager.uptime_seconds,
    }


# ═══════════════════════════════════════════
# Device endpoints (auth required)
# ═══════════════════════════════════════════


@app.get("/api/devices", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def list_devices() -> ApiResponse:
    """List all devices with their SDK connection status."""
    devices = device_manager.list_devices()
    return ApiResponse(
        success=True,
        data=[d.model_dump() for d in devices],
        meta={"total": len(devices), "online": sum(1 for d in devices if d.online)},
    )


@app.get("/api/devices/{ip}/info", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def get_device_info(ip: str) -> ApiResponse:
    """Get detailed info for a connected device."""
    info = device_manager.get_device_info(ip)
    if not info:
        raise HTTPException(status_code=404, detail=f"Device {ip} not found or not connected")
    return ApiResponse(success=True, data=info.model_dump())


@app.get("/api/devices/{ip}/status", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def get_device_status(ip: str) -> ApiResponse:
    """Get runtime status for a device."""
    conn = device_manager.get_device(ip)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Device {ip} not registered")
    return ApiResponse(success=True, data=conn.to_status().model_dump())


@app.post("/api/devices/login", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def login_device(credentials: DeviceCredentials) -> ApiResponse:
    """Login to a single device via SDK."""
    try:
        info = await device_manager.login_device(credentials)
        return ApiResponse(success=True, data=info.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/devices/bulk-login", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def bulk_login(devices: list[DeviceCredentials]) -> ApiResponse:
    """Login to multiple devices concurrently."""
    statuses = await device_manager.bulk_login(devices)
    return ApiResponse(
        success=True,
        data=[s.model_dump() for s in statuses],
        meta={
            "total": len(statuses),
            "online": sum(1 for s in statuses if s.online),
        },
    )


@app.delete("/api/devices/{ip}/logout", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def logout_device(ip: str) -> ApiResponse:
    """Logout from a device and remove from pool."""
    result = await device_manager.logout_device(ip)
    if not result:
        raise HTTPException(status_code=404, detail=f"Device {ip} not found or not connected")
    return ApiResponse(success=True, data={"ip": ip, "logged_out": True})


@app.post("/api/devices/refresh", tags=["Devices"], dependencies=[Depends(verify_api_key)])
async def refresh_devices() -> ApiResponse:
    """Re-fetch devices from AION API and connect new ones."""
    statuses = await device_manager.refresh_from_aion()
    return ApiResponse(
        success=True,
        data=[s.model_dump() for s in statuses],
        meta={
            "total": len(statuses),
            "online": sum(1 for s in statuses if s.online),
        },
    )


# ═══════════════════════════════════════════
# Alarm endpoints (placeholder — filled in Phase 2)
# ═══════════════════════════════════════════


@app.get("/api/alarms/recent", tags=["Alarms"], dependencies=[Depends(verify_api_key)])
async def get_recent_alarms(count: int = Query(default=100, le=1000)) -> ApiResponse:
    """Get recent alarm events from Redis queue."""
    alarms = await redis_publisher.get_recent_alarms(count)
    return ApiResponse(success=True, data=alarms, meta={"count": len(alarms)})


# ═══════════════════════════════════════════
# Error handlers
# ═══════════════════════════════════════════


# ═══════════════════════════════════════════
# Alarm endpoints
# ═══════════════════════════════════════════


@app.post("/api/alarms/subscribe/{ip}", tags=["Alarms"], dependencies=[Depends(verify_api_key)])
async def subscribe_alarms(ip: str) -> ApiResponse:
    """Subscribe to SDK alarm callbacks for a device."""
    try:
        sub = await alarm_manager.subscribe(ip)
        return ApiResponse(success=True, data=sub.model_dump())
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.delete("/api/alarms/unsubscribe/{ip}", tags=["Alarms"], dependencies=[Depends(verify_api_key)])
async def unsubscribe_alarms(ip: str) -> ApiResponse:
    """Unsubscribe from alarm callbacks for a device."""
    result = await alarm_manager.unsubscribe(ip)
    if not result:
        raise HTTPException(status_code=404, detail=f"No active subscription for {ip}")
    return ApiResponse(success=True, data={"ip": ip, "unsubscribed": True})


@app.get("/api/alarms/subscriptions", tags=["Alarms"], dependencies=[Depends(verify_api_key)])
async def list_alarm_subscriptions() -> ApiResponse:
    """List all active alarm subscriptions."""
    subs = alarm_manager.list_subscriptions()
    return ApiResponse(success=True, data=[s.model_dump() for s in subs])


# ═══════════════════════════════════════════
# PTZ endpoints
# ═══════════════════════════════════════════


@app.post("/api/ptz/move", tags=["PTZ"], dependencies=[Depends(verify_api_key)])
async def ptz_move(request: PTZMoveRequest) -> ApiResponse:
    """Start PTZ movement in a direction."""
    try:
        result = await ptz_controller.move(request)
        return ApiResponse(success=True, data=result)
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ptz/stop", tags=["PTZ"], dependencies=[Depends(verify_api_key)])
async def ptz_stop(request: PTZStopRequest) -> ApiResponse:
    """Stop all PTZ movement."""
    try:
        result = await ptz_controller.stop(request)
        return ApiResponse(success=True, data=result)
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/ptz/preset", tags=["PTZ"], dependencies=[Depends(verify_api_key)])
async def ptz_preset(request: PTZPresetRequest) -> ApiResponse:
    """Execute a PTZ preset action (goto, set, clear)."""
    try:
        result = await ptz_controller.preset(request)
        return ApiResponse(success=True, data=result)
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/ptz/{ip}/presets", tags=["PTZ"], dependencies=[Depends(verify_api_key)])
async def get_ptz_presets(ip: str, channel: int = Query(default=1, ge=1)) -> ApiResponse:
    """List available PTZ presets for a device."""
    try:
        presets = await ptz_controller.get_presets(ip, channel)
        return ApiResponse(success=True, data=presets)
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ═══════════════════════════════════════════
# Snapshot endpoints
# ═══════════════════════════════════════════


@app.post("/api/snapshots/capture", tags=["Snapshots"], dependencies=[Depends(verify_api_key)])
async def capture_snapshot(request: SnapshotRequest) -> ApiResponse:
    """Capture a JPEG snapshot from a device channel."""
    try:
        result = await snapshot_manager.capture(request.device_ip, request.channel, request.quality)
        return ApiResponse(success=True, data=result.model_dump())
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/snapshots", tags=["Snapshots"], dependencies=[Depends(verify_api_key)])
async def list_snapshots(device_ip: str | None = None) -> ApiResponse:
    """List saved snapshot files."""
    snapshots = await snapshot_manager.list_snapshots(device_ip)
    return ApiResponse(success=True, data=snapshots, meta={"count": len(snapshots)})


@app.get("/api/snapshots/{filename}", tags=["Snapshots"], dependencies=[Depends(verify_api_key)])
async def get_snapshot(filename: str):
    """Serve a saved snapshot file."""
    filepath = os.path.join(settings.snapshots_dir, filename)
    real_path = os.path.realpath(filepath)
    real_dir = os.path.realpath(settings.snapshots_dir)
    if not real_path.startswith(real_dir) or not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(real_path, media_type="image/jpeg")


@app.delete("/api/snapshots/{filename}", tags=["Snapshots"], dependencies=[Depends(verify_api_key)])
async def delete_snapshot(filename: str) -> ApiResponse:
    """Delete a saved snapshot."""
    try:
        result = await snapshot_manager.delete_snapshot(filename)
        if not result:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        return ApiResponse(success=True, data={"filename": filename, "deleted": True})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ═══════════════════════════════════════════
# Recording endpoints
# ═══════════════════════════════════════════


@app.post("/api/recordings/search", tags=["Recordings"], dependencies=[Depends(verify_api_key)])
async def search_recordings(request: RecordingSearchRequest) -> ApiResponse:
    """Search for recording files on a device."""
    try:
        files = await recording_manager.search(request)
        return ApiResponse(
            success=True,
            data=[f.model_dump() for f in files],
            meta={"count": len(files)},
        )
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/recordings/download", tags=["Recordings"], dependencies=[Depends(verify_api_key)])
async def start_recording_download(request: RecordingDownloadRequest) -> ApiResponse:
    """Start downloading a recording file from a device."""
    try:
        status = await recording_manager.start_download(request)
        return ApiResponse(success=True, data=status.model_dump())
    except ConnectionError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/recordings/download/{download_id}/status", tags=["Recordings"], dependencies=[Depends(verify_api_key)])
async def get_download_status(download_id: str) -> ApiResponse:
    """Get the status of a recording download."""
    status = recording_manager.get_download_status(download_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Download {download_id} not found")
    return ApiResponse(success=True, data=status.model_dump())


@app.get("/api/recordings/download/{download_id}/file", tags=["Recordings"], dependencies=[Depends(verify_api_key)])
async def download_recording_file(download_id: str):
    """Download a completed recording file."""
    path = recording_manager.get_download_path(download_id)
    if not path:
        raise HTTPException(status_code=404, detail="Download not ready or not found")
    return FileResponse(path, media_type="video/mp4", filename=os.path.basename(path))


@app.get("/api/recordings/downloads", tags=["Recordings"], dependencies=[Depends(verify_api_key)])
async def list_downloads() -> ApiResponse:
    """List all recording downloads."""
    downloads = recording_manager.list_downloads()
    return ApiResponse(
        success=True,
        data=[d.model_dump() for d in downloads],
        meta={"count": len(downloads)},
    )


# ═══════════════════════════════════════════
# Discovery endpoints
# ═══════════════════════════════════════════


@app.post("/api/discovery/scan", tags=["Discovery"], dependencies=[Depends(verify_api_key)])
async def scan_network(timeout: int = Query(default=10, ge=3, le=60)) -> ApiResponse:
    """Perform SADP broadcast scan for Hikvision devices on the network."""
    devices = await discovery_manager.scan(timeout)
    return ApiResponse(
        success=True,
        data=[d.model_dump() for d in devices],
        meta={
            "count": len(devices),
            "new": sum(1 for d in devices if not d.already_registered),
        },
    )


# ═══════════════════════════════════════════
# Error handlers
# ═══════════════════════════════════════════


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Unhandled error", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": str(exc)},
    )
