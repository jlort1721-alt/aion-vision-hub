import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock crypto for randomUUID ─────────────────────────────────
vi.stubGlobal('crypto', { randomUUID: () => 'uuid-snap-001' });

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => Promise.resolve([]));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: any[]) => (mockSelect as any)(...args),
    insert: (...args: any[]) => (mockInsert as any)(...args),
    delete: (...args: any[]) => (mockDelete as any)(...args),
  },
}));

vi.mock('../db/schema/evidence.js', () => ({
  evidence: {
    id: 'id',
    tenantId: 'tenant_id',
    incidentId: 'incident_id',
    deviceId: 'device_id',
    type: 'type',
    fileUrl: 'file_url',
    thumbnailUrl: 'thumbnail_url',
    fileName: 'file_name',
    mimeType: 'mime_type',
    description: 'description',
    capturedAt: 'captured_at',
    createdBy: 'created_by',
    createdAt: 'created_at',
  },
}));

vi.mock('../db/schema/index.js', () => ({
  incidents: {
    id: 'id',
    tenantId: 'tenant_id',
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    siteId: 'site_id',
    eventIds: 'event_ids',
    evidenceUrls: 'evidence_urls',
    comments: 'comments',
    assignedTo: 'assigned_to',
    createdBy: 'created_by',
    closedAt: 'closed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@aion/shared-contracts', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { EvidenceService } from '../modules/evidence/service.js';
import {
  createEvidenceSchema,
  captureSnapshotSchema,
  listEvidenceSchema,
  deleteEvidenceParamsSchema,
} from '../modules/evidence/schemas.js';

// ═══════════════════════════════════════════════════════════════════
// Evidence Schema Validation
// ═══════════════════════════════════════════════════════════════════

describe('Evidence Schemas', () => {
  // ── createEvidenceSchema ─────────────────────────────────────
  describe('createEvidenceSchema', () => {
    it('accepts a valid full payload', () => {
      const valid = {
        incident_id: '11111111-1111-1111-1111-111111111111',
        device_id: '22222222-2222-2222-2222-222222222222',
        type: 'snapshot',
        file_url: 'https://storage.example.com/evidence/img.jpg',
        thumbnail_url: 'https://storage.example.com/evidence/img_thumb.jpg',
        file_name: 'img.jpg',
        mime_type: 'image/jpeg',
        description: 'Front camera capture',
        captured_at: '2026-03-25T10:00:00+00:00',
      };
      const result = createEvidenceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts a minimal payload (incident_id only, type defaults to snapshot)', () => {
      const minimal = {
        incident_id: '11111111-1111-1111-1111-111111111111',
      };
      const result = createEvidenceSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('snapshot');
      }
    });

    it('rejects when incident_id is missing', () => {
      const result = createEvidenceSchema.safeParse({ type: 'clip' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid incident_id (not a UUID)', () => {
      const result = createEvidenceSchema.safeParse({ incident_id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid device_id (not a UUID)', () => {
      const result = createEvidenceSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
        device_id: 'bad-id',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid evidence type', () => {
      const result = createEvidenceSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
        type: 'invalid_type',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid file_url (not a URL)', () => {
      const result = createEvidenceSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
        file_url: 'not a url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts all valid evidence types', () => {
      for (const type of ['snapshot', 'clip', 'document', 'note']) {
        const result = createEvidenceSchema.safeParse({
          incident_id: '11111111-1111-1111-1111-111111111111',
          type,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  // ── captureSnapshotSchema ────────────────────────────────────
  describe('captureSnapshotSchema', () => {
    it('accepts a valid payload', () => {
      const result = captureSnapshotSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
        device_id: '22222222-2222-2222-2222-222222222222',
      });
      expect(result.success).toBe(true);
    });

    it('accepts payload with optional description', () => {
      const result = captureSnapshotSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
        device_id: '22222222-2222-2222-2222-222222222222',
        description: 'Snapshot for incident investigation',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when device_id is missing', () => {
      const result = captureSnapshotSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when incident_id is missing', () => {
      const result = captureSnapshotSchema.safeParse({
        device_id: '22222222-2222-2222-2222-222222222222',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── listEvidenceSchema ───────────────────────────────────────
  describe('listEvidenceSchema', () => {
    it('accepts a valid incident_id', () => {
      const result = listEvidenceSchema.safeParse({
        incident_id: '11111111-1111-1111-1111-111111111111',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid incident_id', () => {
      const result = listEvidenceSchema.safeParse({ incident_id: 'not-uuid' });
      expect(result.success).toBe(false);
    });
  });

  // ── deleteEvidenceParamsSchema ───────────────────────────────
  describe('deleteEvidenceParamsSchema', () => {
    it('accepts a valid UUID', () => {
      const result = deleteEvidenceParamsSchema.safeParse({
        id: '11111111-1111-1111-1111-111111111111',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a non-UUID id', () => {
      const result = deleteEvidenceParamsSchema.safeParse({ id: 'bad' });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Evidence Service
// ═══════════════════════════════════════════════════════════════════

describe('EvidenceService', () => {
  let service: EvidenceService;
  const tenantId = 'tenant-001';
  const userId = 'user-001';
  const incidentId = 'incident-001';
  const evidenceId = 'evidence-001';

  const fakeEvidence = {
    id: evidenceId,
    tenantId,
    incidentId,
    deviceId: 'device-001',
    type: 'snapshot',
    fileUrl: 'https://storage.example.com/evidence/snap1.jpg',
    thumbnailUrl: 'https://storage.example.com/evidence/snap1_thumb.jpg',
    fileName: 'snap1.jpg',
    mimeType: 'image/jpeg',
    description: 'Front camera capture',
    capturedAt: new Date(),
    createdBy: userId,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EvidenceService();
  });

  // ── list ────────────────────────────────────────────────────
  it('list() returns tenant-scoped evidence for an incident', async () => {
    // First call: incident ownership check
    mockLimit.mockResolvedValueOnce([{ id: incidentId }] as any);
    // Second call: evidence rows (via orderBy after where)
    mockOrderBy.mockResolvedValueOnce([fakeEvidence, { ...fakeEvidence, id: 'evidence-002' }] as any);

    const result = await service.list(incidentId, tenantId);

    expect(result).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('list() throws NotFoundError when incident does not belong to tenant', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.list(incidentId, tenantId)).rejects.toThrow('Incident');
  });

  // ── create ──────────────────────────────────────────────────
  it('create() validates incident ownership before inserting', async () => {
    // Incident ownership check
    mockLimit.mockResolvedValueOnce([{ id: incidentId }] as any);
    // Insert returning
    mockReturning.mockResolvedValueOnce([fakeEvidence]);

    const result = await service.create(
      {
        incident_id: incidentId,
        type: 'snapshot',
        file_url: 'https://storage.example.com/evidence/snap1.jpg',
      } as any,
      tenantId,
      userId,
    );

    expect(mockSelect).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual(fakeEvidence);
  });

  it('create() throws NotFoundError when incident does not belong to tenant', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.create(
        { incident_id: 'wrong-incident', type: 'snapshot' } as any,
        tenantId,
        userId,
      ),
    ).rejects.toThrow('Incident');
  });

  it('create() handles optional fields as null', async () => {
    mockLimit.mockResolvedValueOnce([{ id: incidentId }] as any);
    const noOptionals = { ...fakeEvidence, deviceId: null, fileUrl: null, thumbnailUrl: null, description: null };
    mockReturning.mockResolvedValueOnce([noOptionals]);

    const result = await service.create(
      { incident_id: incidentId, type: 'note' } as any,
      tenantId,
      userId,
    );

    expect(result.deviceId).toBeNull();
    expect(result.fileUrl).toBeNull();
  });

  // ── captureSnapshot ─────────────────────────────────────────
  it('captureSnapshot() creates evidence record with type "snapshot"', async () => {
    // Incident ownership check
    mockLimit.mockResolvedValueOnce([{ id: incidentId }] as any);
    // Insert returning
    const snapshotEvidence = {
      ...fakeEvidence,
      type: 'snapshot',
      fileUrl: '/storage/evidence/uuid-snap-001.jpg',
      thumbnailUrl: '/storage/evidence/uuid-snap-001_thumb.jpg',
      mimeType: 'image/jpeg',
    };
    mockReturning.mockResolvedValueOnce([snapshotEvidence]);

    const result = await service.captureSnapshot(
      {
        incident_id: incidentId,
        device_id: 'device-001',
        description: 'Parking lot snapshot',
      },
      tenantId,
      userId,
    );

    expect(result.type).toBe('snapshot');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileUrl).toContain('uuid-snap-001');
    expect(result.thumbnailUrl).toContain('_thumb');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('captureSnapshot() throws NotFoundError when incident does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.captureSnapshot(
        { incident_id: 'missing', device_id: 'device-001' },
        tenantId,
        userId,
      ),
    ).rejects.toThrow('Incident');
  });

  // ── delete ──────────────────────────────────────────────────
  it('delete() validates tenant ownership before deleting', async () => {
    // Select check
    mockLimit.mockResolvedValueOnce([fakeEvidence] as any);

    const result = await service.delete(evidenceId, tenantId);

    expect(result).toEqual(fakeEvidence);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('delete() throws NotFoundError when evidence does not belong to tenant', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.delete('missing', tenantId)).rejects.toThrow('Evidence');
  });

  // ── getById ─────────────────────────────────────────────────
  it('getById() returns evidence when found', async () => {
    mockLimit.mockResolvedValueOnce([fakeEvidence] as any);

    const result = await service.getById(evidenceId, tenantId);

    expect(result).toEqual(fakeEvidence);
  });

  it('getById() throws NotFoundError when evidence does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing', tenantId)).rejects.toThrow('Evidence');
  });
});
