"""Tests for alarm event type normalization."""

from app.alarm_manager import normalize_sdk_event_type, SDK_EVENT_TYPE_MAP, SDK_EVENT_STR_MAP


class TestNormalizeSdkEventType:
    def test_integer_motion(self):
        assert normalize_sdk_event_type(3) == "motion"

    def test_integer_intrusion(self):
        assert normalize_sdk_event_type(101) == "intrusion"

    def test_integer_line_crossing(self):
        assert normalize_sdk_event_type(100) == "line_crossing"

    def test_integer_face_detection(self):
        assert normalize_sdk_event_type(110) == "face_detection"

    def test_integer_video_loss(self):
        assert normalize_sdk_event_type(2) == "video_loss"

    def test_integer_disk_full(self):
        assert normalize_sdk_event_type(1) == "disk_full"

    def test_integer_unknown_returns_prefixed(self):
        assert normalize_sdk_event_type(999) == "unknown_999"

    def test_string_vmd(self):
        assert normalize_sdk_event_type("VMD") == "motion"

    def test_string_videomotiondetection(self):
        assert normalize_sdk_event_type("VideoMotionDetection") == "motion"

    def test_string_fielddetection(self):
        assert normalize_sdk_event_type("FieldDetection") == "intrusion"

    def test_string_linedetection(self):
        assert normalize_sdk_event_type("LineDetection") == "line_crossing"

    def test_string_tamperdetection(self):
        assert normalize_sdk_event_type("TamperDetection") == "tamper"

    def test_string_shelteralarm(self):
        assert normalize_sdk_event_type("ShelterAlarm") == "tamper"

    def test_string_unknown_returns_lowercase(self):
        assert normalize_sdk_event_type("SomeNewEvent") == "somenewevent"

    def test_all_integer_types_are_mapped(self):
        """Ensure all integer types return a meaningful string."""
        for code, expected in SDK_EVENT_TYPE_MAP.items():
            result = normalize_sdk_event_type(code)
            assert result == expected, f"Code {code}: expected {expected}, got {result}"

    def test_all_string_types_are_mapped(self):
        """Ensure all string types return the expected normalized value."""
        for raw, expected in SDK_EVENT_STR_MAP.items():
            result = normalize_sdk_event_type(raw)
            assert result == expected, f"Raw '{raw}': expected {expected}, got {result}"

    def test_consistency_with_isapi_map(self):
        """SDK string map should produce same output as ISAPI EVENT_TYPE_MAP."""
        isapi_expected = {
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
        for raw, expected in isapi_expected.items():
            result = normalize_sdk_event_type(raw)
            assert result == expected, (
                f"SDK map inconsistent with ISAPI for '{raw}': "
                f"SDK={result}, ISAPI={expected}"
            )
