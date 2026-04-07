/**
 * Unified Twilio Service
 *
 * SDK-based service for WhatsApp, SMS, and Voice calls via Twilio.
 * Wraps all Twilio capabilities used by the AION platform.
 */

import Twilio from 'twilio';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'twilio-service' });

// ── Lazy singleton ──────────────────────────────────────────
let _client: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    _client = Twilio(sid, token);
  }
  return _client;
}

function isConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

// ══════════════════════════════════════════════════════════════
// Phone Normalization
// ══════════════════════════════════════════════════════════════

export function normalizeColombianPhone(phone: string): string {
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+57')) return cleaned;
  if (cleaned.startsWith('57') && cleaned.length >= 12) return '+' + cleaned;
  // Mobile: starts with 3, 10 digits
  if (cleaned.startsWith('3') && cleaned.length === 10) return '+57' + cleaned;
  // Landline with area code: starts with 60x, 10 digits
  if (cleaned.startsWith('60') && cleaned.length === 10) return '+57' + cleaned;
  if (cleaned.startsWith('6') && cleaned.length === 10) return '+57' + cleaned;
  // 7-digit landline (assume Medellín 604)
  if (cleaned.length === 7) return '+57604' + cleaned;
  if (!cleaned.startsWith('+')) cleaned = '+57' + cleaned;
  return cleaned;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ══════════════════════════════════════════════════════════════
// WhatsApp
// ══════════════════════════════════════════════════════════════

export async function sendWhatsApp(
  to: string,
  body: string,
  mediaUrl?: string,
): Promise<{ sid: string; status: string }> {
  const client = getClient();
  const normalizedTo = normalizeColombianPhone(to);
  const from = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM or TWILIO_PHONE_NUMBER is required');

  const params: Record<string, unknown> = {
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to: `whatsapp:${normalizedTo}`,
    body,
  };
  if (mediaUrl) params.mediaUrl = [mediaUrl];

  const msg = await client.messages.create(params as any);
  logger.info({ to: normalizedTo, sid: msg.sid }, 'WhatsApp message sent');
  return { sid: msg.sid, status: msg.status };
}

export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables?: Record<string, string>,
): Promise<{ sid: string; status: string }> {
  const client = getClient();
  const normalizedTo = normalizeColombianPhone(to);
  const from = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM is required');

  const params: Record<string, unknown> = {
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to: `whatsapp:${normalizedTo}`,
    contentSid: templateSid,
  };
  if (variables) params.contentVariables = JSON.stringify(variables);

  const msg = await client.messages.create(params as any);
  logger.info({ to: normalizedTo, sid: msg.sid, templateSid }, 'WhatsApp template sent');
  return { sid: msg.sid, status: msg.status };
}

