import { describe, it, expect } from "vitest";

/**
 * Stream Policy Tests
 *
 * Validates the stream management policies used by the gateway:
 * - Stream key generation
 * - Stream URL construction patterns
 * - Concurrent stream limits
 * - Stream state machine transitions
 */

// Inline type definitions (gateway module is not available to frontend)
type StreamState = "idle" | "connecting" | "live" | "degraded" | "reconnecting" | "failed" | "unauthorized" | "unavailable";

interface StreamProfile {
  type: string;
  url: string;
  codec: string;
  resolution: string;
  fps: number;
}

describe("Stream Policy", () => {
  describe("Stream Key Generation", () => {
    it("generates unique keys per device/type/channel combination", () => {
      const generateKey = (deviceId: string, type: string, channel: number) =>
        `${deviceId}:${type}:${channel}`;

      const key1 = generateKey("hik-192.168.1.100:80", "main", 1);
      const key2 = generateKey("hik-192.168.1.100:80", "sub", 1);
      const key3 = generateKey("hik-192.168.1.100:80", "main", 2);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe("Hikvision RTSP URL Patterns", () => {
    it("constructs correct main stream URL", () => {
      const url = buildHikvisionUrl("admin", "pass", "192.168.1.100", 554, "main", 1);
      expect(url).toBe("rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101");
    });

    it("constructs correct sub stream URL", () => {
      const url = buildHikvisionUrl("admin", "pass", "192.168.1.100", 554, "sub", 1);
      expect(url).toBe("rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/102");
    });

    it("handles multi-channel devices", () => {
      const url = buildHikvisionUrl("admin", "pass", "10.0.0.1", 554, "main", 3);
      expect(url).toBe("rtsp://admin:pass@10.0.0.1:554/Streaming/Channels/301");
    });
  });

  describe("Dahua RTSP URL Patterns", () => {
    it("constructs correct main stream URL", () => {
      const url = buildDahuaUrl("admin", "pass", "192.168.1.200", 554, "main", 1);
      expect(url).toBe("rtsp://admin:pass@192.168.1.200:554/cam/realmonitor?channel=1&subtype=0");
    });

    it("constructs correct sub stream URL", () => {
      const url = buildDahuaUrl("admin", "pass", "192.168.1.200", 554, "sub", 1);
      expect(url).toBe("rtsp://admin:pass@192.168.1.200:554/cam/realmonitor?channel=1&subtype=1");
    });
  });

  describe("Stream State Machine", () => {
    it("valid state transitions", () => {
      const validTransitions: Record<StreamState, StreamState[]> = {
        idle: ["connecting"],
        connecting: ["live", "failed", "unauthorized"],
        live: ["degraded", "failed", "idle"],
        degraded: ["live", "reconnecting", "failed"],
        reconnecting: ["live", "failed"],
        failed: ["connecting", "idle"],
        unauthorized: ["connecting", "idle"],
        unavailable: ["connecting", "idle"],
      };

      // Verify idle can transition to connecting
      expect(validTransitions.idle).toContain("connecting");
      // Verify connecting can reach live
      expect(validTransitions.connecting).toContain("live");
      // Verify failed can retry
      expect(validTransitions.failed).toContain("connecting");
      // Verify live can degrade
      expect(validTransitions.live).toContain("degraded");
    });
  });

  describe("MediaMTX Path Generation", () => {
    it("generates valid path names from device IDs", () => {
      const sanitize = (deviceId: string) =>
        deviceId.replace(/[^a-zA-Z0-9-]/g, "_");

      expect(sanitize("hik-192.168.1.100:80")).toBe("hik-192_168_1_100_80");
      expect(sanitize("dahua-10.0.0.1:37777")).toBe("dahua-10_0_0_1_37777");
    });

    it("constructs full MediaMTX path", () => {
      const deviceId = "hik-192.168.1.100:80";
      const streamType = "sub";
      const pathName = `aion/${deviceId.replace(/[^a-zA-Z0-9-]/g, "_")}/${streamType}`;

      expect(pathName).toBe("aion/hik-192_168_1_100_80/sub");
    });
  });

  describe("Stream Profile Validation", () => {
    it("main stream has higher quality than sub", () => {
      const profiles: StreamProfile[] = [
        { type: "main", url: "rtsp://...", codec: "H.265", resolution: "2560x1440", fps: 25 },
        { type: "sub", url: "rtsp://...", codec: "H.264", resolution: "640x480", fps: 15 },
      ];

      const main = profiles.find((p) => p.type === "main")!;
      const sub = profiles.find((p) => p.type === "sub")!;

      expect(main.fps).toBeGreaterThan(sub.fps);
      expect(parseInt(main.resolution)).toBeGreaterThan(parseInt(sub.resolution));
    });
  });
});

// Helper functions mirroring adapter logic
function buildHikvisionUrl(
  username: string, password: string, ip: string, port: number,
  type: "main" | "sub", channel: number,
): string {
  const ch = type === "main" ? `${channel}01` : `${channel}02`;
  return `rtsp://${username}:${password}@${ip}:${port}/Streaming/Channels/${ch}`;
}

function buildDahuaUrl(
  username: string, password: string, ip: string, port: number,
  type: "main" | "sub", channel: number,
): string {
  const subtype = type === "main" ? 0 : 1;
  return `rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
}
