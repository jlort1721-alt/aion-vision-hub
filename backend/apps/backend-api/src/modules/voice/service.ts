/**
 * Voice Service — Orchestrates TTS providers, greeting generation,
 * call message synthesis, and intercom/AION integration.
 */

import { config } from '../../config/env.js';
import { createLogger } from '@aion/common-utils';
import { ElevenLabsProvider } from './elevenlabs-provider.js';
import { NoopVoiceProvider } from './noop-provider.js';
import type {
  VoiceProvider,
  VoiceSynthesisRequest,
  VoiceSynthesisResult,
  VoiceInfo,
  VoiceHealthCheck,
  GreetingTemplate,
} from './types.js';
import type {
  GenerateGreetingInput,
  SynthesizeCallMessageInput,
  VoiceConfigInput,
  TestConnectionInput,
} from './schemas.js';

// ── Greeting Templates ───────────────────────────────────

const GREETING_TEMPLATES: GreetingTemplate[] = [
  {
    id: 'default',
    name: 'Bienvenida estándar',
    textEs: 'Bienvenido a {siteName}. Por favor identifíquese para autorizar su ingreso.',
    textEn: 'Welcome to {siteName}. Please identify yourself to authorize entry.',
    context: 'default',
  },
  {
    id: 'after_hours',
    name: 'Fuera de horario',
    textEs: 'Fuera de horario de atención en {siteName}. Deje su mensaje o contacte seguridad al ext. 100.',
    textEn: 'Outside business hours at {siteName}. Leave a message or contact security at ext. 100.',
    context: 'after_hours',
  },
  {
    id: 'emergency',
    name: 'Emergencia',
    textEs: 'Atención. Protocolo de emergencia activado en {siteName}. Siga las instrucciones del personal de seguridad.',
    textEn: 'Attention. Emergency protocol activated at {siteName}. Follow security personnel instructions.',
    context: 'emergency',
  },
  {
    id: 'maintenance',
    name: 'Mantenimiento',
    textEs: 'Sistema en mantenimiento en {siteName}. Comuníquese con administración para asistencia.',
    textEn: 'System under maintenance at {siteName}. Contact administration for assistance.',
    context: 'maintenance',
  },
];

// ── Voice Service ────────────────────────────────────────

