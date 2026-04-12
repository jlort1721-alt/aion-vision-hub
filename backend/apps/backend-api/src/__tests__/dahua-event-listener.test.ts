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

// ─── Mock DahuaRPCClient ────────────────────────────────────────
const mockGet = vi.fn();

vi.mock("@aion/device-adapters", () => {
  return {
    DahuaRPCClient: vi.fn(function (this: any) {
      this.get = mockGet;
    }),
  };
});

// ─── Mock logger ────────────────────────────────────────────────
vi.mock("@aion/common-utils", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { DahuaEventService } from "../services/dahua-event-listener.js";

// Access the non-exported class through the module
// The module exports `dahuaEvents` singleton, but we need a fresh instance per test
// So we import the service and create our own
const MOCK_DEVICES = [
  {
    id: "dev-1",
    name: "XVR Alborada",
    ip_address: "192.168.1.108",
    port: 80,
    http_port: 80,
    username: "admin",
    password: "pass",
    site_id: "site-1",
    connection_type: "direct",
  },
];

const TENANT = "00000000-0000-0000-0000-000000000001";

describe("DahuaEventService", () => {
  let service: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh instance by reimporting
    service = new (DahuaEventService as any)();
  });

  afterEach(() => {
    service.stopPolling();
  });

  describe("startPolling()", () => {
    it("should start polling and discover devices", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      const onEvent = vi.fn();

      await service.startPolling(TENANT, onEvent);

      expect(service.getStatus().running).toBe(true);
      expect(service.getStatus().deviceCount).toBe(1);
      expect(service.getStatus().devices).toContain("XVR Alborada");
    });

    it("should work without tenantId (all tenants mode)", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);

      await service.start();

      expect(service.getStatus().running).toBe(true);
      expect(service.getStatus().deviceCount).toBe(1);
    });
  });

  describe("stopPolling()", () => {
    it("should stop all polling and clear state", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await service.startPolling(TENANT, vi.fn());

      service.stopPolling();

      expect(service.getStatus().running).toBe(false);
      expect(service.getStatus().deviceCount).toBe(0);
      expect(service.getStatus().devices).toEqual([]);
    });

    it("should clear eventIndexes on stop", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await service.startPolling(TENANT, vi.fn());

      // Simulate event indexes being populated
      service.eventIndexes.set("test-key", 5);
      expect(service.eventIndexes.size).toBe(1);

      service.stopPolling();
      expect(service.eventIndexes.size).toBe(0);
    });
  });

  describe("getStatus()", () => {
    it("should return initial status", () => {
      const status = service.getStatus();
      expect(status).toEqual({
        running: false,
        deviceCount: 0,
        devices: [],
      });
    });
  });

  describe("event normalization", () => {
    it("should start and detect new events via polling", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      const onEvent = vi.fn();

      await service.startPolling(TENANT, onEvent);

      // First poll: baseline indexes (no events emitted)
      mockGet.mockResolvedValueOnce({
        statusCode: 200,
        data: {
          "channels[0].EventIndexes.VideoMotion": "5",
          "channels[0].EventIndexes.CrossLineDetection": "2",
        },
        raw: "",
      });

      // Manually trigger a poll
      const pollStates = service.pollStates;
      const state = pollStates.get("dev-1");
      if (state) {
        // Simulate internal fetchEvents
        const events = await (service as any).fetchEvents(state);
        // First poll should NOT emit events (just baselines)
        expect(events).toHaveLength(0);
      }

      // Second poll: indexes increased → events emitted
      mockGet.mockResolvedValueOnce({
        statusCode: 200,
        data: {
          "channels[0].EventIndexes.VideoMotion": "7",
          "channels[0].EventIndexes.CrossLineDetection": "3",
        },
        raw: "",
      });

      if (state) {
        const events = await (service as any).fetchEvents(state);
        expect(events).toHaveLength(2);
        expect(events[0].eventType).toBe("motion");
        expect(events[1].eventType).toBe("line_crossing");
        expect(events[0].channelId).toBe(1); // 0-indexed channel → 1-indexed output
      }
    });
  });

  describe("device discovery", () => {
    it("should remove polling for devices no longer in DB", async () => {
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await service.startPolling(TENANT, vi.fn());
      expect(service.getStatus().deviceCount).toBe(1);

      // Next discovery: no devices
      mockExecute.mockResolvedValue([]);
      await (service as any).discoverDevices();
      expect(service.getStatus().deviceCount).toBe(0);
    });

    it("should add new devices found in DB", async () => {
      mockExecute.mockResolvedValue([]);
      await service.startPolling(TENANT, vi.fn());
      expect(service.getStatus().deviceCount).toBe(0);

      // Next discovery: device appears
      mockExecute.mockResolvedValue(MOCK_DEVICES);
      await (service as any).discoverDevices();
      expect(service.getStatus().deviceCount).toBe(1);
    });
  });
});
