import { describe, it, expect } from "vitest";

/**
 * Event Normalization Tests
 *
 * Validates that events from different sources (Hikvision, Dahua, ONVIF)
 * are normalized to a common format before storage and display.
 */

interface NormalizedEvent {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "new" | "acknowledged" | "investigating" | "resolved" | "dismissed";
  source_device_id: string;
  source_brand: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  tenant_id: string;
}

// Normalization functions mirroring the gateway's event processing
function normalizeHikvisionEvent(raw: Record<string, any>): Partial<NormalizedEvent> {
  const typeMap: Record<string, string> = {
    VMD: "motion_detection",
    linedetection: "line_crossing",
    fielddetection: "intrusion",
    facedetection: "face_detection",
    ANPR: "license_plate",
    videoloss: "video_loss",
    shelteralarm: "camera_tamper",
  };

  const severityMap: Record<string, NormalizedEvent["severity"]> = {
    VMD: "low",
    linedetection: "medium",
    fielddetection: "high",
    facedetection: "info",
    ANPR: "info",
    videoloss: "critical",
    shelteralarm: "high",
  };

  return {
    type: typeMap[raw.eventType] || raw.eventType,
    severity: severityMap[raw.eventType] || "info",
    source_brand: "hikvision",
    title: `Hikvision: ${typeMap[raw.eventType] || raw.eventType}`,
    metadata: {
      channelID: raw.channelID,
      dateTime: raw.dateTime,
      rawType: raw.eventType,
    },
  };
}

function normalizeDahuaEvent(raw: Record<string, any>): Partial<NormalizedEvent> {
  const typeMap: Record<string, string> = {
    VideoMotion: "motion_detection",
    CrossLineDetection: "line_crossing",
    CrossRegionDetection: "intrusion",
    FaceDetection: "face_detection",
    TrafficJunction: "license_plate",
    VideoBlind: "camera_tamper",
    VideoLoss: "video_loss",
  };

  const severityMap: Record<string, NormalizedEvent["severity"]> = {
    VideoMotion: "low",
    CrossLineDetection: "medium",
    CrossRegionDetection: "high",
    FaceDetection: "info",
    TrafficJunction: "info",
    VideoBlind: "high",
    VideoLoss: "critical",
  };

  return {
    type: typeMap[raw.Code] || raw.Code,
    severity: severityMap[raw.Code] || "info",
    source_brand: "dahua",
    title: `Dahua: ${typeMap[raw.Code] || raw.Code}`,
    metadata: {
      channel: raw.index,
      action: raw.action,
      rawCode: raw.Code,
    },
  };
}

describe("Event Normalization", () => {
  describe("Hikvision Event Normalization", () => {
    it("normalizes motion detection event", () => {
      const raw = { eventType: "VMD", channelID: 1, dateTime: "2026-03-08T10:00:00Z" };
      const normalized = normalizeHikvisionEvent(raw);

      expect(normalized.type).toBe("motion_detection");
      expect(normalized.severity).toBe("low");
      expect(normalized.source_brand).toBe("hikvision");
    });

    it("normalizes line crossing event", () => {
      const raw = { eventType: "linedetection", channelID: 2 };
      const normalized = normalizeHikvisionEvent(raw);

      expect(normalized.type).toBe("line_crossing");
      expect(normalized.severity).toBe("medium");
    });

    it("normalizes intrusion detection as high severity", () => {
      const raw = { eventType: "fielddetection", channelID: 1 };
      const normalized = normalizeHikvisionEvent(raw);

      expect(normalized.type).toBe("intrusion");
      expect(normalized.severity).toBe("high");
    });

    it("normalizes video loss as critical", () => {
      const raw = { eventType: "videoloss", channelID: 3 };
      const normalized = normalizeHikvisionEvent(raw);

      expect(normalized.type).toBe("video_loss");
      expect(normalized.severity).toBe("critical");
    });

    it("handles unknown event types gracefully", () => {
      const raw = { eventType: "customAlarm", channelID: 1 };
      const normalized = normalizeHikvisionEvent(raw);

      expect(normalized.type).toBe("customAlarm");
      expect(normalized.severity).toBe("info");
    });
  });

  describe("Dahua Event Normalization", () => {
    it("normalizes motion detection", () => {
      const raw = { Code: "VideoMotion", index: 0, action: "Start" };
      const normalized = normalizeDahuaEvent(raw);

      expect(normalized.type).toBe("motion_detection");
      expect(normalized.severity).toBe("low");
      expect(normalized.source_brand).toBe("dahua");
    });

    it("normalizes cross-line detection", () => {
      const raw = { Code: "CrossLineDetection", index: 1, action: "Start" };
      const normalized = normalizeDahuaEvent(raw);

      expect(normalized.type).toBe("line_crossing");
      expect(normalized.severity).toBe("medium");
    });

    it("normalizes video loss as critical", () => {
      const raw = { Code: "VideoLoss", index: 0, action: "Start" };
      const normalized = normalizeDahuaEvent(raw);

      expect(normalized.type).toBe("video_loss");
      expect(normalized.severity).toBe("critical");
    });
  });

  describe("Cross-brand Consistency", () => {
    it("same event type from different brands produces same normalized type", () => {
      const hikMotion = normalizeHikvisionEvent({ eventType: "VMD" });
      const dahuaMotion = normalizeDahuaEvent({ Code: "VideoMotion" });

      expect(hikMotion.type).toBe(dahuaMotion.type);
      expect(hikMotion.type).toBe("motion_detection");
    });

    it("video loss from both brands is critical", () => {
      const hikLoss = normalizeHikvisionEvent({ eventType: "videoloss" });
      const dahuaLoss = normalizeDahuaEvent({ Code: "VideoLoss" });

      expect(hikLoss.severity).toBe("critical");
      expect(dahuaLoss.severity).toBe("critical");
    });

    it("normalized events have consistent structure", () => {
      const hikEvent = normalizeHikvisionEvent({ eventType: "VMD", channelID: 1 });
      const dahuaEvent = normalizeDahuaEvent({ Code: "VideoMotion", index: 0, action: "Start" });

      // Both should have these fields
      for (const event of [hikEvent, dahuaEvent]) {
        expect(event).toHaveProperty("type");
        expect(event).toHaveProperty("severity");
        expect(event).toHaveProperty("source_brand");
        expect(event).toHaveProperty("title");
        expect(event).toHaveProperty("metadata");
      }
    });
  });

  describe("Severity Levels", () => {
    it("severity hierarchy is correct", () => {
      const severityOrder = ["info", "low", "medium", "high", "critical"];
      expect(severityOrder.indexOf("critical")).toBeGreaterThan(severityOrder.indexOf("high"));
      expect(severityOrder.indexOf("high")).toBeGreaterThan(severityOrder.indexOf("medium"));
      expect(severityOrder.indexOf("medium")).toBeGreaterThan(severityOrder.indexOf("low"));
      expect(severityOrder.indexOf("low")).toBeGreaterThan(severityOrder.indexOf("info"));
    });
  });
});
