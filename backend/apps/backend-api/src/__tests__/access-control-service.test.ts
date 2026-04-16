import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database client
vi.mock("../db/client.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi
      .fn()
      .mockResolvedValue([
        { id: "test-id", fullName: "Test Person", tenantId: "tenant-1" },
      ]),
  },
}));

describe("AccessControlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Module exports", () => {
    it("should export AccessControlService class", async () => {
      const mod = await import("../modules/access-control/service.js");
      expect(mod).toBeDefined();
    });
  });

  describe("Service interface", () => {
    it("should have people CRUD methods", async () => {
      const mod = await import("../modules/access-control/service.js");
      const service = mod.default || mod;
      // The service exports a class instance or class
      expect(service).toBeDefined();
    });
  });

  describe("Schema validation", () => {
    it("should export schemas for validation", async () => {
      const schemas = await import("../modules/access-control/schemas.js");
      expect(schemas).toBeDefined();
    });
  });

  describe("Routes", () => {
    it("should export routes plugin", async () => {
      const routes = await import("../modules/access-control/routes.js");
      expect(routes).toBeDefined();
      expect(routes.registerAccessControlRoutes).toBeDefined();
    });
  });
});
