import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Thenable chain mock for Drizzle ORM ─────────────────────
const { mockResult, createChain, mockInsert, mockUpdate, mockDelete } =
  vi.hoisted(() => {
    const mockResult = { value: [] as any[] };

    function createChain(getValue: () => any): any {
      const chain: any = {};
      const methods = [
        "select",
        "from",
        "where",
        "orderBy",
        "limit",
        "offset",
        "groupBy",
      ];
      for (const method of methods) {
        chain[method] = (..._args: any[]) => createChain(getValue);
      }
      chain.then = (resolve: any, reject?: any) => {
        try {
          resolve(getValue());
        } catch (e) {
          reject?.(e);
        }
      };
      return chain;
    }

    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();

    return { mockResult, createChain, mockInsert, mockUpdate, mockDelete };
  });

vi.mock("../../../db/client.js", () => ({
  db: {
    select: () => createChain(() => mockResult.value),
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
    update: () => ({
      set: () => ({
        where: vi.fn().mockImplementation(() => {
          const result: any = Promise.resolve(undefined);
          result.returning = mockUpdate;
          return result;
        }),
      }),
    }),
    delete: () => ({
      where: vi.fn().mockReturnValue({
        returning: mockDelete,
      }),
    }),
  },
}));

vi.mock("../../../db/schema/index.js", () => ({
  domoticDevices: {
    tenantId: "tenant_id",
    sectionId: "section_id",
    status: "status",
    type: "type",
    id: "id",
    name: "name",
    state: "state",
    lastAction: "last_action",
    lastSync: "last_sync",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  domoticActions: {
    tenantId: "tenant_id",
    deviceId: "device_id",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ col: a, val: b })),
  and: vi.fn((...conds: any[]) => ({ type: "and", conds })),
  desc: vi.fn((col: any) => ({ type: "desc", col })),
}));

import { domoticService } from "../service.js";

describe("DomoticService", () => {
  const tenantId = "tenant-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockResult.value = [];
  });

  describe("list()", () => {
    it("returns all devices for tenant", async () => {
      const devices = [
        { id: "dev-1", name: "Switch A", state: "on" },
        { id: "dev-2", name: "Switch B", state: "off" },
      ];
      mockResult.value = devices;

      const result = await domoticService.list(tenantId);
      expect(result).toEqual(devices);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no devices exist", async () => {
      mockResult.value = [];
      const result = await domoticService.list(tenantId);
      expect(result).toEqual([]);
    });
  });

  describe("getById()", () => {
    it("returns device when found", async () => {
      const device = { id: "dev-1", name: "Relay", state: "off" };
      mockResult.value = [device];

      const result = await domoticService.getById("dev-1", tenantId);
      expect(result).toEqual(device);
    });

    it("throws when device not found", async () => {
      mockResult.value = [];

      await expect(
        domoticService.getById("nonexistent", tenantId),
      ).rejects.toThrow(/Domotic device.*not found/);
    });
  });

  describe("create()", () => {
    it("creates device and returns it", async () => {
      const newDevice = {
        id: "dev-new",
        tenantId,
        name: "New Relay",
        type: "relay" as const,
        brand: "Sonoff",
        model: "BASIC R3",
      };
      mockInsert.mockResolvedValue([newDevice]);

      const result = await domoticService.create(
        {
          name: "New Relay",
          type: "relay",
          brand: "Sonoff",
          model: "BASIC R3",
        },
        tenantId,
      );
      expect(result).toEqual(newDevice);
    });
  });

  describe("update()", () => {
    it("updates device and returns it", async () => {
      const updated = { id: "dev-1", name: "Updated Name" };
      mockUpdate.mockResolvedValue([updated]);

      const result = await domoticService.update(
        "dev-1",
        { name: "Updated Name" },
        tenantId,
      );
      expect(result).toEqual(updated);
    });

    it("throws when device to update not found", async () => {
      mockUpdate.mockResolvedValue([]);

      await expect(
        domoticService.update("nonexistent", { name: "x" }, tenantId),
      ).rejects.toThrow(/Domotic device.*not found/);
    });
  });

  describe("delete()", () => {
    it("deletes device without error", async () => {
      mockDelete.mockResolvedValue([{ id: "dev-1" }]);

      await expect(
        domoticService.delete("dev-1", tenantId),
      ).resolves.not.toThrow();
    });

    it("throws when device to delete not found", async () => {
      mockDelete.mockResolvedValue([]);

      await expect(
        domoticService.delete("nonexistent", tenantId),
      ).rejects.toThrow(/Domotic device.*not found/);
    });
  });

  describe("executeAction()", () => {
    it("toggles state from off to on", async () => {
      const device = { id: "dev-1", state: "off", name: "Switch" };
      mockResult.value = [device];
      mockInsert.mockResolvedValue([
        { id: "act-1", action: "toggle", result: "on" },
      ]);

      const result = await domoticService.executeAction(
        "dev-1",
        "toggle",
        "user-1",
        tenantId,
      );
      expect(result.device.state).toBe("on");
      expect(result.action.result).toBe("on");
    });

    it("toggles state from on to off", async () => {
      const device = { id: "dev-1", state: "on", name: "Switch" };
      mockResult.value = [device];
      mockInsert.mockResolvedValue([
        { id: "act-2", action: "toggle", result: "off" },
      ]);

      const result = await domoticService.executeAction(
        "dev-1",
        "toggle",
        "user-1",
        tenantId,
      );
      expect(result.device.state).toBe("off");
    });

    it("throws when device not found for action", async () => {
      mockResult.value = [];

      await expect(
        domoticService.executeAction(
          "nonexistent",
          "toggle",
          "user-1",
          tenantId,
        ),
      ).rejects.toThrow();
    });
  });

  describe("getActions()", () => {
    it("returns action history for device", async () => {
      const actions = [
        { id: "act-1", action: "toggle", result: "on", createdAt: new Date() },
      ];
      mockResult.value = actions;

      const result = await domoticService.getActions("dev-1", tenantId);
      expect(result).toEqual(actions);
    });
  });
});
