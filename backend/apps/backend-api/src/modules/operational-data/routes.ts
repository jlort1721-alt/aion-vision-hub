import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { operationalDataService } from './service.js';
import type { ListFilters, DateRangeFilters } from './service.js';

// ─── Query helpers ────────────────────────────────────────────────────────────

interface PaginationQuery {
  page?: string;
  limit?: string;
  site_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

interface DateRangeQuery extends PaginationQuery {
  date_from?: string;
  date_to?: string;
}

interface SirenTestQuery extends DateRangeQuery {
  result?: string;
}

interface ConsignaQuery extends PaginationQuery {
  unit_number?: string;
}

function parseFilters(q: PaginationQuery): ListFilters {
  return {
    page: Math.max(1, parseInt(q.page ?? '1', 10) || 1),
    limit: Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10) || 50)),
    site_id: q.site_id || undefined,
    search: q.search || undefined,
    sort_by: q.sort_by || undefined,
    sort_order: (q.sort_order === 'desc' ? 'desc' : q.sort_order === 'asc' ? 'asc' : undefined),
  };
}

function parseDateFilters(q: DateRangeQuery): DateRangeFilters {
  return {
    ...parseFilters(q),
    date_from: q.date_from || undefined,
    date_to: q.date_to || undefined,
  };
}

