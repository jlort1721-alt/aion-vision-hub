import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { intercomService } from './service.js';
import { orchestrationService } from './orchestration-service.js';
import { listConnectors } from './connectors/index.js';
import { stripSensitiveFields, checkRateLimit, emitSecurityAudit } from './security-utils.js';
import {
  createIntercomDeviceSchema, updateIntercomDeviceSchema, intercomFiltersSchema,
  createCallLogSchema, callLogFiltersSchema,
  initiateCallSchema, callSessionFiltersSchema, updateCallSessionSchema,
  doorActionSchema, testDeviceSchema, provisionDeviceSchema,
  voipConfigSchema,
  inboundSessionSchema, endSessionSchema, handoffSchema,
} from './schemas.js';
import type {
  CreateIntercomDeviceInput, UpdateIntercomDeviceInput, IntercomFilters,
  CreateCallLogInput, CallLogFilters,
  InitiateCallInput, CallSessionFilters, UpdateCallSessionInput,
  DoorActionInput, TestDeviceInput, ProvisionDeviceInput,
  VoipConfigInput,
  InboundSessionInput, EndSessionInput, HandoffInput,
} from './schemas.js';

export async function registerIntercomRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // ── Devices (existing) ──
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: IntercomFilters }>('/devices', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = intercomFiltersSchema.parse(request.query);
    const data = await intercomService.listDevices(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>('/devices/:id', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await intercomService.getDeviceById(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateIntercomDeviceInput }>(
    '/devices', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createIntercomDeviceSchema.parse(request.body);
      const data = await intercomService.createDevice(body, request.tenantId);
      await request.audit('intercom.device.create', 'intercom_devices', data.id, { name: data.name });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateIntercomDeviceInput }>(
    '/devices/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateIntercomDeviceSchema.parse(request.body);
      const data = await intercomService.updateDevice(request.params.id, body, request.tenantId);
      await request.audit('intercom.device.update', 'intercom_devices', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/devices/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await intercomService.deleteDevice(request.params.id, request.tenantId);
      await request.audit('intercom.device.delete', 'intercom_devices', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // ── Legacy Call Logs (existing) ──
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: CallLogFilters }>('/calls', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = callLogFiltersSchema.parse(request.query);
    const data = await intercomService.listCalls(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateCallLogInput }>(
    '/calls', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createCallLogSchema.parse(request.body);
      const data = await intercomService.createCallLog(body, request.tenantId);
      await request.audit('intercom.call.create', 'intercom_calls', data.id, { direction: data.direction });
      return reply.code(201).send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // ── Call Sessions (new — full lifecycle) ──
  // ══════════════════════════════════════════════════════════

  /** List call sessions with filters */
  app.get<{ Querystring: CallSessionFilters }>('/sessions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = callSessionFiltersSchema.parse(request.query);
    const data = await orchestrationService.listSessions(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  /** Get single call session */
  app.get<{ Params: { id: string } }>('/sessions/:id', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await orchestrationService.getSession(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  /** Initiate outbound call via SIP */
  app.post<{ Body: InitiateCallInput }>(
    '/sessions/initiate',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = initiateCallSchema.parse(request.body);
      const result = await orchestrationService.initiateCall(body, request.tenantId);
      await request.audit('intercom.call.initiate', 'call_sessions', result.session.id, {
        targetUri: body.targetUri,
        mode: body.mode,
      });
      return reply.code(201).send({ success: true, data: result });
    },
  );

  /** Handle inbound call (called by PBX webhook/AGI) */
  app.post<{ Body: InboundSessionInput }>(
    '/sessions/inbound',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { callerUri, deviceId, sipCallId } = inboundSessionSchema.parse(request.body);
      const result = await orchestrationService.handleInboundCall({
        tenantId: request.tenantId,
        deviceId,
        callerUri: callerUri || 'unknown',
        sipCallId,
      });
      await request.audit('intercom.call.inbound', 'call_sessions', result.session.id, {
        action: result.action,
        mode: result.session.mode,
      });
      return reply.code(201).send({
        success: true,
        data: {
          session: result.session,
          action: result.action,
          greetingText: result.greeting?.text,
          greetingAudioBytes: result.greeting?.audio.length,
        },
      });
    },
  );

  /** Update call session (visitor info, status, notes) */
  app.patch<{ Params: { id: string }; Body: UpdateCallSessionInput }>(
    '/sessions/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateCallSessionSchema.parse(request.body);
      const data = await orchestrationService.updateSession(request.params.id, body, request.tenantId);
      await request.audit('intercom.session.update', 'call_sessions', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  /** End call / hang up */
  app.post<{ Params: { id: string }; Body: EndSessionInput }>(
    '/sessions/:id/end',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { notes } = endSessionSchema.parse(request.body ?? {});
      const data = await orchestrationService.endCall(request.params.id, request.tenantId, notes);
      await request.audit('intercom.call.end', 'call_sessions', data.id);
      return reply.send({ success: true, data });
    },
  );

  /** Handoff to human operator */
  app.post<{ Params: { id: string }; Body: HandoffInput }>(
    '/sessions/:id/handoff',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { reason } = handoffSchema.parse(request.body ?? {});
      await orchestrationService.handoffToHuman(request.params.id, request.tenantId, reason);
      await request.audit('intercom.call.handoff', 'call_sessions', request.params.id, { reason });
      return reply.send({ success: true, data: { handoff: true, reason } });
    },
  );

  /** Call statistics */
  app.get('/sessions/stats', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { from, to } = request.query as any;
    const data = await orchestrationService.getCallStats(request.tenantId, from, to);
    return reply.send({ success: true, data });
  });

  // ══════════════════════════════════════════════════════════
  // ── Door Relay / Access Control ──
  // ══════════════════════════════════════════════════════════

  /** Open door relay on device — rate limited, audit logged */
  app.post<{ Body: DoorActionInput }>(
    '/door/open',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      // Route-level rate limit: 10 door opens per tenant per minute
      const rl = checkRateLimit(`door-route:${request.tenantId}`, 10, 60_000);
      if (!rl.allowed) {
        emitSecurityAudit({ event: 'door.open.rate_limited', tenantId: request.tenantId, detail: 'Route-level limit' });
        return reply.code(429).send({ success: false, error: `Too many door open requests. Retry in ${Math.ceil((rl.retryAfterMs || 0) / 1000)}s.` });
      }

      const body = doorActionSchema.parse(request.body);
      const result = await orchestrationService.openDoor(body.deviceId, request.tenantId, body.relayIndex);
      await request.audit('intercom.door.open', 'intercom_devices', body.deviceId, {
        relay: body.relayIndex,
        success: result.success,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ══════════════════════════════════════════════════════════
  // ── Device Testing & Provisioning ──
  // ══════════════════════════════════════════════════════════

  /** Test device reachability — rate limited */
  app.post<{ Body: TestDeviceInput }>(
    '/devices/test',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const rl = checkRateLimit(`device-test:${request.tenantId}`, 20, 60_000);
      if (!rl.allowed) {
        return reply.code(429).send({ success: false, error: 'Too many device test requests. Try again later.' });
      }

      const body = testDeviceSchema.parse(request.body);
      emitSecurityAudit({ event: 'device.test', tenantId: request.tenantId, ipAddress: body.ipAddress });
      const result = await orchestrationService.testDevice(body.ipAddress, body.brand, body.credentials);
      return reply.send({ success: true, data: result });
    },
  );

  /** Auto-provision SIP account on device — rate limited, audit logged */
  app.post<{ Body: ProvisionDeviceInput }>(
    '/devices/provision',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const rl = checkRateLimit(`provision:${request.tenantId}`, 5, 60_000);
      if (!rl.allowed) {
        return reply.code(429).send({ success: false, error: 'Too many provision requests. Try again later.' });
      }

      const body = provisionDeviceSchema.parse(request.body);
      emitSecurityAudit({ event: 'device.provision', tenantId: request.tenantId, deviceId: body.deviceId });
      const result = await orchestrationService.provisionDevice({
        ...body,
        tenantId: request.tenantId,
      });
      await request.audit('intercom.device.provision', 'intercom_devices', body.deviceId, {
        sipUsername: body.sipUsername,
        success: result.success,
      });
      return reply.send({ success: true, data: result });
    },
  );

  /** List supported intercom brands/connectors */
  app.get('/connectors', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    return reply.send({ success: true, data: listConnectors() });
  });

  // ══════════════════════════════════════════════════════════
  // ── VoIP / SIP Configuration ──
  // ══════════════════════════════════════════════════════════

  /** Get VoIP config for tenant — credentials stripped from response */
  app.get('/voip/config', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await orchestrationService.getTenantVoipConfig(request.tenantId);
    if (!data) return reply.send({ success: true, data: { configured: false } });
    return reply.send({ success: true, data: stripSensitiveFields(data as Record<string, unknown>) });
  });

  /** Update VoIP config */
  app.patch<{ Body: VoipConfigInput }>(
    '/voip/config',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = voipConfigSchema.parse(request.body);
      const data = await orchestrationService.updateTenantVoipConfig(request.tenantId, body);
      await request.audit('intercom.voip.config.update', 'voip_config', data.id as string | undefined, body);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // ── SIP Health & Diagnostics ──
  // ══════════════════════════════════════════════════════════

  /** SIP/PBX health check */
  app.get('/voip/health', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const sipHealth = await orchestrationService.getSipHealth(request.tenantId);
    const voiceHealth = await import('../voice/service.js').then(m => m.voiceService.healthCheck());
    return reply.send({
      success: true,
      data: {
        sip: sipHealth,
        voice: voiceHealth,
        system: {
          sipConfigured: sipHealth.status !== 'not_configured',
          voiceConfigured: voiceHealth.status !== 'not_configured',
          readyForCalls: sipHealth.status === 'connected' || sipHealth.status === 'registered',
          readyForAI: voiceHealth.status === 'healthy',
        },
      },
    });
  });

  /** Test SIP connectivity */
  app.post(
    '/voip/test',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const sipHealth = await orchestrationService.getSipHealth(request.tenantId);
      await request.audit('intercom.voip.test', 'voip_config', undefined, { status: sipHealth.status });
      return reply.send({ success: true, data: sipHealth });
    },
  );
}
