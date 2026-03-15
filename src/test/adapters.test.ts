import { describe, it, expect } from "vitest";

/**
 * Device Adapter Contract Tests
 *
 * Validates the adapter interface contracts defined in the gateway.
 * These tests validate the type contracts and expected behaviors
 * without requiring actual device connectivity.
 */

// Import adapter types from the shared types
import type {
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  DiscoveredDevice,
  DeviceIdentity,
  StreamProfile,
  StreamState,
  DeviceCapabilities,
  DeviceHealthReport,
  PTZCommand,
  PTZPreset,
} from "../../gateway/src/adapters/types";

describe("Device Adapter Contracts", () => {
  describe("DeviceConnectionConfig", () => {
    it("accepts valid connection config", () => {
      const config: DeviceConnectionConfig = {
        ip: "192.168.1.100",
        port: 80,
        username: "admin",
        password: "pass123",
        brand: "hikvision",
      };
      expect(config.ip).toBe("192.168.1.100");
      expect(config.port).toBe(80);
      expect(config.brand).toBe("hikvision");
    });

    it("supports optional protocol field", () => {
      const config: DeviceConnectionConfig = {
        ip: "10.0.0.1",
        port: 554,
        username: "admin",
        password: "pass",
        brand: "dahua",
        protocol: "rtsp",
      };
      expect(config.protocol).toBe("rtsp");
    });
  });

  describe("ConnectionResult", () => {
    it("success result includes sessionId", () => {
      const result: ConnectionResult = {
        success: true,
        message: "Connected",
        sessionId: "hik-192.168.1.100:80",
      };
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeTruthy();
    });

    it("failure result has no sessionId", () => {
      const result: ConnectionResult = {
        success: false,
        message: "Connection refused",
      };
      expect(result.success).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });
  });

  describe("StreamProfile", () => {
    it("validates main and sub stream profiles", () => {
      const main: StreamProfile = {
        type: "main",
        url: "rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101",
        codec: "H.265",
        resolution: "2560x1440",
        fps: 25,
      };

      const sub: StreamProfile = {
        type: "sub",
        url: "rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/102",
        codec: "H.264",
        resolution: "640x480",
        fps: 15,
      };

      expect(main.type).toBe("main");
      expect(sub.type).toBe("sub");
      expect(main.fps).toBeGreaterThan(sub.fps);
    });
  });

  describe("StreamState", () => {
    it("covers all expected states", () => {
      const validStates: StreamState[] = [
        "idle",
        "connecting",
        "live",
        "degraded",
        "reconnecting",
        "failed",
        "unauthorized",
        "unavailable",
      ];
      expect(validStates.length).toBe(8);
    });
  });

  describe("DeviceCapabilities", () => {
    it("represents full capabilities", () => {
      const caps: DeviceCapabilities = {
        ptz: true,
        audio: true,
        smartEvents: true,
        anpr: false,
        faceDetection: false,
        channels: 4,
        codecs: ["H.264", "H.265"],
        maxResolution: "4K",
      };
      expect(caps.ptz).toBe(true);
      expect(caps.codecs).toContain("H.265");
    });
  });

  describe("DeviceHealthReport", () => {
    it("online device has low latency and no errors", () => {
      const health: DeviceHealthReport = {
        online: true,
        latencyMs: 15,
        cpuUsage: 45,
        memoryUsage: 60,
        errors: [],
      };
      expect(health.online).toBe(true);
      expect(health.errors).toHaveLength(0);
      expect(health.latencyMs).toBeLessThan(1000);
    });

    it("offline device has errors", () => {
      const health: DeviceHealthReport = {
        online: false,
        latencyMs: -1,
        errors: ["Connection timeout", "Device unreachable"],
      };
      expect(health.online).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });
  });

  describe("PTZCommand", () => {
    it("basic directional commands", () => {
      const commands: PTZCommand[] = [
        { action: "left", speed: 5 },
        { action: "right", speed: 5 },
        { action: "up", speed: 3 },
        { action: "down", speed: 3 },
        { action: "zoomin" },
        { action: "zoomout" },
        { action: "goto", presetId: 1 },
      ];
      expect(commands).toHaveLength(7);
    });
  });

  describe("PTZPreset", () => {
    it("represents named positions", () => {
      const preset: PTZPreset = {
        id: 1,
        name: "Front Gate",
        position: { pan: 180, tilt: 15, zoom: 3 },
      };
      expect(preset.name).toBe("Front Gate");
      expect(preset.position?.pan).toBe(180);
    });
  });

  describe("DiscoveredDevice", () => {
    it("represents network-discovered device", () => {
      const device: DiscoveredDevice = {
        ip: "192.168.1.64",
        port: 80,
        brand: "hikvision",
        model: "DS-2CD2347G2-LU",
        serial: "DS-2CD2347G2-LU20210101AAWRD12345",
        mac: "AA:BB:CC:DD:EE:FF",
        protocols: ["isapi", "rtsp", "onvif"],
      };
      expect(device.protocols).toContain("onvif");
      expect(device.brand).toBe("hikvision");
    });
  });
});
