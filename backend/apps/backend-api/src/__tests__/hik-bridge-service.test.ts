import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

vi.mock("../lib/http-client.js", () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetch(...args),
}));

// Import AFTER mock is set up
import * as hikBridge from "../modules/hik-bridge/service.js";

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers({ "content-type": "application/json" }),
  };
}

describe("Hik-Bridge Service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getHealth returns bridge status", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: { status: "ok", sdk_initialized: true, connected_devices: 5 },
      }),
    );

    const result = await hikBridge.getHealth();
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain("/health");
  });

  it("listDevices returns connected devices", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: [
          { ip: "192.168.1.100", online: true },
          { ip: "192.168.1.101", online: false },
        ],
      }),
    );

    const result = await hikBridge.listDevices();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("loginDevice sends credentials via POST", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: { serial_number: "DS-7608NI", login_id: 1 },
      }),
    );

    const result = await hikBridge.loginDevice({
      ip: "192.168.1.100",
      port: 8000,
      username: "admin",
      password: "pass123",
    });

    expect(result.success).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/devices/login");
    expect(opts.method).toBe("POST");
    expect(opts.body).toContain("192.168.1.100");
  });

  it("ptzMove sends direction command", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: { action: "move", success: true },
      }),
    );

    const result = await hikBridge.ptzMove({
      device_ip: "192.168.1.100",
      channel: 1,
      direction: "left",
      speed: 5,
    });

    expect(result.success).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/ptz/move");
  });

  it("searchRecordings uses 30s timeout", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: [{ filename: "ch01.mp4", file_size: 1024 }],
      }),
    );

    await hikBridge.searchRecordings({
      device_ip: "192.168.1.100",
      channel: 1,
      start_time: "2026-01-15T00:00:00Z",
      end_time: "2026-01-15T23:59:59Z",
    });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.timeout).toBe(30_000);
  });

  it("handles bridge connection failure gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await hikBridge.getHealth();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Bridge unavailable");
  });

  it("handles timeout gracefully", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await hikBridge.getHealth();
    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("handles non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ error: "Device not found" }, 404),
    );

    const result = await hikBridge.getDeviceInfo("192.168.1.200");
    expect(result.success).toBe(false);
  });

  it("subscribeAlarms calls POST on correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: { subscribed: true } }),
    );

    const result = await hikBridge.subscribeAlarms("192.168.1.100");
    expect(result.success).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/alarms/subscribe/192.168.1.100");
    expect(opts.method).toBe("POST");
  });

  it("unsubscribeAlarms uses DELETE method", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true }));

    await hikBridge.unsubscribeAlarms("192.168.1.100");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/alarms/unsubscribe/192.168.1.100");
    expect(opts.method).toBe("DELETE");
  });

  it("scanNetwork adjusts timeout based on scan duration", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: [] }),
    );

    await hikBridge.scanNetwork(20);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("timeout=20");
    expect(opts.timeout).toBe(25_000);
  });

  it("captureSnapshot sends correct params", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        success: true,
        data: { filename: "test.jpg", size: 1024 },
      }),
    );

    await hikBridge.captureSnapshot({
      device_ip: "192.168.1.100",
      channel: 2,
    });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/snapshots/capture");
    expect(opts.method).toBe("POST");
    expect(opts.body).toContain('"channel":2');
  });

  it("logoutDevice uses DELETE method", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true }));

    await hikBridge.logoutDevice("192.168.1.100");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/devices/192.168.1.100/logout");
    expect(opts.method).toBe("DELETE");
  });

  it("getRecentAlarms passes count param", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: [] }),
    );

    await hikBridge.getRecentAlarms(50);
    expect(mockFetch.mock.calls[0][0]).toContain("count=50");
  });
});
