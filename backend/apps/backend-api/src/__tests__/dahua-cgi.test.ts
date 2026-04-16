import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock config ────────────────────────────────────────────────
vi.mock("../config/env.js", () => ({
  config: { CREDENTIAL_ENCRYPTION_KEY: null },
}));

// ─── Mock db.execute for raw SQL queries ────────────────────────
const mockExecute = vi.fn();
vi.mock("../db/client.js", () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

// ─── Mock DahuaRPCClient ────────────────────────────────────────
const mockGet = vi.fn();
const mockGetBuffer = vi.fn();

vi.mock("@aion/device-adapters", () => {
  return {
    DahuaRPCClient: vi.fn(function (this: any) {
      this.get = mockGet;
      this.getBuffer = mockGetBuffer;
      this.getRaw = vi.fn();
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

import { DahuaCGIService } from "../services/dahua-cgi.js";

const MOCK_DEVICE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test XVR",
  ip_address: "192.168.1.108",
  port: 80,
  http_port: 80,
  username: "admin",
  password: "pass123",
  brand: "dahua",
  model: "XVR5108",
  site_id: "22222222-2222-2222-2222-222222222222",
  channels: 8,
  connection_type: "direct",
  serial_number: "AL02505PAJD40E7",
};

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

describe("DahuaCGIService", () => {
  let service: DahuaCGIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DahuaCGIService();
    mockExecute.mockResolvedValue([MOCK_DEVICE]);
  });

  describe("getDeviceInfo()", () => {
    it("should return device info when device is reachable", async () => {
      mockGet.mockResolvedValue({
        statusCode: 200,
        data: {
          deviceType: "XVR5108HS",
          serialNumber: "AL02505PAJD40E7",
          softwareVersion: "4.001.0000000.0",
          videoInputChannels: "8",
        },
        raw: "",
      });

      const info = await service.getDeviceInfo(MOCK_DEVICE.id, TENANT_ID);
      expect(info.online).toBe(true);
      expect(info.model).toBe("XVR5108HS");
      expect(info.serialNumber).toBe("AL02505PAJD40E7");
      expect(info.firmwareVersion).toBe("4.001.0000000.0");
      expect(info.channelCount).toBe(8);
    });

    it("should return offline when device is unreachable", async () => {
      mockGet.mockRejectedValue(new Error("Connection timeout"));

      const info = await service.getDeviceInfo(MOCK_DEVICE.id, TENANT_ID);
      expect(info.online).toBe(false);
    });

    it("should return offline when device not found in DB", async () => {
      mockExecute.mockResolvedValue([]);
      const info = await service.getDeviceInfo(MOCK_DEVICE.id, TENANT_ID);
      expect(info.online).toBe(false);
    });
  });

  describe("getChannels()", () => {
    it("should return channel list from device", async () => {
      mockGet
        .mockResolvedValueOnce({
          statusCode: 200,
          data: { MaxVideoInputChannels: "8" },
          raw: "",
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          data: {
            "table.ChannelTitle[0].Name": "Entrada",
            "table.ChannelTitle[1].Name": "Parqueadero",
          },
          raw: "",
        });

      const channels = await service.getChannels(MOCK_DEVICE.id, TENANT_ID);
      expect(channels).toHaveLength(8);
      expect(channels[0].name).toBe("Entrada");
      expect(channels[1].name).toBe("Parqueadero");
      expect(channels[2].name).toBe("Channel 3");
    });

    it("should return empty array on error", async () => {
      mockGet.mockRejectedValue(new Error("timeout"));
      const channels = await service.getChannels(MOCK_DEVICE.id, TENANT_ID);
      expect(channels).toEqual([]);
    });
  });

  describe("getSnapshot()", () => {
    it("should return JPEG buffer on success", async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockGetBuffer.mockResolvedValue({ statusCode: 200, buffer: jpegBuffer });

      const result = await service.getSnapshot(MOCK_DEVICE.id, TENANT_ID, 1);
      expect(result).toEqual(jpegBuffer);
    });

    it("should return null on non-200 response", async () => {
      mockGetBuffer.mockResolvedValue({
        statusCode: 404,
        buffer: Buffer.alloc(0),
      });
      const result = await service.getSnapshot(MOCK_DEVICE.id, TENANT_ID, 1);
      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockGetBuffer.mockRejectedValue(new Error("timeout"));
      const result = await service.getSnapshot(MOCK_DEVICE.id, TENANT_ID, 1);
      expect(result).toBeNull();
    });
  });

  describe("ptzMove()", () => {
    it("should send PTZ move command", async () => {
      mockGet.mockResolvedValue({ statusCode: 200, data: {}, raw: "OK" });
      const ok = await service.ptzMove(MOCK_DEVICE.id, TENANT_ID, 1, "left", 5);
      expect(ok).toBe(true);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining(
          "/cgi-bin/ptz.cgi?action=start&channel=1&code=Left",
        ),
      );
    });

    it("should return false on unknown direction", async () => {
      const ok = await service.ptzMove(
        MOCK_DEVICE.id,
        TENANT_ID,
        1,
        "diagonal",
      );
      expect(ok).toBe(false);
    });

    it("should return false on error", async () => {
      mockGet.mockRejectedValue(new Error("timeout"));
      const ok = await service.ptzMove(MOCK_DEVICE.id, TENANT_ID, 1, "up");
      expect(ok).toBe(false);
    });
  });

  describe("ptzStop()", () => {
    it("should send PTZ stop command", async () => {
      mockGet.mockResolvedValue({ statusCode: 200, data: {}, raw: "OK" });
      const ok = await service.ptzStop(MOCK_DEVICE.id, TENANT_ID, 1);
      expect(ok).toBe(true);
    });
  });

  describe("ptzPreset()", () => {
    it("should send goto preset command", async () => {
      mockGet.mockResolvedValue({ statusCode: 200, data: {}, raw: "OK" });
      const ok = await service.ptzPreset(MOCK_DEVICE.id, TENANT_ID, 1, 3);
      expect(ok).toBe(true);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("code=GotoPreset&arg1=0&arg2=3"),
      );
    });
  });

  describe("getStreamUrl()", () => {
    it("should return RTSP URL for direct connection", async () => {
      const url = await service.getStreamUrl(
        MOCK_DEVICE.id,
        TENANT_ID,
        1,
        true,
      );
      expect(url).not.toBeNull();
      expect(url).toContain("rtsp://admin:pass123@192.168.1.108");
      expect(url).toContain("channel=1&subtype=1");
    });

    it("should return dvrip URL for REGISTRO connection with 0-indexed channel", async () => {
      mockExecute.mockResolvedValue([
        { ...MOCK_DEVICE, connection_type: "registro" },
      ]);
      const url = await service.getStreamUrl(
        MOCK_DEVICE.id,
        TENANT_ID,
        1,
        true,
      );
      expect(url).not.toBeNull();
      expect(url!).toContain("dvrip://");
      expect(url!).toContain(MOCK_DEVICE.serial_number);
      expect(url!).toContain("channel=0");
    });

    it("should return null for REGISTRO device without serial", async () => {
      mockExecute.mockResolvedValue([
        { ...MOCK_DEVICE, connection_type: "registro", serial_number: null },
      ]);
      const url = await service.getStreamUrl(
        MOCK_DEVICE.id,
        TENANT_ID,
        1,
        true,
      );
      expect(url).toBeNull();
    });
  });

  describe("reboot()", () => {
    it("should reboot device successfully", async () => {
      mockGet.mockResolvedValue({ statusCode: 200, data: {}, raw: "OK" });
      const ok = await service.reboot(MOCK_DEVICE.id, TENANT_ID);
      expect(ok).toBe(true);
    });

    it("should return false on failure", async () => {
      mockGet.mockRejectedValue(new Error("timeout"));
      const ok = await service.reboot(MOCK_DEVICE.id, TENANT_ID);
      expect(ok).toBe(false);
    });
  });

  describe("testAllDevices()", () => {
    it("should return status for all Dahua devices", async () => {
      // First call: list devices; subsequent calls: getClient per device
      mockExecute
        .mockResolvedValueOnce([
          { id: "dev-1", name: "XVR Alborada" },
          { id: "dev-2", name: "XVR Brescia" },
        ])
        .mockResolvedValue([MOCK_DEVICE]);

      mockGet.mockResolvedValue({
        statusCode: 200,
        data: {
          deviceType: "XVR5108HS",
          serialNumber: "AL02505PAJD40E7",
          softwareVersion: "4.0",
        },
        raw: "",
      });

      const results = await service.testAllDevices(TENANT_ID);
      expect(results).toHaveLength(2);
      expect(results[0].online).toBe(true);
    });
  });
});
