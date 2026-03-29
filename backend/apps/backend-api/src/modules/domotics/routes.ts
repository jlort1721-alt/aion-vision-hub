import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { domoticService } from './service.js';
import { ewelinkMCP } from '../../services/ewelink-mcp.js';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import {
  createDomoticDeviceSchema, updateDomoticDeviceSchema,
  domoticFiltersSchema, domoticActionSchema,
} from './schemas.js';
import type { CreateDomoticDeviceInput, UpdateDomoticDeviceInput, DomoticFilters, DomoticActionInput } from './schemas.js';

export async function registerDomoticRoutes(app: FastifyInstance) {
  // ── eWeLink MCP endpoints ──────────────────────────────────
  app.get('/ewelink/status', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    return reply.send({ success: true, data: { configured: ewelinkMCP.isConfigured() } });
  });

  app.get('/ewelink/devices', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    if (!ewelinkMCP.isConfigured()) return reply.send({ success: true, data: [], message: 'eWeLink MCP not configured' });
    try {
      const devices = await ewelinkMCP.getDevices();
      return reply.send({ success: true, data: devices });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  app.post('/ewelink/:deviceId/toggle', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const { on } = request.body as { on: boolean };
    try {
      await ewelinkMCP.toggleDevice(deviceId, on);
      await request.audit('domotics.ewelink.toggle', 'ewelink', deviceId, { on });
      return reply.send({ success: true });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  app.post('/ewelink/:deviceId/control', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const { action } = request.body as { action: string };
    try {
      await ewelinkMCP.controlDevice(deviceId, action);
      await request.audit('domotics.ewelink.control', 'ewelink', deviceId, { action });
      return reply.send({ success: true });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });
  app.get<{ Querystring: DomoticFilters }>('/', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = domoticFiltersSchema.parse(request.query);
    const data = await domoticService.list(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  // /devices sub-path (frontend calls /domotics/devices)
  app.get('/devices', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await domoticService.list(request.tenantId, {});
    return reply.send({ success: true, data });
  });

  // /actions list (frontend calls /domotics/actions)
  app.get('/actions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId, limit } = request.query as { deviceId?: string; limit?: string };
    const data = await domoticService.listActions(request.tenantId, deviceId, limit ? parseInt(limit, 10) : 50);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    // Validate UUID format to prevent "invalid input syntax" errors
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
      return reply.code(400).send({ success: false, error: 'Invalid ID format' });
    }
    const data = await domoticService.getById(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateDomoticDeviceInput }>(
    '/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createDomoticDeviceSchema.parse(request.body);
      const data = await domoticService.create(body, request.tenantId);
      await request.audit('domotic.create', 'domotic_devices', data.id, { name: data.name });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateDomoticDeviceInput }>(
    '/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateDomoticDeviceSchema.parse(request.body);
      const data = await domoticService.update(request.params.id, body, request.tenantId);
      await request.audit('domotic.update', 'domotic_devices', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await domoticService.delete(request.params.id, request.tenantId);
      await request.audit('domotic.delete', 'domotic_devices', request.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: DomoticActionInput }>(
    '/:id/action', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { action } = domoticActionSchema.parse(request.body);
      const data = await domoticService.executeAction(request.params.id, action, request.userId, request.tenantId);
      await request.audit('domotic.action', 'domotic_devices', request.params.id, { action });
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>('/:id/actions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await domoticService.getActions(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  // ── eWeLink Device Mappings CRUD ─────────────────────────────

  /** GET /ewelink/mappings — List all eWeLink device mappings for tenant (with site name via JOIN) */
  app.get('/ewelink/mappings', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    try {
      const result = await db.execute(sql`
        SELECT
          m.*,
          COALESCE(s.name, 'Unassigned') AS site_name
        FROM ewelink_device_mappings m
        LEFT JOIN sites s ON s.id = m.site_id
        WHERE m.tenant_id = ${request.tenantId}
        ORDER BY m.label ASC
      `);
      const rows = (result as unknown as Record<string, unknown>[]);
      return reply.send({ success: true, data: rows });
    } catch (err) {
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }
  });

  /** POST /ewelink/mappings — Create a new eWeLink device mapping */
  app.post('/ewelink/mappings', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { ewelink_device_id, site_id, device_type, label, requires_confirmation } = request.body as {
      ewelink_device_id: string;
      site_id?: string;
      device_type?: string;
      label: string;
      requires_confirmation?: boolean;
    };
    try {
      const result = await db.execute(sql`
        INSERT INTO ewelink_device_mappings (tenant_id, ewelink_device_id, site_id, device_type, label, requires_confirmation)
        VALUES (
          ${request.tenantId},
          ${ewelink_device_id},
          ${site_id ?? null},
          ${device_type ?? null},
          ${label},
          ${requires_confirmation ?? false}
        )
        RETURNING *
      `);
      const rows = (result as unknown as Record<string, unknown>[]);
      return reply.code(201).send({ success: true, data: rows[0] });
    } catch (err) {
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }
  });

  /** PATCH /ewelink/mappings/:id — Update an existing eWeLink device mapping */
  app.patch<{ Params: { id: string } }>('/ewelink/mappings/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { id } = request.params;
    const { ewelink_device_id, site_id, device_type, label, requires_confirmation } = request.body as {
      ewelink_device_id?: string;
      site_id?: string | null;
      device_type?: string | null;
      label?: string;
      requires_confirmation?: boolean;
    };
    try {
      const result = await db.execute(sql`
        UPDATE ewelink_device_mappings
        SET
          ewelink_device_id = COALESCE(${ewelink_device_id ?? null}, ewelink_device_id),
          site_id = COALESCE(${site_id ?? null}, site_id),
          device_type = COALESCE(${device_type ?? null}, device_type),
          label = COALESCE(${label ?? null}, label),
          requires_confirmation = COALESCE(${requires_confirmation ?? null}, requires_confirmation),
          updated_at = now()
        WHERE id = ${id} AND tenant_id = ${request.tenantId}
        RETURNING *
      `);
      const rows = (result as unknown as Record<string, unknown>[]);
      if (!rows.length) return reply.code(404).send({ success: false, error: 'Mapping not found' });
      return reply.send({ success: true, data: rows[0] });
    } catch (err) {
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }
  });

  /** DELETE /ewelink/mappings/:id — Delete an eWeLink device mapping */
  app.delete<{ Params: { id: string } }>('/ewelink/mappings/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const result = await db.execute(sql`
        DELETE FROM ewelink_device_mappings
        WHERE id = ${id} AND tenant_id = ${request.tenantId}
        RETURNING id
      `);
      const rows = (result as unknown as Record<string, unknown>[]);
      if (!rows.length) return reply.code(404).send({ success: false, error: 'Mapping not found' });
      return reply.code(204).send();
    } catch (err) {
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }
  });

  /** GET /ewelink/by-site/:siteId — Get eWeLink devices for a specific site (JOIN mappings with device data) */
  app.get<{ Params: { siteId: string } }>('/ewelink/by-site/:siteId', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { siteId } = request.params;
    try {
      const result = await db.execute(sql`
        SELECT
          m.id AS mapping_id,
          m.ewelink_device_id,
          m.device_type,
          m.label,
          m.requires_confirmation,
          m.created_at,
          m.updated_at,
          s.name AS site_name
        FROM ewelink_device_mappings m
        LEFT JOIN sites s ON s.id = m.site_id
        WHERE m.tenant_id = ${request.tenantId}
          AND m.site_id = ${siteId}
        ORDER BY m.label ASC
      `);
      const rows = (result as unknown as Record<string, unknown>[]);
      return reply.send({ success: true, data: rows });
    } catch (err) {
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }
  });
}
