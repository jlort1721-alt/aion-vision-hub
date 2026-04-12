import { describe, it, expect } from "vitest";
import {
  deviceFilterSchema,
  approveDeviceSchema,
  startStreamSchema,
  ptzSchema,
  eventFilterSchema,
} from "../modules/reverse/schemas.js";

describe("Reverse Module — Zod Schemas", () => {
  describe("deviceFilterSchema", () => {
    it("accepts empty filter", () => {
      const result = deviceFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts vendor filter", () => {
      const result = deviceFilterSchema.safeParse({ vendor: "hikvision" });
      expect(result.success).toBe(true);
    });

    it("accepts dahua vendor", () => {
      const result = deviceFilterSchema.safeParse({ vendor: "dahua" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid vendor", () => {
      const result = deviceFilterSchema.safeParse({ vendor: "samsung" });
      expect(result.success).toBe(false);
    });

    it("accepts status + site_id", () => {
      const result = deviceFilterSchema.safeParse({
        status: "online",
        site_id: "a0000000-0000-4000-8000-000000000001",
      });
      expect(result.success).toBe(true);
    });

    it("defaults limit to 50 and offset to 0", () => {
      const result = deviceFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("accepts custom limit and offset", () => {
      const result = deviceFilterSchema.safeParse({ limit: 100, offset: 50 });
      expect(result.success).toBe(true);
    });
  });

  describe("approveDeviceSchema", () => {
    it("accepts empty body", () => {
      const result = approveDeviceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts display_name", () => {
      const result = approveDeviceSchema.safeParse({
        display_name: "Torre Lucia DVR",
      });
      expect(result.success).toBe(true);
    });

    it("accepts full input with credentials", () => {
      const result = approveDeviceSchema.safeParse({
        display_name: "NVR San Nicolas",
        site_id: "a0000000-0000-4000-8000-000000000001",
        channel_count: 16,
        username: "admin",
        password: "Secure123!",
        isup_key: "abc123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts channel_count up to 256", () => {
      const result = approveDeviceSchema.safeParse({ channel_count: 256 });
      expect(result.success).toBe(true);
    });

    it("rejects channel_count > 256", () => {
      const result = approveDeviceSchema.safeParse({ channel_count: 300 });
      expect(result.success).toBe(false);
    });

    it("rejects channel_count < 1", () => {
      const result = approveDeviceSchema.safeParse({ channel_count: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe("startStreamSchema", () => {
    it("accepts valid channel", () => {
      const result = startStreamSchema.safeParse({ channel: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts channel 256", () => {
      const result = startStreamSchema.safeParse({ channel: 256 });
      expect(result.success).toBe(true);
    });

    it("rejects channel 0", () => {
      const result = startStreamSchema.safeParse({ channel: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects missing channel", () => {
      const result = startStreamSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects channel > 256", () => {
      const result = startStreamSchema.safeParse({ channel: 257 });
      expect(result.success).toBe(false);
    });

    it("defaults format to webrtc", () => {
      const result = startStreamSchema.safeParse({ channel: 1 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe("webrtc");
      }
    });

    it("accepts hls format", () => {
      const result = startStreamSchema.safeParse({
        channel: 1,
        format: "hls",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ptzSchema", () => {
    it("accepts valid PTZ command", () => {
      const result = ptzSchema.safeParse({ action: "tilt_up", speed: 4 });
      expect(result.success).toBe(true);
    });

    it("accepts pan_left action", () => {
      const result = ptzSchema.safeParse({ action: "pan_left" });
      expect(result.success).toBe(true);
    });

    it("accepts goto_preset with preset", () => {
      const result = ptzSchema.safeParse({
        action: "goto_preset",
        speed: 5,
        preset: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects old action names", () => {
      const result = ptzSchema.safeParse({ action: "up" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid action", () => {
      const result = ptzSchema.safeParse({ action: "fly" });
      expect(result.success).toBe(false);
    });

    it("defaults speed to 4 and channel to 1", () => {
      const result = ptzSchema.safeParse({ action: "stop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.speed).toBe(4);
        expect(result.data.channel).toBe(1);
      }
    });

    it("accepts speed up to 8", () => {
      const result = ptzSchema.safeParse({ action: "zoom_in", speed: 8 });
      expect(result.success).toBe(true);
    });

    it("rejects speed > 8", () => {
      const result = ptzSchema.safeParse({ action: "tilt_up", speed: 10 });
      expect(result.success).toBe(false);
    });

    it("accepts iris_open and iris_close", () => {
      expect(ptzSchema.safeParse({ action: "iris_open" }).success).toBe(true);
      expect(ptzSchema.safeParse({ action: "iris_close" }).success).toBe(true);
    });
  });

  describe("eventFilterSchema", () => {
    it("accepts empty filter", () => {
      const result = eventFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("defaults limit to 50", () => {
      const result = eventFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it("accepts full filter", () => {
      const result = eventFilterSchema.safeParse({
        kind: "motion",
        from: "2026-04-12T00:00:00Z",
        to: "2026-04-12T23:59:59Z",
        device_id: "a0000000-0000-4000-8000-000000000001",
        limit: 100,
      });
      expect(result.success).toBe(true);
    });

    it("accepts limit up to 1000", () => {
      const result = eventFilterSchema.safeParse({ limit: 1000 });
      expect(result.success).toBe(true);
    });

    it("rejects limit > 1000", () => {
      const result = eventFilterSchema.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });
  });
});
