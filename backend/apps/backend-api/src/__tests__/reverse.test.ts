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

    it("accepts full input", () => {
      const result = approveDeviceSchema.safeParse({
        display_name: "NVR San Nicolas",
        site_id: "a0000000-0000-4000-8000-000000000001",
        channel_count: 16,
      });
      expect(result.success).toBe(true);
    });

    it("rejects channel_count > 64", () => {
      const result = approveDeviceSchema.safeParse({ channel_count: 128 });
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

    it("accepts channel 0", () => {
      const result = startStreamSchema.safeParse({ channel: 0 });
      expect(result.success).toBe(true);
    });

    it("rejects missing channel", () => {
      const result = startStreamSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects channel > 64", () => {
      const result = startStreamSchema.safeParse({ channel: 65 });
      expect(result.success).toBe(false);
    });
  });

  describe("ptzSchema", () => {
    it("accepts valid PTZ command", () => {
      const result = ptzSchema.safeParse({ action: "up", speed: 4 });
      expect(result.success).toBe(true);
    });

    it("accepts preset_goto with preset", () => {
      const result = ptzSchema.safeParse({
        action: "preset_goto",
        speed: 5,
        preset: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid action", () => {
      const result = ptzSchema.safeParse({ action: "fly" });
      expect(result.success).toBe(false);
    });

    it("defaults speed to 4", () => {
      const result = ptzSchema.safeParse({ action: "stop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.speed).toBe(4);
      }
    });

    it("rejects speed > 7", () => {
      const result = ptzSchema.safeParse({ action: "up", speed: 10 });
      expect(result.success).toBe(false);
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

    it("rejects limit > 500", () => {
      const result = eventFilterSchema.safeParse({ limit: 1000 });
      expect(result.success).toBe(false);
    });
  });
});
