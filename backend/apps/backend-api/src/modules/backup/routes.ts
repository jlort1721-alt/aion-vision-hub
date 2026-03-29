import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import {
  getBackupStatus,
  listBackups,
  runBackupNow,
} from '../../workers/backup-worker.js';

export async function registerBackupRoutes(app: FastifyInstance) {
  // GET /backup/status — last backup date, next scheduled, total backups, disk usage
  app.get('/status', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const status = getBackupStatus();
    return reply.send({ success: true, data: status });
  });

  // POST /backup/trigger — manually trigger a backup (admin only)
  app.post(
    '/trigger',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const manifest = await runBackupNow(db);
      await request.audit('backup.trigger', 'backups', 'manual', {
        total_rows: manifest.total_rows,
        duration_ms: manifest.duration_ms,
      });
      return reply.code(201).send({ success: true, data: manifest });
    },
  );

  // GET /backup/list — list available backups with dates and sizes
  app.get('/list', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const backups = listBackups();
    return reply.send({ success: true, data: backups });
  });
}
