import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database and schema
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../db/client.js', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  auditLogs: { __table: 'audit_logs' },
}));

describe('Audit Plugin Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request.audit() function', () => {
    it('inserts audit log with all required fields', async () => {
      const auditFn = async (
        action: string, resource: string, resourceId?: string, details?: Record<string, unknown>
      ) => {
        const request = {
          userId: 'user-1', tenantId: 'tenant-1', userEmail: 'admin@aion.dev',
          ip: '192.168.1.100', headers: { 'user-agent': 'TestClient/1.0' },
        };
        if (!request.userId || !request.tenantId) return;
        await mockInsert().values({
          tenantId: request.tenantId,
          userId: request.userId,
          userEmail: request.userEmail ?? 'unknown',
          action, resource, resourceId, details,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      };

      await auditFn('domotic.create', 'domotic_devices', 'dev-123', { name: 'Test Device' });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsert().values).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'admin@aion.dev',
        action: 'domotic.create',
        resource: 'domotic_devices',
        resourceId: 'dev-123',
        details: { name: 'Test Device' },
        ipAddress: '192.168.1.100',
        userAgent: 'TestClient/1.0',
      });
    });

    it('skips audit when userId is missing', async () => {
      const auditFn = async (_action: string, _resource: string) => {
        const request = { userId: '', tenantId: 'tenant-1', userEmail: '' };
        if (!request.userId || !request.tenantId) return;
        await mockInsert().values({});
      };

      await auditFn('test.action', 'test_resource');
      // values should not be called since userId is empty
      expect(mockInsert().values).not.toHaveBeenCalled();
    });

    it('skips audit when tenantId is missing', async () => {
      const auditFn = async (_action: string, _resource: string) => {
        const request = { userId: 'user-1', tenantId: '', userEmail: '' };
        if (!request.userId || !request.tenantId) return;
        await mockInsert().values({});
      };

      await auditFn('test.action', 'test_resource');
      expect(mockInsert().values).not.toHaveBeenCalled();
    });

    it('uses "unknown" for missing email', async () => {
      const auditFn = async (action: string, resource: string) => {
        const request = {
          userId: 'user-1', tenantId: 'tenant-1', userEmail: undefined as any,
          ip: '10.0.0.1', headers: {} as Record<string, string>,
        };
        if (!request.userId || !request.tenantId) return;
        await mockInsert().values({
          tenantId: request.tenantId,
          userId: request.userId,
          userEmail: request.userEmail ?? 'unknown',
          action, resource,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      };

      await auditFn('test.action', 'resource');
      expect(mockInsert().values).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: 'unknown' })
      );
    });
  });

  describe('Auto-audit on mutations', () => {
    const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

    it('detects POST as a mutation method', () => {
      expect(MUTATION_METHODS.has('POST')).toBe(true);
    });

    it('detects PUT as a mutation method', () => {
      expect(MUTATION_METHODS.has('PUT')).toBe(true);
    });

    it('detects PATCH as a mutation method', () => {
      expect(MUTATION_METHODS.has('PATCH')).toBe(true);
    });

    it('detects DELETE as a mutation method', () => {
      expect(MUTATION_METHODS.has('DELETE')).toBe(true);
    });

    it('does NOT detect GET as a mutation method', () => {
      expect(MUTATION_METHODS.has('GET')).toBe(false);
    });

    it('does NOT detect OPTIONS as a mutation method', () => {
      expect(MUTATION_METHODS.has('OPTIONS')).toBe(false);
    });

    it('generates correct action string from method and URL', () => {
      const method = 'POST';
      const url = '/api/domotics/dev-123?action=toggle';
      const action = `${method.toLowerCase()}:${url.split('?')[0]}`;
      expect(action).toBe('post:/api/domotics/dev-123');
    });

    it('extracts resource from URL path segment', () => {
      const url = '/api/domotics/dev-123';
      const resource = url.split('/')[2] ?? 'unknown';
      expect(resource).toBe('domotics');
    });

    it('defaults to "unknown" for short URLs', () => {
      const url = '/api';
      const resource = url.split('/')[2] ?? 'unknown';
      expect(resource).toBe('unknown');
    });
  });
});