export async function broadcastWhatsApp(
  recipients: Array<{ phone: string; message: string }>,
  delayMs = 1000,
): Promise<Array<{ phone: string; success: boolean; sid?: string; error?: string }>> {
  const results: Array<{ phone: string; success: boolean; sid?: string; error?: string }> = [];
  for (const r of recipients) {
    try {
      const res = await sendWhatsApp(r.phone, r.message);
      results.push({ phone: r.phone, success: true, sid: res.sid });
    } catch (err: any) {
      results.push({ phone: r.phone, success: false, error: err.message });
    }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// Voice Calls
// ══════════════════════════════════════════════════════════════

export async function makeCall(
  to: string,
  options?: { twimlUrl?: string; message?: string },
): Promise<{ sid: string; status: string }> {
  const client = getClient();
  const normalizedTo = normalizeColombianPhone(to);
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is required');
  const webhookBase = process.env.TWILIO_WEBHOOK_BASE || '';

  const params: Record<string, unknown> = {
    from,
    to: normalizedTo,
    record: true,
    statusCallback: webhookBase ? `${webhookBase}/call-status` : undefined,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    recordingStatusCallback: webhookBase ? `${webhookBase}/recording-status` : undefined,
  };

  if (options?.twimlUrl) {
    params.url = options.twimlUrl;
  } else if (options?.message) {
    params.twiml = `<Response><Say voice="Polly.Mia" language="es-CO">${escapeXml(options.message)}</Say></Response>`;
  } else if (webhookBase) {
    params.url = `${webhookBase}/call-connect`;
  } else {
    params.twiml = '<Response><Say voice="Polly.Mia" language="es-CO">Llamada conectada desde AION.</Say></Response>';
  }

  const call = await client.calls.create(params as any);
  logger.info({ to: normalizedTo, sid: call.sid }, 'Voice call initiated');
  return { sid: call.sid, status: call.status };
}

export async function makeEmergencyCall(
  to: string,
  siteName: string,
  alertType: string,
): Promise<{ sid: string; status: string }> {
  const webhookBase = process.env.TWILIO_WEBHOOK_BASE || '';
  const message = `Alerta de seguridad de Clave Seguridad. ${alertType} detectada en la unidad ${siteName}. Por favor responda para confirmar.`;
  const gatherAction = webhookBase ? `${webhookBase}/emergency-response` : '';

  const twiml = `<Response>
  <Say voice="Polly.Mia" language="es-CO">${escapeXml(message)}</Say>
  <Gather numDigits="1" action="${escapeXml(gatherAction)}" method="POST">
    <Say voice="Polly.Mia" language="es-CO">Presione 1 para confirmar que recibió esta alerta. Presione 2 para solicitar apoyo inmediato.</Say>
  </Gather>
  <Say voice="Polly.Mia" language="es-CO">No se recibió respuesta. Repitiendo.</Say>
  <Redirect>${escapeXml(gatherAction)}?retry=1</Redirect>
</Response>`;

  const client = getClient();
  const normalizedTo = normalizeColombianPhone(to);
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is required');

  const call = await client.calls.create({
    from,
    to: normalizedTo,
    twiml,
    record: true,
    statusCallback: webhookBase ? `${webhookBase}/call-status` : undefined,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  } as any);

  logger.info({ to: normalizedTo, sid: call.sid, siteName, alertType }, 'Emergency call initiated');
  return { sid: call.sid, status: call.status };
}

// ── Voice Token (browser WebRTC → PSTN via Twilio) ──────────

export function generateVoiceToken(identity: string): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!apiKeySid || !apiKeySecret) {
    throw new Error('TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are required for voice tokens');
  }
  if (!twimlAppSid) {
    throw new Error('TWILIO_TWIML_APP_SID is required for voice tokens');
  }

  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity });
  token.addGrant(voiceGrant);
  return token.toJwt();
}

// ══════════════════════════════════════════════════════════════
// SMS
// ══════════════════════════════════════════════════════════════

export async function sendSMS(
  to: string,
  body: string,
): Promise<{ sid: string; status: string }> {
  const client = getClient();
  const normalizedTo = normalizeColombianPhone(to);
  // Colombian landline (+5760x) does NOT support SMS — use US number for SMS
  const from = process.env.TWILIO_PHONE_NUMBER_US || process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER_US or TWILIO_PHONE_NUMBER is required');

  const msg = await client.messages.create({ from, to: normalizedTo, body });
  logger.info({ to: normalizedTo, sid: msg.sid, from }, 'SMS sent');
  return { sid: msg.sid, status: msg.status };
}

// ══════════════════════════════════════════════════════════════
// Health Check
// ══════════════════════════════════════════════════════════════

export async function twilioHealthCheck(): Promise<{
  status: 'healthy' | 'not_configured' | 'unhealthy';
  latencyMs: number;
  error?: string;
}> {
  if (!isConfigured()) {
    return { status: 'not_configured', latencyMs: 0, error: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' };
  }

  const start = Date.now();
  try {
    const client = getClient();
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
  }
}

// ── Cost estimates (USD) ─────────────────────────────────────
export function estimateCost(channel: string): number {
  const costs: Record<string, number> = {
    whatsapp: 0.005,
    whatsapp_template: 0.005,
    sms: 0.045,
    voice_call: 0.085,
    emergency_call: 0.085,
  };
  return costs[channel] || 0;
}

// ── Webhook signature validation ─────────────────────────────
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  return Twilio.validateRequest(authToken, signature, url, params);
}

export default {
  isConfigured,
  normalizeColombianPhone,
  sendWhatsApp,
  sendWhatsAppTemplate,
  broadcastWhatsApp,
  makeCall,
  makeEmergencyCall,
  generateVoiceToken,
  sendSMS,
  healthCheck: twilioHealthCheck,
  estimateCost,
  validateTwilioSignature,
};
