import json
import uuid
from datetime import datetime, timezone

import pytest

from app.canonical import SEVERITY_MAP, build_canonical, topic_for


def _payload_for(table: str, row: dict) -> dict:
    return {"table": table, "op": "INSERT", "tenant_id": None, "row": row}


class TestBuildCanonical:
    def test_events_table_maps_to_row_category(self):
        row = {
            "id": "evt-1",
            "category": "person",
            "severity": "high",
            "source_id": "camera-01",
            "created_at": "2026-04-17T06:00:00Z",
        }
        result = build_canonical(_payload_for("events", row))

        assert result["event_version"] == "1.0.0"
        assert result["source_type"] == "aion_db"
        assert result["source_id"] == "camera-01"
        assert result["category"] == "person"
        assert result["severity"] == "high"
        assert result["timestamp"] == "2026-04-17T06:00:00Z"
        assert result["payload"]["db_op"] == "INSERT"
        assert result["payload"]["db_table"] == "events"
        uuid.UUID(result["event_id"])

    def test_incidents_table_overrides_category_to_incident(self):
        row = {"id": "inc-1", "severity": "critical"}
        result = build_canonical(_payload_for("incidents", row))
        assert result["category"] == "incident"

    def test_alert_instances_table_overrides_to_alert(self):
        row = {"id": "alr-1", "severity": "medium"}
        result = build_canonical(_payload_for("alert_instances", row))
        assert result["category"] == "alert"

    def test_unknown_table_falls_back_to_system(self):
        row = {"id": "x-1"}
        result = build_canonical(_payload_for("unknown_table", row))
        assert result["category"] == "system"

    def test_source_id_fallback_chain(self):
        # row.source_id wins
        row1 = {"source_id": "A", "camera_id": "B", "device_id": "C", "id": "D"}
        assert build_canonical(_payload_for("events", row1))["source_id"] == "A"
        # then camera_id
        row2 = {"camera_id": "B", "device_id": "C", "id": "D"}
        assert build_canonical(_payload_for("events", row2))["source_id"] == "B"
        # then device_id
        row3 = {"device_id": "C", "id": "D"}
        assert build_canonical(_payload_for("events", row3))["source_id"] == "C"
        # then id
        row4 = {"id": "D"}
        assert build_canonical(_payload_for("events", row4))["source_id"] == "D"
        # fallback to table:op
        empty = build_canonical({"table": "events", "op": "DELETE", "row": {}})
        assert empty["source_id"] == "events:DELETE"

    def test_severity_mapping(self):
        for raw, expected in [
            ("info", "info"),
            ("low", "low"),
            ("MEDIUM", "medium"),
            ("high", "high"),
            ("critical", "critical"),
            ("warning", "medium"),
            ("error", "high"),
            ("alarm", "high"),
            ("garbage", "info"),
        ]:
            row = {"severity": raw}
            assert build_canonical(_payload_for("events", row))["severity"] == expected

    def test_timestamp_preference_order(self):
        # timestamp > created_at > occurred_at > event_time > now()
        row = {
            "timestamp": "2026-01-01T00:00:00Z",
            "created_at": "2026-02-01T00:00:00Z",
        }
        assert build_canonical(_payload_for("events", row))["timestamp"] == "2026-01-01T00:00:00Z"

        row2 = {"created_at": "2026-02-01T00:00:00Z"}
        assert build_canonical(_payload_for("events", row2))["timestamp"] == "2026-02-01T00:00:00Z"

    def test_tenant_id_from_notify_payload(self):
        tenant = str(uuid.uuid4())
        payload = {"table": "events", "op": "INSERT", "tenant_id": tenant, "row": {"id": "1"}}
        assert build_canonical(payload)["tenant_id"] == tenant

    def test_tenant_id_fallback_to_row(self):
        tenant = str(uuid.uuid4())
        payload = {
            "table": "events",
            "op": "INSERT",
            "tenant_id": None,
            "row": {"id": "1", "tenant_id": tenant},
        }
        assert build_canonical(payload)["tenant_id"] == tenant

    def test_snapshot_and_clip_urls_preserved(self):
        row = {
            "id": "1",
            "snapshot_url": "s3://bucket/snap.jpg",
            "clip_url": "s3://bucket/clip.mp4",
        }
        result = build_canonical(_payload_for("events", row))
        assert result["snapshot_url"] == "s3://bucket/snap.jpg"
        assert result["clip_url"] == "s3://bucket/clip.mp4"

    def test_event_id_is_unique(self):
        row = {"id": "same"}
        ids = {build_canonical(_payload_for("events", row))["event_id"] for _ in range(100)}
        assert len(ids) == 100

    def test_timestamp_datetime_object_iso_converted(self):
        dt = datetime(2026, 4, 17, 6, 0, tzinfo=timezone.utc)
        row = {"timestamp": dt}
        result = build_canonical(_payload_for("events", row))
        assert result["timestamp"].startswith("2026-04-17T06:00:00")

    def test_payload_roundtrip_json(self):
        row = {"id": "1", "severity": "high", "category": "person"}
        result = build_canonical(_payload_for("events", row))
        assert json.loads(json.dumps(result)) == result


class TestTopicFor:
    def test_basic_topic(self):
        canonical = {"category": "motion", "source_type": "aion_db"}
        assert topic_for(canonical, "aion/events") == "aion/events/motion/aion_db"

    def test_topic_with_different_prefix(self):
        canonical = {"category": "person", "source_type": "frigate"}
        assert topic_for(canonical, "custom/prefix") == "custom/prefix/person/frigate"


class TestSeverityMap:
    def test_all_enum_values_map_to_valid_severity(self):
        valid = {"info", "low", "medium", "high", "critical"}
        for mapped in SEVERITY_MAP.values():
            assert mapped in valid
