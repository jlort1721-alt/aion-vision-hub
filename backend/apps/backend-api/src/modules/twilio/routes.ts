import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import {
  sendWhatsAppSchema,
  broadcastWhatsAppSchema,
  makeCallSchema,
  emergencyCallSchema,
  voiceTokenSchema,
  sendSmsSchema,
  commLogQuerySchema,
  createNotificationRuleSchema,
  updateNotificationRuleSchema,
} from './schemas.js';
import * as svc from './service.js';
import twilioService from '../../services/twilio.service.js';
import type { ApiResponse } from '@aion/shared-contracts';

// ══════════════════════════════════════════════════════════════
// Authenticated Routes (prefix: /twilio)
// ══════════════════════════════════════════════════════════════

export async function registerTwilioRoutes(app: FastifyInstance) {

  // ── Health Check ───────────────────────────────────────────
  app.get(
    '/health',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async () => {
      const health = await twilioService.healthCheck();
      return { success: true, data: health } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════
  // WhatsApp
  // ══════════════════════════════════════════════════════════

  app.post(
    '/whatsapp/send',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, _reply) => {
      const input = sendWhatsAppSchema.parse(request.body);
      const result = await svc.sendWhatsApp(
        request.tenantId,
        input.to,
        input.message,
        request.userEmail || 'operator',
        { mediaUrl: input.mediaUrl, siteId: input.siteId },
      );
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  app.post(
    '/whatsapp/broadcast',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, _reply) => {
      const input = broadcastWhatsAppSchema.parse(request.body);
      const result = await svc.broadcastWhatsApp(
        request.tenantId,
        input.siteId,
        input.message,
        request.userEmail || 'operator',
        input.filter,
      );
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════
  // Voice Calls
  // ══════════════════════════════════════════════════════════

  app.post(
    '/calls/make',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const input = makeCallSchema.parse(request.body);
      const result = await svc.makeCall(
        request.tenantId,
        input.to,
        request.userEmail || 'operator',
        { message: input.message, siteId: input.siteId },
      );
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  app.post(
    '/calls/emergency',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const input = emergencyCallSchema.parse(request.body);
      const result = await svc.makeEmergencyCall(
        request.tenantId,
        input.to,
        input.siteName,
        input.alertType,
        request.userEmail || 'operator',
      );
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  app.get(
    '/calls/token',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const { identity } = voiceTokenSchema.parse(request.query);
      const token = twilioService.generateVoiceToken(identity);
      return { success: true, data: { token } } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════
  // SMS
  // ══════════════════════════════════════════════════════════

  app.post(
    '/sms/send',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const input = sendSmsSchema.parse(request.body);
      const result = await svc.sendSMS(
        request.tenantId,
        input.to,
        input.message,
        request.userEmail || 'operator',
        { siteId: input.siteId },
      );
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════
  // Communication Logs & Stats
  // ══════════════════════════════════════════════════════════

  app.get(
    '/logs',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const filters = commLogQuerySchema.parse(request.query);
      const result = await svc.getLogs(request.tenantId, filters);
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  app.get(
    '/stats',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const stats = await svc.getStats(request.tenantId);
      return { success: true, data: stats } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════
  // Notification Rules CRUD
  // ══════════════════════════════════════════════════════════

  app.get(
    '/notification-rules',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const rules = await svc.listNotificationRules(request.tenantId);
      return { success: true, data: rules } satisfies ApiResponse;
    },
  );

  app.post(
    '/notification-rules',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const input = createNotificationRuleSchema.parse(request.body);
      const rule = await svc.createNotificationRule(request.tenantId, input);
      return { success: true, data: rule } satisfies ApiResponse;
    },
  );

  app.patch(
    '/notification-rules/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const { id } = request.params as { id: string };
      const input = updateNotificationRuleSchema.parse(request.body);
      const rule = await svc.updateNotificationRule(request.tenantId, id, input);
      if (!rule) return { success: false, error: 'Rule not found' };
      return { success: true, data: rule } satisfies ApiResponse;
    },
  );

  app.delete(
    '/notification-rules/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const { id } = request.params as { id: string };
      const rule = await svc.deleteNotificationRule(request.tenantId, id);
      if (!rule) return { success: false, error: 'Rule not found' };
      return { success: true, data: { deleted: true } } satisfies ApiResponse;
    },
  );

  app.post(
    '/notification-rules/test',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const { to, message, channel } = request.body as { to: string; message: string; channel?: string };
      if (!to || !message) return { success: false, error: 'to and message are required' };

      let result;
      if (channel === 'sms') {
        result = await svc.sendSMS(request.tenantId, to, message, request.userEmail || 'test');
      } else if (channel === 'call') {
        result = await svc.makeCall(request.tenantId, to, request.userEmail || 'test', { message });
      } else {
        result = await svc.sendWhatsApp(request.tenantId, to, message, request.userEmail || 'test');
      }
      return { success: true, data: result } satisfies ApiResponse;
    },
  );
}

// ══════════════════════════════════════════════════════════════
// Public Webhook Routes (prefix: /webhooks/twilio)
// ══════════════════════════════════════════════════════════════

export async function registerTwilioWebhookRoutes(app: FastifyInstance) {

  // ── Inbound WhatsApp ───────────────────────────────────────
  app.post('/whatsapp-incoming', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const from = (body.From || '').replace('whatsapp:', '');
    const messageBody = body.Body || '';

    // Log inbound message (use default tenant for webhooks)
    // In production, resolve tenant from the To number mapping
    const defaultTenantId = '00000000-0000-0000-0000-000000000000';
    await svc.logInboundWhatsApp(defaultTenantId, from, messageBody, body.MessageSid || '', {
      numMedia: body.NumMedia,
      profileName: body.ProfileName,
    }).catch(() => {});

    // Auto-response
    let responseMessage = 'Gracias por comunicarte con Clave Seguridad. Tu mensaje ha sido recibido. Un operador te responderá pronto.';

    const lowerMsg = messageBody.toLowerCase().trim();
    if (lowerMsg === 'estado' || lowerMsg === 'status') {
      responseMessage = 'El centro de monitoreo está operativo 24/7. Todas las unidades están en línea.';
    } else if (lowerMsg === 'emergencia' || lowerMsg === 'alerta') {
      responseMessage = 'Hemos registrado tu alerta de emergencia. Un operador se comunicará contigo en menos de 2 minutos. Si es peligro inmediato, llama al 123.';
    } else if (lowerMsg === 'horario' || lowerMsg === 'horarios') {
      responseMessage = `Monitoreo: 24/7\nOficinas: Lun-Vie 8am-6pm, Sáb 8am-1pm\nLínea directa: ${process.env.TWILIO_PHONE_NUMBER || 'N/A'}`;
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${responseMessage}</Message></Response>`;
    reply.type('text/xml').send(twiml);
  });

  // ── Call Status Callback ───────────────────────────────────
  app.post('/call-status', async (request, reply) => {
    const body = request.body as Record<string, string>;
    if (body.CallSid) {
      await svc.updateCallStatus(
        body.CallSid,
        body.CallStatus || 'unknown',
        body.CallDuration ? parseInt(body.CallDuration, 10) : undefined,
      ).catch(() => {});
    }
    reply.status(200).send('OK');
  });

  // ── Recording Status Callback ──────────────────────────────
  app.post('/recording-status', async (request, reply) => {
    const body = request.body as Record<string, string>;
    if (body.CallSid && body.RecordingUrl) {
      await svc.updateRecordingUrl(body.CallSid, body.RecordingUrl).catch(() => {});
    }
    reply.status(200).send('OK');
  });

  // ── Call Connect TwiML (browser → PSTN) ────────────────────
  app.post('/call-connect', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const to = body.To || body.phone || '';

    let twiml: string;
    if (to) {
      const callerId = process.env.TWILIO_PHONE_NUMBER || '';
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" record="record-from-answer-dual"
        recordingStatusCallback="${process.env.TWILIO_WEBHOOK_BASE || ''}/recording-status">
    <Number>${to}</Number>
  </Dial>
</Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Mia" language="es-CO">No se especificó un número de destino.</Say>
</Response>`;
    }
    reply.type('text/xml').send(twiml);
  });

  // ── Emergency IVR Response Handler ─────────────────────────
  app.post('/emergency-response', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const digit = body.Digits || '';

    let response: string;
    if (digit === '1') {
      response = 'Alerta confirmada. Gracias por su respuesta. El equipo de seguridad está al tanto.';
    } else if (digit === '2') {
      response = 'Solicitud de apoyo recibida. Se está despachando asistencia inmediata. Manténgase en la línea si necesita instrucciones.';
    } else {
      response = 'Opción no válida. La alerta queda registrada.';
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Mia" language="es-CO">${response}</Say>
</Response>`;
    reply.type('text/xml').send(twiml);
  });
}
