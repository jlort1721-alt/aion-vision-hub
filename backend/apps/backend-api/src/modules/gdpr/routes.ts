import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import {
  exportUserData,
  deleteUserData,
  recordConsent,
  listConsents,
  verifyAuditIntegrity,
} from './service.js';
import {
  exportDataSchema,
  deleteDataSchema,
  recordConsentSchema,
  verifyIntegritySchema,
} from './schemas.js';
import type { ExportDataInput, DeleteDataInput, RecordConsentInput, VerifyIntegrityInput } from './schemas.js';

export async function registerGdprRoutes(app: FastifyInstance) {

  // ── POST /gdpr/export-data — Export all user data ──────────
  app.post<{ Body: ExportDataInput }>(
    '/export-data',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['GDPR'], summary: 'Export all personal data (GDPR Article 15/20)' },
    },
    async (request, reply) => {
      const input = exportDataSchema.parse(request.body || {});
      const data = await exportUserData(request.userId, request.tenantId, input);

      await request.audit('gdpr.data_export', 'user', request.userId, { format: input.format });

      return reply.send({ success: true, data });
    },
  );

  // ── POST /gdpr/delete-data — Right to be forgotten ─────────
  app.post<{ Body: DeleteDataInput }>(
    '/delete-data',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['GDPR'], summary: 'Delete personal data (GDPR Article 17)' },
    },
    async (request, reply) => {
      const input = deleteDataSchema.parse(request.body);

      // Verify the email matches the authenticated user
      if (input.confirmEmail !== request.userEmail) {
        return reply.code(400).send({ success: false, error: 'Email does not match authenticated user' });
      }

      const data = await deleteUserData(request.userId, request.tenantId, input);

      await request.audit('gdpr.data_deletion', 'user', request.userId, {
        reason: input.reason,
        retainAuditLogs: input.retainAuditLogs,
      });

      return reply.send({ success: true, data });
    },
  );

  // ── GET /gdpr/consents — List user consents ────────────────
  app.get(
    '/consents',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['GDPR'], summary: 'List consent records for current user' },
    },
    async (request, reply) => {
      const data = await listConsents(request.userId, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /gdpr/consents — Record consent ───────────────────
  app.post<{ Body: RecordConsentInput }>(
    '/consents',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['GDPR'], summary: 'Record or withdraw consent' },
    },
    async (request, reply) => {
      const input = recordConsentSchema.parse(request.body);
      input.ipAddress = request.ip;
      const data = await recordConsent(request.userId, request.tenantId, input);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /gdpr/verify-integrity — Verify audit log integrity ─
  app.post<{ Body: VerifyIntegrityInput }>(
    '/verify-integrity',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['GDPR'], summary: 'Verify audit log hash chain integrity' },
    },
    async (request, reply) => {
      const input = verifyIntegritySchema.parse(request.body || {});
      const data = await verifyAuditIntegrity(request.tenantId, input);

      await request.audit('gdpr.integrity_check', 'audit_logs', undefined, {
        verified: data.verified,
        totalRecords: data.totalRecords,
      });

      return reply.send({ success: true, data });
    },
  );
}
