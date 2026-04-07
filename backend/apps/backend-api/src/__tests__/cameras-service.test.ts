import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────────
const mockExecute = vi.fn<any>();

vi.mock('../db/client.js', () => ({
  db: {
    execute: (...args: any[]) => mockExecute(...args),
  },
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@aion/shared-contracts', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────
import { CameraService } from '../modules/cameras/service.js';

describe('CameraService', () => {
  let service: CameraService;
  const tenantId = 'tenant-001';
  const cameraId = 'cam-001';

  const fakeCamera = {
    id: cameraId,
    tenant_id: tenantId,
    device_id: 'device-001',
    site_id: 'site-001',
    name: 'Entrance Camera',
    channel_number: 1,
    stream_key: 'entrance-cam',
    brand: 'hikvision',
    is_lpr: false,
    is_ptz: true,
    status: 'online',
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CameraService();
  });

  // ─── Service exports ──────────────────────────────────────────
  it('exports CameraService class with expected methods', () => {
    expect(typeof service.list).toBe('function');
    expect(typeof service.getById).toBe('function');
    expect(typeof service.create).toBe('function');
    expect(typeof service.update).toBe('function');
    expect(typeof service.delete).toBe('function');
    expect(typeof service.bulkCreate).toBe('function');
    expect(typeof service.getBySite).toBe('function');
    expect(typeof service.syncStatus).toBe('function');
  });

  // ─── list ─────────────────────────────────────────────────────
  describe('list()', () => {
    it('returns cameras for a tenant without filters', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.list(tenantId);

      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual([fakeCamera]);
    });

    it('returns cameras filtered by site_id', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.list(tenantId, { site_id: 'site-001' });

      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual([fakeCamera]);
    });

    it('returns cameras filtered by brand', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.list(tenantId, { brand: 'hikvision' });

      expect(result).toEqual([fakeCamera]);
    });

    it('returns cameras filtered by status', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.list(tenantId, { status: 'online' });

      expect(result).toEqual([fakeCamera]);
    });

    it('returns cameras with combined filters (site_id + brand + status)', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.list(tenantId, {
        site_id: 'site-001',
        brand: 'hikvision',
        status: 'online',
      });

      expect(result).toEqual([fakeCamera]);
    });

    it('returns empty array when no cameras match', async () => {
      mockExecute.mockResolvedValueOnce([]);

      const result = await service.list(tenantId, { brand: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  // ─── getById ──────────────────────────────────────────────────
  describe('getById()', () => {
    it('returns camera when found', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.getById(cameraId, tenantId);
      expect(result).toEqual(fakeCamera);
    });

    it('throws NotFoundError when camera does not exist', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await expect(service.getById('missing', tenantId)).rejects.toThrow('Camera');
    });
  });

  // ─── getBySite ────────────────────────────────────────────────
  describe('getBySite()', () => {
    it('returns cameras grouped by site name', async () => {
      const cameras = [
        { ...fakeCamera, site_name: 'Main Office' },
        { ...fakeCamera, id: 'cam-002', name: 'Lobby Camera', site_name: 'Main Office' },
        { ...fakeCamera, id: 'cam-003', name: 'Parking Camera', site_name: 'Warehouse' },
      ];
      mockExecute.mockResolvedValueOnce(cameras);

      const result = await service.getBySite(tenantId);

      expect(result).toHaveProperty('Main Office');
      expect(result).toHaveProperty('Warehouse');
      expect(result['Main Office']).toHaveLength(2);
      expect(result['Warehouse']).toHaveLength(1);
    });

    it('groups cameras under "Unassigned" when site_name is null', async () => {
      const cameras = [
        { ...fakeCamera, site_name: null },
      ];
      mockExecute.mockResolvedValueOnce(cameras);

      const result = await service.getBySite(tenantId);

      expect(result).toHaveProperty('Unassigned');
    });
  });

  // ─── create ───────────────────────────────────────────────────
  describe('create()', () => {
    it('inserts and returns a new camera', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);

      const result = await service.create(
        { name: 'Entrance Camera', brand: 'hikvision', is_ptz: true },
        tenantId,
      );

      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual(fakeCamera);
    });

    it('creates camera with minimal fields (only name)', async () => {
      const minimal = { ...fakeCamera, device_id: null, site_id: null, channel_number: null, stream_key: null, brand: null };
      mockExecute.mockResolvedValueOnce([minimal]);

      const result = await service.create({ name: 'Basic Camera' }, tenantId);

      expect(result).toBeDefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────
  describe('update()', () => {
    it('returns updated camera', async () => {
      // First call: getById
      mockExecute.mockResolvedValueOnce([fakeCamera]);
      // Second call: update
      const updated = { ...fakeCamera, name: 'Renamed Camera' };
      mockExecute.mockResolvedValueOnce([updated]);

      const result = await service.update(cameraId, { name: 'Renamed Camera' }, tenantId);

      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when camera does not exist for update', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await expect(service.update('missing', { name: 'X' }, tenantId)).rejects.toThrow('Camera');
    });

    it('throws NotFoundError when update returns no rows', async () => {
      // getById succeeds
      mockExecute.mockResolvedValueOnce([fakeCamera]);
      // update returns empty
      mockExecute.mockResolvedValueOnce([]);

      await expect(service.update(cameraId, { name: 'X' }, tenantId)).rejects.toThrow('Camera');
    });
  });

  // ─── delete ───────────────────────────────────────────────────
  describe('delete()', () => {
    it('removes a camera successfully', async () => {
      mockExecute.mockResolvedValueOnce([{ id: cameraId }]);

      await expect(service.delete(cameraId, tenantId)).resolves.not.toThrow();
      expect(mockExecute).toHaveBeenCalled();
    });

    it('throws NotFoundError when camera does not exist', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await expect(service.delete('missing', tenantId)).rejects.toThrow('Camera');
    });
  });

  // ─── bulkCreate ───────────────────────────────────────────────
  describe('bulkCreate()', () => {
    it('creates multiple cameras and returns summary', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);
      mockExecute.mockResolvedValueOnce([{ ...fakeCamera, id: 'cam-002', name: 'Camera 2' }]);

      const result = await service.bulkCreate(
        [{ name: 'Camera 1' }, { name: 'Camera 2' }],
        tenantId,
      );

      expect(result.total).toBe(2);
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.cameras).toHaveLength(2);
    });

    it('captures errors for individual cameras that fail', async () => {
      mockExecute.mockResolvedValueOnce([fakeCamera]);
      mockExecute.mockRejectedValueOnce(new Error('DB constraint violation'));

      const result = await service.bulkCreate(
        [{ name: 'Good Camera' }, { name: 'Bad Camera' }],
        tenantId,
      );

      expect(result.total).toBe(2);
      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });
  });

  // ─── syncStatus ───────────────────────────────────────────────
  describe('syncStatus()', () => {
    it('returns zero counts when tenant has no cameras', async () => {
      mockExecute.mockResolvedValueOnce([]);

      const result = await service.syncStatus(tenantId);

      expect(result).toEqual({ total: 0, online: 0, offline: 0, unchanged: 0 });
    });

    it('increments unchanged when camera has no stream_key', async () => {
      mockExecute.mockResolvedValueOnce([{ id: cameraId, stream_key: null, status: 'unknown' }]);

      // Mock fetch for go2rtc - global fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      }) as any;

      const result = await service.syncStatus(tenantId);

      expect(result.unchanged).toBe(1);

      globalThis.fetch = originalFetch;
    });

    it('returns error info when go2rtc is unreachable', async () => {
      mockExecute.mockResolvedValueOnce([{ id: cameraId, stream_key: 'cam-1', status: 'online' }]);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused')) as any;

      const result = await service.syncStatus(tenantId);

      expect(result.error).toBe('go2rtc unreachable');
      expect(result.unchanged).toBe(1);

      globalThis.fetch = originalFetch;
    });
  });
});
