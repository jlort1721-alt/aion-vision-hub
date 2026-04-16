import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

// ── Hoist mock data so vi.mock factories can reference it ────
const { mockDevice } = vi.hoisted(() => ({
  mockDevice: {
    id: "dev-001",
    tenantId: "tenant-456",
    name: "Relay Principal",
    type: "relay",
    brand: "Sonoff",
    model: "BASIC R3",
    status: "online",
    state: "off",
    sectionId: null,
    config: {},
    lastAction: null,
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}));

// ── Mock dependencies ─────────────────────────────────────────
vi.mock("../../../plugins/auth.js", () => ({
  requireRole: vi.fn().mockImplementation(() => async () => {}),
}));

vi.mock("../service.js", () => ({
  domoticService: {
    list: vi.fn().mockResolvedValue([mockDevice]),
    getById: vi.fn().mockResolvedValue(mockDevice),
    create: vi.fn().mockResolvedValue(mockDevice),
    update: vi.fn().mockResolvedValue({ ...mockDevice, name: "Updated Relay" }),
    delete: vi.fn().mockResolvedValue(undefined),
    executeAction: vi.fn().mockResolvedValue({
      device: { ...mockDevice, state: "on" },
      action: { id: "act-1", action: "toggle", result: "on" },
    }),
    getActions: vi
      .fn()
      .mockResolvedValue([
        { id: "act-1", action: "toggle", result: "on", createdAt: new Date() },
      ]),
  },
}));

vi.mock("@aion/shared-contracts", () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
  ErrorCodes: {},
}));

vi.mock("@aion/common-utils", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerDomoticRoutes } from "../routes.js";

describe("Domotics Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ZodError) {
        reply.code(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request data" },
        });
        return;
      }
      reply
        .code(500)
        .send({ success: false, error: { message: (error as Error).message } });
    });

    app.decorateRequest("tenantId", "tenant-456");
    app.decorateRequest("userId", "user-123");
    app.decorateRequest("audit", null as any);
    app.addHook("preHandler", async (request) => {
      (request as any).tenantId = "tenant-456";
      (request as any).userId = "user-123";
      (request as any).audit = vi.fn().mockResolvedValue(undefined);
    });

    await app.register(registerDomoticRoutes, { prefix: "/domotics" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /domotics ────────────────────────────────────────────
  describe("GET /domotics", () => {
    it("returns 200 with device list", async () => {
      const res = await app.inject({ method: "GET", url: "/domotics" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("success", true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("wraps response in success envelope", async () => {
      const res = await app.inject({ method: "GET", url: "/domotics" });
      const body = res.json();
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });
  });

  // ── GET /domotics/:id ────────────────────────────────────────
  describe("GET /domotics/:id", () => {
    it("returns 200 with device details", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/domotics/00000000-0000-4000-a000-000000000001",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveProperty("name", "Relay Principal");
    });
  });

  // ── POST /domotics ───────────────────────────────────────────
  describe("POST /domotics", () => {
    it("creates device with valid payload", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/domotics",
        payload: {
          name: "New Relay",
          type: "relay",
          brand: "Sonoff",
          model: "BASIC R3",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("success", true);
    });

    it("rejects empty name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/domotics",
        payload: { name: "", type: "relay" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid device type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/domotics",
        payload: { name: "Test", type: "invalid_type" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid device types", async () => {
      for (const type of [
        "relay",
        "sensor",
        "switch",
        "lock",
        "siren",
        "light",
        "door",
      ]) {
        const res = await app.inject({
          method: "POST",
          url: "/domotics",
          payload: { name: `Test ${type}`, type },
        });
        expect(res.statusCode).toBe(201);
      }
    });
  });

  // ── PATCH /domotics/:id ──────────────────────────────────────
  describe("PATCH /domotics/:id", () => {
    it("updates device name", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/domotics/dev-001",
        payload: { name: "Updated Relay" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("success", true);
    });

    it("accepts partial updates", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/domotics/dev-001",
        payload: { status: "offline" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects invalid status value", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/domotics/dev-001",
        payload: { status: "unknown_status" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── DELETE /domotics/:id ─────────────────────────────────────
  describe("DELETE /domotics/:id", () => {
    it("returns 204 on successful deletion", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/domotics/dev-001",
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── POST /domotics/:id/action ────────────────────────────────
  describe("POST /domotics/:id/action", () => {
    it("executes toggle action", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/domotics/dev-001/action",
        payload: { action: "toggle" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("success", true);
      expect(body.data).toHaveProperty("device");
      expect(body.data).toHaveProperty("action");
    });

    it("rejects empty action", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/domotics/dev-001/action",
        payload: { action: "" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /domotics/:id/actions ────────────────────────────────
  describe("GET /domotics/:id/actions", () => {
    it("returns action history", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/domotics/dev-001/actions",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("success", true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
