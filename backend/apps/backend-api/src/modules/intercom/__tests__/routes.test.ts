import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

// ── Hoist mock data so vi.mock factories can reference it ────
const { mockDevice, mockCall } = vi.hoisted(() => ({
  mockDevice: {
    id: 'ic-001',
    tenantId: 'tenant-456',
    name: 'Citófono Portería',
    sectionId: 'sec-1',
    brand: 'Fanvil',
    model: 'i18S',
    ipAddress: '192.168.1.201',
    sipUri: 'sip:101@pbx',
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockCall: {
    id: 'call-001',
    tenantId: 'tenant-456',
    deviceId: 'ic-001',
    direction: 'inbound',
    durationSeconds: 45,
    attendedBy: 'ai',
    status: 'completed',
    sectionId: 'sec-1',
    createdAt: new Date(),
  },
}));

// ── Mock dependencies ─────────────────────────────────────────
vi.mock('../../../plugins/auth.js', () => ({
  requireRole: vi.fn().mockImplementation(() => async () => {}),
}));

vi.mock('../service.js', () => ({
  intercomService: {
    listDevices: vi.fn().mockResolvedValue([mockDevice]),
    getDeviceById: vi.fn().mockResolvedValue(mockDevice),
    createDevice: vi.fn().mockResolvedValue(mockDevice),
    updateDevice: vi.fn().mockResolvedValue({ ...mockDevice, name: 'Updated' }),
    deleteDevice: vi.fn().mockResolvedValue(undefined),
    listCalls: vi.fn().mockResolvedValue([mockCall]),
    createCallLog: vi.fn().mockResolvedValue(mockCall),
  },
}));

vi.mock('../orchestration-service.js', () => ({
  orchestrationService: {
    initiateOutbound: vi.fn().mockResolvedValue({ sessionId: 'sess-1', status: 'ringing' }),
    handleInbound: vi.fn().mockResolvedValue({ sessionId: 'sess-2', status: 'answered' }),
    updateSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1', status: 'active' }),
    endCall: vi.fn().mockResolvedValue({ sessionId: 'sess-1', status: 'ended' }),
    handoff: vi.fn().mockResolvedValue({ sessionId: 'sess-1', handoff: true }),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
    getSessionStats: vi.fn().mockResolvedValue({ total: 10, avgDuration: 60 }),
    getCallStats: vi.fn().mockResolvedValue({ total: 10, avgDuration: 60, byDirection: {} }),
  },
}));

vi.mock('../../../modules/voice/service.js', () => ({
  default: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', latencyMs: 50 }),
  },
}));

vi.mock('../connectors/index.js', () => ({
  listConnectors: vi.fn().mockReturnValue([]),
}));

vi.mock('@aion/shared-contracts', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
    }
  },
  ErrorCodes: {},
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerIntercomRoutes } from '../routes.js';

describe('Intercom Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ZodError) {
        reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        });
        return;
      }
      reply.code(500).send({ success: false, error: { message: (error as Error).message } });
    });

    app.decorateRequest('tenantId', 'tenant-456');
    app.decorateRequest('userId', 'user-123');
    app.decorateRequest('userEmail', 'admin@aion.dev');
    app.decorateRequest('audit', null as any);
    app.addHook('preHandler', async (request) => {
      (request as any).tenantId = 'tenant-456';
      (request as any).userId = 'user-123';
      (request as any).userEmail = 'admin@aion.dev';
      (request as any).audit = vi.fn().mockResolvedValue(undefined);
    });

    await app.register(registerIntercomRoutes, { prefix: '/intercom' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Devices CRUD ─────────────────────────────────────────────
  describe('GET /intercom/devices', () => {
    it('returns 200 with device list', async () => {
      const res = await app.inject({ method: 'GET', url: '/intercom/devices' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /intercom/devices/:id', () => {
    it('returns 200 with device details', async () => {
      const res = await app.inject({ method: 'GET', url: '/intercom/devices/ic-001' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveProperty('id', 'ic-001');
      expect(body.data).toHaveProperty('name', 'Citófono Portería');
    });
  });

  describe('POST /intercom/devices', () => {
    it('creates device with valid payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/intercom/devices',
        payload: { name: 'New Intercom', brand: 'Fanvil', model: 'i62' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });

    it('rejects empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/intercom/devices',
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /intercom/devices/:id', () => {
    it('returns 204 on successful deletion', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/intercom/devices/ic-001',
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── Call Logs ─────────────────────────────────────────────────
  describe('GET /intercom/calls', () => {
    it('returns 200 with call history', async () => {
      const res = await app.inject({ method: 'GET', url: '/intercom/calls' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /intercom/calls', () => {
    it('creates call log entry', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/intercom/calls',
        payload: {
          deviceId: '00000000-0000-0000-0000-000000000001',
          direction: 'inbound',
          durationSeconds: 30,
          attendedBy: 'ai',
          status: 'completed',
          sectionId: '00000000-0000-0000-0000-000000000010',
        },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  // ── Sessions ──────────────────────────────────────────────────
  describe('GET /intercom/sessions', () => {
    it('returns 200 with session list', async () => {
      const res = await app.inject({ method: 'GET', url: '/intercom/sessions' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /intercom/sessions/stats', () => {
    it('returns session statistics', async () => {
      const res = await app.inject({ method: 'GET', url: '/intercom/sessions/stats' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });
  });
});
