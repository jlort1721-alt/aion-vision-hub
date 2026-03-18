import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mock config (vi.hoisted to avoid TDZ issues) ────────────────
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
    WHATSAPP_APP_SECRET: 'test-app-secret-32-chars-minimum',
    NODE_ENV: 'production',
  } as Record<string, unknown>,
}));

vi.mock('../../../config/env.js', () => ({
  config: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockConfig[prop],
  }),
}));

// Mock the database client — GET handler queries integrations table
const { mockInsert, mockLimitFn } = vi.hoisted(() => ({
  mockInsert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  mockLimitFn: vi.fn(),
}));

// Default: return matching integration
mockLimitFn.mockResolvedValue([
  {
    id: 'int-1',
    tenantId: 'tenant-1',
    type: 'whatsapp',
    config: {
      verifyToken: 'test-verify-token',
      phoneNumberId: '456',
    },
  },
]);

vi.mock('../../../db/client.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockLimitFn,
        }),
      }),
    }),
    insert: mockInsert,
  },
}));

// Mock the WhatsApp service
vi.mock('../service.js', () => ({
  whatsappService: {
    processInboundMessage: vi.fn().mockResolvedValue(undefined),
    handleIncomingMessage: vi.fn().mockResolvedValue(undefined),
    handleStatusUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the AI agent
vi.mock('../ai-agent.js', () => ({
  whatsappAIAgent: {
    handleInboundMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock DB schema exports
vi.mock('../../../db/schema/index.js', () => ({
  integrations: { type: 'type' },
  auditLogs: {},
  waConversations: { tenantId: 'tenant_id', waContactPhone: 'wa_contact_phone' },
}));

// Mock drizzle-orm operators (sql is used as tagged template literal)
vi.mock('drizzle-orm', () => {
  const sqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => ({ __type: 'sql', strings, values });
  return {
    eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
    and: vi.fn().mockImplementation((...args: unknown[]) => ({ op: 'and', args })),
    sql: sqlFn,
  };
});

// Mock logger
vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerWebhookRoutes } from '../webhook.js';

function signPayload(body: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${sig}`;
}

function buildValidPayload(overrides?: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '456' },
              messages: [
                {
                  from: '5491112345678',
                  id: 'wamid.test123',
                  timestamp: String(now),
                  type: 'text',
                  text: { body: 'Hello' },
                },
              ],
              contacts: [{ profile: { name: 'Test' }, wa_id: '5491112345678' }],
            },
            field: 'messages',
          },
        ],
      },
    ],
    ...overrides,
  });
}

describe('WhatsApp Webhook', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(registerWebhookRoutes, { prefix: '/whatsapp' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /whatsapp (verification) ───────────────────────────
  describe('GET /whatsapp (verification)', () => {
    it('returns 200 with hub.challenge when verify token matches', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'test-challenge-123',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('test-challenge-123');
    });

    it('returns 403 when verify token does not match', async () => {
      // No integration matches the wrong token
      mockLimitFn.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 when hub.mode is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp',
        query: {
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /whatsapp (signature verification) ────────────────
  describe('POST /whatsapp (signature verification)', () => {
    it('returns 401 when X-Hub-Signature-256 is missing', async () => {
      const payload = buildValidPayload();
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: { 'content-type': 'application/json' },
        payload,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when signature is invalid', async () => {
      const payload = buildValidPayload();
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 200 when signature is valid', async () => {
      const payload = buildValidPayload();
      const signature = signPayload(payload, 'test-app-secret-32-chars-minimum');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 401 when signature uses wrong secret', async () => {
      const payload = buildValidPayload();
      const wrongSignature = signPayload(payload, 'completely-wrong-secret-value!!');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': wrongSignature,
        },
        payload,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /whatsapp (payload validation) ────────────────────
  describe('POST /whatsapp (payload validation)', () => {
    it('returns 400 when object type is not whatsapp_business_account', async () => {
      const payload = JSON.stringify({ object: 'instagram', entry: [{ id: '1', changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '456' } }, field: 'messages' }] }] });
      const signature = signPayload(payload, 'test-app-secret-32-chars-minimum');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when entry array is empty', async () => {
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const signature = signPayload(payload, 'test-app-secret-32-chars-minimum');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when entry.changes is missing', async () => {
      const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '123' }],
      });
      const signature = signPayload(payload, 'test-app-secret-32-chars-minimum');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when metadata.phone_number_id is missing', async () => {
      const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '123', changes: [{ value: { messaging_product: 'whatsapp', metadata: {} }, field: 'messages' }] }],
      });
      const signature = signPayload(payload, 'test-app-secret-32-chars-minimum');

      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
