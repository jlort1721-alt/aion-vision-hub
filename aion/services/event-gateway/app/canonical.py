import uuid
from datetime import datetime, timezone
from typing import Any


SEVERITY_MAP = {
    "info": "info",
    "low": "low",
    "medium": "medium",
    "high": "high",
    "critical": "critical",
    "warning": "medium",
    "error": "high",
    "alarm": "high",
}


def _pick_severity(row: dict[str, Any], default: str = "info") -> str:
    raw = (row.get("severity") or row.get("level") or row.get("priority") or "").lower()
    return SEVERITY_MAP.get(raw, default)


def _pick_timestamp(row: dict[str, Any]) -> str:
    for key in ("timestamp", "created_at", "occurred_at", "event_time"):
        val = row.get(key)
        if val:
            if isinstance(val, str):
                return val
            return val.isoformat() if hasattr(val, "isoformat") else str(val)
    return datetime.now(timezone.utc).isoformat()


def build_canonical(notify_payload: dict[str, Any]) -> dict[str, Any]:
    table = notify_payload.get("table", "unknown")
    op = notify_payload.get("op", "INSERT")
    row = notify_payload.get("row") or {}

    category_map = {
        "events": row.get("category") or row.get("type") or "system",
        "incidents": "incident",
        "alert_instances": "alert",
    }
    category = category_map.get(table, "system")

    source_id = (
        row.get("source_id")
        or row.get("camera_id")
        or row.get("device_id")
        or row.get("id")
        or f"{table}:{op}"
    )

    canonical = {
        "event_id": str(uuid.uuid4()),
        "event_version": "1.0.0",
        "source_type": "aion_db",
        "source_id": str(source_id),
        "site_id": row.get("site_id"),
        "tenant_id": notify_payload.get("tenant_id") or row.get("tenant_id"),
        "timestamp": _pick_timestamp(row),
        "severity": _pick_severity(row),
        "category": str(category),
        "payload": {
            "db_op": op,
            "db_table": table,
            "row": row,
        },
        "snapshot_url": row.get("snapshot_url"),
        "clip_url": row.get("clip_url"),
        "correlation_id": row.get("correlation_id"),
        "operator_action": row.get("operator_action"),
    }
    return canonical


def topic_for(canonical: dict[str, Any], prefix: str) -> str:
    return f"{prefix}/{canonical['category']}/{canonical['source_type']}"
