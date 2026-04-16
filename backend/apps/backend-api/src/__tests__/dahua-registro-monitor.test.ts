import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock config ────────────────────────────────────────────────
vi.mock("../config/env.js", () => ({
  config: { CREDENTIAL_ENCRYPTION_KEY: null },
}));

// ─── Mock db ────────────────────────────────────────────────────
const mockExecute = vi.fn();
vi.mock("../db/client.js", () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

// ─── Mock go2rtcManager ─────────────────────────────────────────
const mockAddStream = vi.fn().mockResolvedValue(true);
vi.mock("../services/go2rtc-manager.js", () => ({
  go2rtcManager: { addStream: (...args: any[]) => mockAddStream(...args) },
}));

// ─── Mock fetch ─────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock logger ────────────────────────────────────────────────
vi.mock("@aion/common-utils", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { DahuaRegistroMonitor } from "../services/dahua-registro-monitor.js";

const MOCK_DEVICES = [
  {
    id: "dev-1",
    name: "alborada",
    serial_number: "AL02505PAJD40E7",
    channels: 8,
    username: "admin",
    password: "pass",
    site_id: "site-1",
    connection_type: "registro",
  },
  {
    id: "dev-2",
    name: "brescia",
    serial_number: "AK01E46PAZ0BA9C",
    channels: 8,
    username: "admin",
    password: "pass",
    site_id: "site-2",
    connection_type: "registro",
  },
];

describe("DahuaRegistroMonitor", () => {
  let monitor: DahuaRegistroMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DAHUA_MODE", "registro");
    monitor = new DahuaRegistroMonitor();
  });

  afterEach(() => {
    monitor.stop();
    vi.unstubAllEnvs();
  });

  describe("isEnabled()", () => {
    it("should be enabled when DAHUA_MODE is registro", () => {
      expect(monitor.isEnabled()).toBe(true);
    });

    it("should be enabled when DAHUA_MODE is hybrid", () => {
      vi.stubEnv("DAHUA_MODE", "hybrid");
      const m = new DahuaRegistroMonitor();
      expect(m.isEnabled()).toBe(true);
    });
  });

  describe("getStatus()", () => {
    it("should return initial status", () => {
      const status = monitor.getStatus();
      expect(status.running).toBe(false);
      expect(status.enabled).toBe(true);
      expect(status.connectedDevices).toBe(0);
      expect(status.cycleCount).toBe(0);
      expect(status.lastPollAt).toBeNull();
      expect(status.lastResult).toBeNull();
      expect(status.devices).toEqual([]);
    });
  });

  describe("pollRegistroDevices()", () => {
    it("should detect connected devices from go2rtc dvrip streams", async () => {
      // go2rtc returns streams with dvrip producers
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-alborada-ch1": {
            producers: [
              { url: "dvrip://admin:pass@AL02505PAJD40E7?channel=0&subtype=1" },
            ],
          },
        }),
      });

      // DB returns devices
      mockExecute
        .mockResolvedValueOnce(MOCK_DEVICES) // loadDahuaDevices
        .mockResolvedValue([]); // updateDeviceStatus

      const result = await monitor.pollRegistroDevices();
      expect(result.total).toBe(2);
      expect(result.connected).toBe(1); // Only alborada has a dvrip stream
      expect(result.streams).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
    });

    it("should detect devices by stream name prefix (da-{name}-ch)", async () => {
      // go2rtc returns da-brescia-ch1 with any producer
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-brescia-ch1": { producers: [{ url: "rtsp://any" }] },
          "da-brescia-ch2": { producers: [{ url: "rtsp://any" }] },
        }),
      });

      mockExecute.mockResolvedValueOnce(MOCK_DEVICES).mockResolvedValue([]);

      const result = await monitor.pollRegistroDevices();
      expect(result.connected).toBe(1); // brescia detected by prefix match
    });

    it("should mark disconnected devices when go2rtc has no streams", async () => {
      // First poll: device connected
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-alborada-ch1": {
            producers: [{ url: "dvrip://admin:pass@AL02505PAJD40E7" }],
          },
        }),
      });
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await monitor.pollRegistroDevices();

      // Second poll: no streams
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      const result = await monitor.pollRegistroDevices();

      expect(result.connected).toBe(0);
    });

    it("should handle go2rtc API failure gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));
      mockExecute.mockResolvedValue(MOCK_DEVICES);

      const result = await monitor.pollRegistroDevices();
      expect(result.connected).toBe(0);
      expect(result.errors).toBe(0); // No per-device errors, just no connections
    });

    it("should register all channels for connected devices", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-alborada-ch1": {
            producers: [{ url: "dvrip://admin:pass@AL02505PAJD40E7" }],
          },
        }),
      });
      mockExecute.mockResolvedValue(MOCK_DEVICES);

      await monitor.pollRegistroDevices();

      // Should register 8 channels for alborada
      expect(mockAddStream).toHaveBeenCalledTimes(8);
      expect(mockAddStream).toHaveBeenCalledWith(
        "da-alborada-ch1",
        expect.stringContaining("dvrip://admin:pass@AL02505PAJD40E7"),
      );
    });

    it("should clean connectedDevices of entries removed from DB", async () => {
      // First poll: alborada connected
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-alborada-ch1": {
            producers: [{ url: "dvrip://admin:pass@AL02505PAJD40E7" }],
          },
        }),
      });
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await monitor.pollRegistroDevices();
      expect(monitor.getStatus().connectedDevices).toBe(1);

      // Second poll: alborada removed from DB
      mockExecute.mockResolvedValue([MOCK_DEVICES[1]]);
      await monitor.pollRegistroDevices();

      // Alborada should be cleaned from connectedDevices
      const status = monitor.getStatus();
      expect(
        status.devices.find((d) => d.serial === "AL02505PAJD40E7"),
      ).toBeUndefined();
    });
  });

  describe("stop()", () => {
    it("should clear all state on stop", async () => {
      // Simulate some state
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "da-alborada-ch1": {
            producers: [{ url: "dvrip://admin:pass@AL02505PAJD40E7" }],
          },
        }),
      });
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await monitor.pollRegistroDevices();

      monitor.stop();
      const status = monitor.getStatus();
      expect(status.running).toBe(false);
      expect(status.connectedDevices).toBe(0);
      expect(status.devices).toEqual([]);
    });
  });
});
