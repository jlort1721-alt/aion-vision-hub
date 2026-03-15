import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Thenable chain mock for Drizzle ORM ─────────────────────
// Each db method returns a chainable object that resolves with mockResult
// when awaited at any point in the chain.
const { mockResult, createChain, mockInsert, mockUpdate, mockDelete } = vi.hoisted(() => {
  const mockResult = { value: [] as any[] };

  function createChain(getValue: () => any): any {
    const chain: any = {};
    const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'];
    for (const method of methods) {
      chain[method] = (..._args: any[]) => createChain(getValue);
    }
    chain.then = (resolve: any, reject?: any) => {
      try { resolve(getValue()); } catch (e) { reject?.(e); }
    };
    return chain;
  }

  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  return { mockResult, createChain, mockInsert, mockUpdate, mockDelete };
});

vi.mock('../../../db/client.js', () => ({
  db: {
    select: () => createChain(() => mockResult.value),
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
    update: () => ({
      set: () => ({
        where: vi.fn().mockReturnValue({
          returning: mockUpdate,
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

vi.mock('../../../db/schema/index.js', () => ({
  intercomDevices: {
    tenantId: 'tenant_id',
    sectionId: 'section_id',
    status: 'status',
    id: 'id',
    name: 'name',
  },
  intercomCalls: {
    tenantId: 'tenant_id',
    deviceId: 'device_id',
    sectionId: 'section_id',
    direction: 'direction',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ col: a, val: b })),
  and: vi.fn((...conds: any[]) => ({ type: 'and', conds })),
}));

import { intercomService } from '../service.js';

describe('IntercomService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockResult.value = [];
  });

  describe('listDevices()', () => {
    it('returns all devices for tenant', async () => {
      const devices = [
        { id: 'ic-1', name: 'Intercom A', status: 'online' },
        { id: 'ic-2', name: 'Intercom B', status: 'offline' },
      ];
      mockResult.value = devices;

      const result = await intercomService.listDevices(tenantId);
      expect(result).toEqual(devices);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no devices exist', async () => {
      mockResult.value = [];
      const result = await intercomService.listDevices(tenantId);
      expect(result).toEqual([]);
    });
  });

  describe('getDeviceById()', () => {
    it('returns device when found', async () => {
      const device = { id: 'ic-1', name: 'Citófono' };
      mockResult.value = [device];

      const result = await intercomService.getDeviceById('ic-1', tenantId);
      expect(result).toEqual(device);
    });

    it('throws when device not found', async () => {
      mockResult.value = [];

      await expect(
        intercomService.getDeviceById('nonexistent', tenantId)
      ).rejects.toThrow();
    });
  });

  describe('createDevice()', () => {
    it('creates and returns new device', async () => {
      const newDevice = { id: 'ic-new', name: 'New Intercom' };
      mockInsert.mockResolvedValue([newDevice]);

      const result = await intercomService.createDevice(
        { name: 'New Intercom', brand: 'Fanvil', model: 'i62' },
        tenantId
      );
      expect(result).toEqual(newDevice);
    });
  });

  describe('updateDevice()', () => {
    it('updates and returns device', async () => {
      const updated = { id: 'ic-1', name: 'Updated' };
      mockUpdate.mockResolvedValue([updated]);

      const result = await intercomService.updateDevice('ic-1', { name: 'Updated' }, tenantId);
      expect(result).toEqual(updated);
    });

    it('throws when device to update not found', async () => {
      mockUpdate.mockResolvedValue([]);

      await expect(
        intercomService.updateDevice('nonexistent', { name: 'x' }, tenantId)
      ).rejects.toThrow();
    });
  });

  describe('deleteDevice()', () => {
    it('deletes device successfully', async () => {
      mockDelete.mockResolvedValue([{ id: 'ic-1' }]);
      await expect(
        intercomService.deleteDevice('ic-1', tenantId)
      ).resolves.not.toThrow();
    });

    it('throws when device to delete not found', async () => {
      mockDelete.mockResolvedValue([]);
      await expect(
        intercomService.deleteDevice('nonexistent', tenantId)
      ).rejects.toThrow();
    });
  });

  describe('listCalls()', () => {
    it('returns call history', async () => {
      const calls = [
        { id: 'call-1', direction: 'inbound', status: 'completed' },
      ];
      mockResult.value = calls;

      const result = await intercomService.listCalls(tenantId);
      expect(result).toEqual(calls);
    });
  });

  describe('createCallLog()', () => {
    it('creates call log entry', async () => {
      const call = { id: 'call-new', direction: 'inbound', status: 'completed' };
      mockInsert.mockResolvedValue([call]);

      const result = await intercomService.createCallLog(
        { deviceId: 'ic-1', direction: 'inbound', status: 'completed', attendedBy: 'ai', durationSeconds: 30 },
        tenantId
      );
      expect(result).toEqual(call);
    });
  });
});
