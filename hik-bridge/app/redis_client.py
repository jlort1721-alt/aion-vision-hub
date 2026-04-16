"""AION Hikvision Bridge — Redis pub/sub client for event streaming."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
import structlog

from app.config import settings

logger = structlog.get_logger("redis_client")

# Redis channels
CHANNEL_ALARMS = "aion:hik:alarms"
CHANNEL_DEVICE_STATUS = "aion:hik:device_status"
ALARM_QUEUE = "aion:hik:alarm_queue"
DEDUP_PREFIX = "dedup:alarm"


class RedisPublisher:
    """Async Redis client for publishing events and managing dedup keys."""

    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None
        self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        """Connect to Redis."""
        try:
            self._client = aioredis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
            await self._client.ping()
            self._connected = True
            logger.info("Redis connected", url=settings.redis_url.split("@")[-1])
        except Exception as exc:
            logger.warning("Redis connection failed — events will not be published", error=str(exc))
            self._connected = False

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.aclose()
            self._connected = False
            logger.info("Redis disconnected")

    async def publish_alarm(self, event: dict[str, Any]) -> bool:
        """Publish an alarm event to Redis channel and queue.

        Returns True if published (not a duplicate), False if deduplicated or failed.
        """
        if not self._connected or not self._client:
            logger.debug("Redis not connected — alarm not published")
            return False

        try:
            # Deduplication check: SET NX with 10s TTL
            device_ip = event.get("device_ip", "")
            channel = event.get("channel", 0)
            event_type = event.get("event_type", "")
            dedup_key = f"{DEDUP_PREFIX}:{device_ip}:{channel}:{event_type}"

            was_set = await self._client.set(dedup_key, "1", ex=10, nx=True)
            if not was_set:
                logger.debug("Alarm deduplicated", key=dedup_key)
                return False

            # Serialize event
            payload = json.dumps(event, default=_json_serializer)

            # Publish to channel (real-time consumers)
            await self._client.publish(CHANNEL_ALARMS, payload)

            # Push to queue (reliable processing)
            await self._client.lpush(ALARM_QUEUE, payload)
            # Trim queue to last 10,000 events
            await self._client.ltrim(ALARM_QUEUE, 0, 9999)

            logger.debug(
                "Alarm published",
                device_ip=device_ip,
                channel=channel,
                event_type=event_type,
            )
            return True

        except Exception as exc:
            logger.error("Failed to publish alarm", error=str(exc))
            return False

    async def publish_device_status(self, status: dict[str, Any]) -> None:
        """Publish device status change to Redis channel."""
        if not self._connected or not self._client:
            return
        try:
            payload = json.dumps(status, default=_json_serializer)
            await self._client.publish(CHANNEL_DEVICE_STATUS, payload)
        except Exception as exc:
            logger.error("Failed to publish device status", error=str(exc))

    async def get_recent_alarms(self, count: int = 100) -> list[dict[str, Any]]:
        """Get recent alarms from the Redis queue."""
        if not self._connected or not self._client:
            return []
        try:
            raw = await self._client.lrange(ALARM_QUEUE, 0, count - 1)
            return [json.loads(item) for item in raw]
        except Exception as exc:
            logger.error("Failed to get recent alarms", error=str(exc))
            return []

    async def check_dedup(self, device_ip: str, channel: int, event_type: str) -> bool:
        """Check if an event is a duplicate. Returns True if it IS a duplicate."""
        if not self._connected or not self._client:
            return False
        dedup_key = f"{DEDUP_PREFIX}:{device_ip}:{channel}:{event_type}"
        try:
            return bool(await self._client.exists(dedup_key))
        except Exception:
            return False


def _json_serializer(obj: Any) -> Any:
    """JSON serializer for datetime and other non-standard types."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


# Singleton instance
redis_publisher = RedisPublisher()
