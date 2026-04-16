import { describe, it, expect } from "vitest";
import {
  ptzMoveSchema,
  ptzStopSchema,
  ptzPresetSchema,
  recordingSearchSchema,
  recordingDownloadSchema,
  snapshotCaptureSchema,
  deviceLoginSchema,
  bulkLoginSchema,
  discoveryScanSchema,
} from "../modules/hik-bridge/schemas.js";

describe("Hik-Bridge Zod Schemas", () => {
  describe("ptzMoveSchema", () => {
    it("accepts valid PTZ move command", () => {
      const result = ptzMoveSchema.safeParse({
        channel: 1,
        direction: "up",
        speed: 4,
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for channel and speed", () => {
      const result = ptzMoveSchema.safeParse({ direction: "left" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe(1);
        expect(result.data.speed).toBe(4);
      }
    });

    it("accepts auto_pan direction", () => {
      const result = ptzMoveSchema.safeParse({ direction: "auto_pan" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid direction", () => {
      const result = ptzMoveSchema.safeParse({ direction: "teleport" });
      expect(result.success).toBe(false);
    });

    it("rejects speed out of range", () => {
      expect(
        ptzMoveSchema.safeParse({ direction: "up", speed: 0 }).success,
      ).toBe(false);
      expect(
        ptzMoveSchema.safeParse({ direction: "up", speed: 8 }).success,
      ).toBe(false);
    });

    it("accepts all valid directions", () => {
      const directions = [
        "up",
        "down",
        "left",
        "right",
        "left_up",
        "left_down",
        "right_up",
        "right_down",
        "zoom_in",
        "zoom_out",
        "iris_open",
        "iris_close",
        "focus_near",
        "focus_far",
        "auto_pan",
      ];
      for (const direction of directions) {
        const result = ptzMoveSchema.safeParse({ direction });
        expect(result.success).toBe(true);
      }
    });

    it("rejects missing direction", () => {
      const result = ptzMoveSchema.safeParse({ speed: 4 });
      expect(result.success).toBe(false);
    });
  });

  describe("ptzStopSchema", () => {
    it("accepts empty body with defaults", () => {
      const result = ptzStopSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe(1);
      }
    });

    it("accepts explicit channel", () => {
      const result = ptzStopSchema.safeParse({ channel: 3 });
      expect(result.success).toBe(true);
    });
  });

  describe("ptzPresetSchema", () => {
    it("accepts valid preset command", () => {
      const result = ptzPresetSchema.safeParse({
        channel: 1,
        preset_index: 5,
        action: "goto",
      });
      expect(result.success).toBe(true);
    });

    it("defaults action to goto", () => {
      const result = ptzPresetSchema.safeParse({ preset_index: 1 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("goto");
      }
    });

    it("accepts set and clear actions", () => {
      expect(
        ptzPresetSchema.safeParse({ preset_index: 1, action: "set" }).success,
      ).toBe(true);
      expect(
        ptzPresetSchema.safeParse({ preset_index: 1, action: "clear" }).success,
      ).toBe(true);
    });

    it("rejects preset_index out of range", () => {
      expect(ptzPresetSchema.safeParse({ preset_index: 0 }).success).toBe(
        false,
      );
      expect(ptzPresetSchema.safeParse({ preset_index: 257 }).success).toBe(
        false,
      );
    });

    it("rejects invalid action", () => {
      const result = ptzPresetSchema.safeParse({
        preset_index: 1,
        action: "delete",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("recordingSearchSchema", () => {
    it("accepts valid search params", () => {
      const result = recordingSearchSchema.safeParse({
        device_ip: "192.168.1.100",
        channel: 1,
        start_time: "2026-01-15T00:00:00Z",
        end_time: "2026-01-15T23:59:59Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing device_ip", () => {
      const result = recordingSearchSchema.safeParse({
        channel: 1,
        start_time: "2026-01-15T00:00:00Z",
        end_time: "2026-01-15T23:59:59Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime", () => {
      const result = recordingSearchSchema.safeParse({
        device_ip: "192.168.1.100",
        start_time: "not-a-date",
        end_time: "2026-01-15T23:59:59Z",
      });
      expect(result.success).toBe(false);
    });

    it("defaults channel to 1 and file_type to 0xFF", () => {
      const result = recordingSearchSchema.safeParse({
        device_ip: "192.168.1.100",
        start_time: "2026-01-15T00:00:00Z",
        end_time: "2026-01-15T23:59:59Z",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe(1);
        expect(result.data.file_type).toBe(0xff);
      }
    });
  });

  describe("recordingDownloadSchema", () => {
    it("accepts valid download request", () => {
      const result = recordingDownloadSchema.safeParse({
        device_ip: "192.168.1.100",
        filename: "ch01_20260115120000.mp4",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty filename", () => {
      const result = recordingDownloadSchema.safeParse({
        device_ip: "192.168.1.100",
        filename: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short IP", () => {
      const result = recordingDownloadSchema.safeParse({
        device_ip: "1.1",
        filename: "test.mp4",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("snapshotCaptureSchema", () => {
    it("accepts valid snapshot request", () => {
      const result = snapshotCaptureSchema.safeParse({
        device_ip: "192.168.1.100",
        channel: 1,
        quality: 0,
      });
      expect(result.success).toBe(true);
    });

    it("defaults quality to 2", () => {
      const result = snapshotCaptureSchema.safeParse({
        device_ip: "192.168.1.100",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quality).toBe(2);
      }
    });

    it("rejects quality out of range", () => {
      expect(
        snapshotCaptureSchema.safeParse({
          device_ip: "192.168.1.100",
          quality: 3,
        }).success,
      ).toBe(false);
      expect(
        snapshotCaptureSchema.safeParse({
          device_ip: "192.168.1.100",
          quality: -1,
        }).success,
      ).toBe(false);
    });
  });

  describe("deviceLoginSchema", () => {
    it("accepts valid login credentials", () => {
      const result = deviceLoginSchema.safeParse({
        ip: "192.168.1.100",
        port: 8000,
        username: "admin",
        password: "password123",
        name: "DVR-Site1",
      });
      expect(result.success).toBe(true);
    });

    it("defaults port to 8000", () => {
      const result = deviceLoginSchema.safeParse({
        ip: "192.168.1.100",
        username: "admin",
        password: "pass",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(8000);
      }
    });

    it("rejects missing username", () => {
      const result = deviceLoginSchema.safeParse({
        ip: "192.168.1.100",
        password: "pass",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = deviceLoginSchema.safeParse({
        ip: "192.168.1.100",
        username: "admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bulkLoginSchema", () => {
    it("accepts array of credentials", () => {
      const result = bulkLoginSchema.safeParse([
        { ip: "192.168.1.100", username: "admin", password: "pass1" },
        { ip: "192.168.1.101", username: "admin", password: "pass2" },
      ]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("accepts empty array", () => {
      const result = bulkLoginSchema.safeParse([]);
      expect(result.success).toBe(true);
    });

    it("rejects non-array", () => {
      const result = bulkLoginSchema.safeParse({ ip: "192.168.1.100" });
      expect(result.success).toBe(false);
    });
  });

  describe("discoveryScanSchema", () => {
    it("accepts valid timeout", () => {
      const result = discoveryScanSchema.safeParse({ timeout: 15 });
      expect(result.success).toBe(true);
    });

    it("defaults timeout to 10", () => {
      const result = discoveryScanSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(10);
      }
    });

    it("rejects timeout out of range", () => {
      expect(discoveryScanSchema.safeParse({ timeout: 2 }).success).toBe(false);
      expect(discoveryScanSchema.safeParse({ timeout: 61 }).success).toBe(
        false,
      );
    });
  });
});