function paginatedResponse(reply: FastifyReply, result: { data: unknown[]; total: number; page: number; limit: number }) {
  return reply.send({
    success: true,
    data: result.data,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: Math.ceil(result.total / result.limit),
    },
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerOperationalDataRoutes(app: FastifyInstance) {

  const readRoles = requireRole('operator', 'tenant_admin', 'super_admin');
  const writeRoles = requireRole('operator', 'tenant_admin', 'super_admin');
  const adminRoles = requireRole('tenant_admin', 'super_admin');

  // ═══════════════════════════════════════════════════════════════════════════
  //  RESIDENTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/residents/grouped', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request) => {
    const data = await operationalDataService.residentsGroupedByModule(request.tenantId);
    return { success: true, data };
  });

  app.post('/residents/bulk-import', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const body = request.body as { records: Array<Record<string, unknown>> };
    if (!Array.isArray(body?.records)) {
      return reply.code(400).send({ success: false, error: 'records array required' });
    }
    const result = await operationalDataService.residentsBulkImport(request.tenantId, body.records);
    await request.audit('residents.bulk-import', 'residents', null as unknown as string, { imported: result.imported, skipped: result.skipped });
    return { success: true, data: result };
  });

  app.get<{ Querystring: PaginationQuery }>(
    '/residents',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.residentsList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.get(
    '/residents/stats',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.residentsStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/residents/:id',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const resident = await operationalDataService.residentsGetById(request.params.id, request.tenantId);
      if (!resident) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resident not found' } });
      }
      const vehiclesResult = await operationalDataService.vehiclesList(request.tenantId, {
        page: 1,
        limit: 50,
        search: undefined,
        sort_by: 'plate',
        sort_order: 'asc',
      });
      const vehicles = vehiclesResult.data.filter((v) => v.resident_id === request.params.id);
      return reply.send({ success: true, data: { ...resident, vehicles } });
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/residents',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.residentsCreate(request.tenantId, request.body);
      await request.audit('resident.create', 'residents', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/residents/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.residentsUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resident not found' } });
      }
      await request.audit('resident.update', 'residents', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/residents/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const deleted = await operationalDataService.residentsDelete(request.params.id, request.tenantId);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resident not found' } });
      }
      await request.audit('resident.delete', 'residents', request.params.id);
      return reply.send({ success: true, data: { id: request.params.id, deleted: true } });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  VEHICLES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/vehicles',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.vehiclesList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.get<{ Params: { plate: string } }>(
    '/vehicles/search/:plate',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.vehiclesSearchByPlate(request.tenantId, request.params.plate);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/vehicles',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.vehiclesCreate(request.tenantId, request.body);
      await request.audit('vehicle.create', 'vehicles', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/vehicles/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.vehiclesUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
      }
      await request.audit('vehicle.update', 'vehicles', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/vehicles/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const deleted = await operationalDataService.vehiclesDelete(request.params.id, request.tenantId);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
      }
      await request.audit('vehicle.delete', 'vehicles', request.params.id);
      return reply.send({ success: true, data: { id: request.params.id, deleted: true } });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  BIOMETRIC RECORDS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/biometric-records',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.biometricRecordsList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.get(
    '/biometric-records/stats',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.biometricRecordsStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/biometric-records',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.biometricRecordsCreate(request.tenantId, request.body);
      await request.audit('biometric_record.create', 'biometric_records', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONSIGNAS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: ConsignaQuery }>(
    '/consignas',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = {
        ...parseFilters(request.query),
        unit_number: request.query.unit_number || undefined,
      };
      const result = await operationalDataService.consignasList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.get<{ Params: { unitNumber: string }; Querystring: { site_id?: string } }>(
    '/consignas/unit/:unitNumber',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.consignasGetByUnit(
        request.tenantId,
        request.params.unitNumber,
        request.query.site_id || undefined,
      );
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/consignas',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const body = { ...request.body, created_by: request.userId };
      const data = await operationalDataService.consignasCreate(request.tenantId, body);
      await request.audit('consigna.create', 'consignas', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/consignas/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.consignasUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Consigna not found' } });
      }
      await request.audit('consigna.update', 'consignas', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/consignas/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const deleted = await operationalDataService.consignasDelete(request.params.id, request.tenantId);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Consigna not found' } });
      }
      await request.audit('consigna.delete', 'consignas', request.params.id);
      return reply.send({ success: true, data: { id: request.params.id, deleted: true } });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  SITE ADMINISTRATORS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/site-administrators',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.siteAdministratorsList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/site-administrators',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteAdministratorsCreate(request.tenantId, request.body);
      await request.audit('site_administrator.create', 'site_administrators', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/site-administrators/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteAdministratorsUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Site administrator not found' } });
      }
      await request.audit('site_administrator.update', 'site_administrators', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/site-administrators/:id',
    { preHandler: [adminRoles] },
    async (request, reply) => {
      const deleted = await operationalDataService.siteAdministratorsDelete(request.params.id, request.tenantId);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Site administrator not found' } });
      }
      await request.audit('site_administrator.delete', 'site_administrators', request.params.id);
      return reply.send({ success: true, data: { id: request.params.id, deleted: true } });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  SIREN TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: SirenTestQuery }>(
    '/siren-tests',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = {
        ...parseDateFilters(request.query),
        result: request.query.result || undefined,
      };
      const result = await operationalDataService.sirenTestsList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.get(
    '/siren-tests/stats',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.sirenTestsStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/siren-tests',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const body = { ...request.body, tested_by: request.userId };
      const data = await operationalDataService.sirenTestsCreate(request.tenantId, body);
      await request.audit('siren_test.create', 'siren_tests', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  EQUIPMENT RESTARTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: DateRangeQuery }>(
    '/equipment-restarts',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseDateFilters(request.query);
      const result = await operationalDataService.equipmentRestartsList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/equipment-restarts',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const body = { ...request.body, restarted_by: request.userId };
      const data = await operationalDataService.equipmentRestartsCreate(request.tenantId, body);
      await request.audit('equipment_restart.create', 'equipment_restarts', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOOR INVENTORY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/door-inventory',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.siteDoorInventoryList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/door-inventory',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteDoorInventoryCreate(request.tenantId, request.body);
      await request.audit('door_inventory.create', 'site_door_inventory', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/door-inventory/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteDoorInventoryUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Door inventory item not found' } });
      }
      await request.audit('door_inventory.update', 'site_door_inventory', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELEVATOR INFO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/elevator-info',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.elevatorInfoList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/elevator-info',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.elevatorInfoCreate(request.tenantId, request.body);
      await request.audit('elevator_info.create', 'elevator_info', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  GUARD SCHEDULES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/guard-schedules',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.guardSchedulesList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/guard-schedules',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.guardSchedulesCreate(request.tenantId, request.body);
      await request.audit('guard_schedule.create', 'guard_schedules', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  CCTV DESCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get<{ Querystring: PaginationQuery }>(
    '/cctv-descriptions',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const filters = parseFilters(request.query);
      const result = await operationalDataService.siteCctvDescriptionList(request.tenantId, filters);
      return paginatedResponse(reply, result);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    '/cctv-descriptions',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteCctvDescriptionCreate(request.tenantId, request.body);
      await request.audit('cctv_description.create', 'site_cctv_description', data?.id as string);
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/cctv-descriptions/:id',
    { preHandler: [writeRoles] },
    async (request, reply) => {
      const data = await operationalDataService.siteCctvDescriptionUpdate(request.params.id, request.tenantId, request.body);
      if (!data) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'CCTV description not found' } });
      }
      await request.audit('cctv_description.update', 'site_cctv_description', request.params.id);
      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  OVERALL STATS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/stats',
    { preHandler: [readRoles] },
    async (request, reply) => {
      const data = await operationalDataService.overallStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