class VoiceService {
  private provider: VoiceProvider;
  private voiceConfig: VoiceConfigInput = {};
  private logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };

  constructor() {
    const pinoLogger = createLogger({ name: 'voice-service' });
    this.logger = {
      info: (...args) => pinoLogger.info(args.length === 1 ? args[0] : args, 'VoiceService'),
      warn: (...args) => pinoLogger.warn(args.length === 1 ? args[0] : args, 'VoiceService'),
      error: (...args) => pinoLogger.error(args.length === 1 ? args[0] : args, 'VoiceService'),
    };

    // Resolve provider based on available config
    if (config.ELEVENLABS_API_KEY) {
      this.provider = new ElevenLabsProvider(
        {
          apiKey: config.ELEVENLABS_API_KEY,
          defaultVoiceId: config.ELEVENLABS_DEFAULT_VOICE_ID,
          defaultModel: config.ELEVENLABS_MODEL_ID,
        },
        this.logger,
      );
      this.logger.info('ElevenLabs provider initialized');
    } else {
      this.provider = new NoopVoiceProvider(this.logger);
      this.logger.warn('No TTS provider configured — using noop fallback');
    }
  }

  // ── Provider Info ───────────────────────────────────────

  getProviderName(): string {
    return this.provider.name;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  // ── Health Check ────────────────────────────────────────

  async healthCheck(): Promise<VoiceHealthCheck> {
    return this.provider.healthCheck();
  }

  // ── Test Connection ─────────────────────────────────────

  async testConnection(input?: TestConnectionInput): Promise<{
    health: VoiceHealthCheck;
    synthesis?: { success: boolean; audioBytes: number; durationEstimateMs: number; error?: string };
  }> {
    const health = await this.provider.healthCheck();

    if (health.status !== 'healthy') {
      return { health };
    }

    // Also do a quick synthesis test
    const testText = input?.text ?? 'Prueba de conexión de voz AION.';
    try {
      const result = await this.provider.synthesize({
        text: testText,
        voiceId: input?.voiceId,
      });
      return {
        health,
        synthesis: {
          success: true,
          audioBytes: result.audio.length,
          durationEstimateMs: result.durationEstimateMs,
        },
      };
    } catch (err) {
      return {
        health,
        synthesis: {
          success: false,
          audioBytes: 0,
          durationEstimateMs: 0,
          error: err instanceof Error ? err.message : 'Synthesis test failed',
        },
      };
    }
  }

  // ── Voice Listing & Selection ───────────────────────────

  async listVoices(): Promise<VoiceInfo[]> {
    return this.provider.listVoices();
  }

  async getVoice(voiceId: string): Promise<VoiceInfo | null> {
    return this.provider.getVoice(voiceId);
  }

  // ── Direct Synthesis ────────────────────────────────────

  async synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    this.logger.info(`Synthesize request: ${request.text.length} chars`);

    try {
      return await this.provider.synthesize(request);
    } catch (err) {
      this.logger.error('Synthesis failed, falling back to noop:', err);
      // Fallback to noop on failure
      const noop = new NoopVoiceProvider(this.logger);
      return noop.synthesize(request);
    }
  }

  // ── Greeting Generation ─────────────────────────────────

  getGreetingTemplates(): GreetingTemplate[] {
    return GREETING_TEMPLATES;
  }

  async generateGreeting(input: GenerateGreetingInput): Promise<VoiceSynthesisResult & { text: string }> {
    let text: string;

    if (input.context === 'custom' && input.customText) {
      text = input.customText;
    } else {
      const template = GREETING_TEMPLATES.find((t) => t.context === input.context) ?? GREETING_TEMPLATES[0];
      const raw = input.language === 'en' ? template.textEn : template.textEs;
      text = raw.replace('{siteName}', input.siteName ?? 'la propiedad');
    }

    this.logger.info(`Generating greeting: context=${input.context}, lang=${input.language}, text="${text.slice(0, 60)}..."`);

    const result = await this.synthesize({
      text,
      voiceId: input.voiceId ?? this.voiceConfig.greetingVoiceId,
    });

    return { ...result, text };
  }

  // ── Call Message Synthesis (Intercom Integration) ───────

  async synthesizeCallMessage(input: SynthesizeCallMessageInput): Promise<VoiceSynthesisResult & { text: string }> {
    if (input.mode === 'human') {
      this.logger.info('Call in human mode — skipping TTS synthesis');
      const noop = new NoopVoiceProvider(this.logger);
      const result = await noop.synthesize({ text: input.message });
      return { ...result, text: input.message };
    }

    this.logger.info(
      `Synthesizing call message: mode=${input.mode}, device=${input.deviceId ?? 'N/A'}, call=${input.callId ?? 'N/A'}`,
    );

    const result = await this.synthesize({
      text: input.message,
      voiceId: input.voiceId,
      outputFormat: 'ulaw_8000', // Optimal for VoIP/SIP
    });

    return { ...result, text: input.message };
  }

  // ── AION Agent Voice Response ───────────────────────────

  async synthesizeAgentResponse(text: string, voiceId?: string): Promise<VoiceSynthesisResult> {
    this.logger.info(`Synthesizing AION agent response: ${text.length} chars`);
    return this.synthesize({ text, voiceId });
  }

  // ── Voice Config ────────────────────────────────────────

  getVoiceConfig(): VoiceConfigInput & { provider: string; configured: boolean } {
    return {
      ...this.voiceConfig,
      provider: this.provider.name,
      configured: this.provider.isConfigured(),
    };
  }

  updateVoiceConfig(input: VoiceConfigInput): void {
    this.voiceConfig = { ...this.voiceConfig, ...input };
    this.logger.info('Voice config updated:', this.voiceConfig);
  }
}

export const voiceService = new VoiceService();
