/**
 * External Integrations - Barrel Export
 *
 * All external service integrations are exposed here.
 * Each service follows the same pattern:
 *   - isConfigured() → boolean
 *   - testConnection() → Promise<HealthCheck>
 *   - service-specific methods
 *
 * Credentials are loaded from environment variables.
 * Services degrade gracefully when not configured.
 */

export { ElevenLabsService, elevenlabs } from './elevenlabs';
export type { ElevenLabsConfig, TTSRequest, TTSResponse, VoiceInfo, VoiceHealthCheck, VoiceConfig, GreetingTemplate, TestConnectionResult } from './elevenlabs';

export { WhatsAppService, whatsapp } from './whatsapp';
export type { WhatsAppConfig, WhatsAppMessage, WhatsAppSendResult, WhatsAppHealthCheck } from './whatsapp';

export { EmailService, emailService } from './email';
export type { EmailMessage, EmailSendResult, EmailHealthCheck } from './email';

export { EWeLinkService, ewelink } from './ewelink';
export type { EWeLinkDevice, EWeLinkDeviceAction, EWeLinkResult, EWeLinkHealthCheck, EWeLinkStatus } from './ewelink';

export { VoIPService, voipService } from './voip';
export type { VoIPConfig, SIPDevice, InitiateCallRequest, InitiateCallResult, VoIPHealthCheck } from './voip';

/** Run health checks on all configured integrations */
export async function checkAllIntegrations(): Promise<Record<string, { status: string; message: string; latencyMs: number }>> {
  const { elevenlabs } = await import('./elevenlabs');
  const { whatsapp } = await import('./whatsapp');
  const { emailService } = await import('./email');
  const { ewelink } = await import('./ewelink');
  const { voipService } = await import('./voip');

  const [el, wa, em, ew, vo] = await Promise.allSettled([
    elevenlabs.testConnection(),
    whatsapp.testConnection(),
    emailService.testConnection(),
    ewelink.testConnection(),
    voipService.testConnection(),
  ]);

  const extract = (result: PromiseSettledResult<any>) =>
    result.status === 'fulfilled'
      ? { status: result.value.status, message: result.value.message, latencyMs: result.value.latencyMs }
      : { status: 'error', message: result.reason?.message || 'Unknown error', latencyMs: 0 };

  return {
    elevenlabs: extract(el),
    whatsapp: extract(wa),
    email: extract(em),
    ewelink: extract(ew),
    voip: extract(vo),
  };
}
