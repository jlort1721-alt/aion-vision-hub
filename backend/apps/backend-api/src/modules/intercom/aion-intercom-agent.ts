/**
 * AION Intercom Agent — AI Conversation Handler
 *
 * Integration contract between the AION AI agent and the intercom
 * call orchestration system. Processes visitor speech, generates
 * contextual responses, evaluates access decisions, and determines
 * when to hand off to a human operator.
 *
 * FLOW:
 *   1. Intercom call arrives (inbound)
 *   2. AI greeting played via ElevenLabs TTS
 *   3. Visitor speaks → STT (future: Whisper or Deepgram)
 *   4. This agent processes the transcribed text
 *   5. Agent responds via TTS or decides to handoff/grant access
 *
 * PRODUCTION REQUIREMENTS:
 *   - Speech-to-Text (STT) service: Whisper API or Deepgram
 *   - AI provider: OpenAI GPT or Anthropic Claude (via ai-bridge module)
 *   - ElevenLabs for TTS playback to intercom
 *   - Asterisk ARI for audio injection into SIP call
 *
 * CURRENT STATUS:
 *   Contract-ready. AI responses use the existing ai-bridge module.
 *   STT integration pending (requires audio capture from SIP stream).
 */

import type {
  AionAgentContract,
  CallSessionContext,
  AgentResponse,
  AccessDecision,
  HandoffDecision,
  ConversationTurn,
  VoiceIntegrationContract,
} from './types.js';
import { voiceService } from '../voice/service.js';
import { aiBridgeService } from '../ai-bridge/service.js';
import { config } from '../../config/env.js';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'aion-intercom-agent' });

// ── System Prompts ────────────────────────────────────────

const INTERCOM_SYSTEM_PROMPT = `Eres AION, el asistente de seguridad inteligente del sistema de videovigilancia AION Vision Hub.
Tu rol es atender llamadas de citófonos/intercomunicadores IP en edificios y conjuntos residenciales.

REGLAS:
1. Saluda amablemente e identifica al visitante (nombre, a quién visita, propósito).
2. Sé conciso — el visitante está frente a una puerta esperando.
3. Si el visitante da información suficiente (nombre + destino), sugiere autorizar acceso.
4. Si la información es insuficiente o sospechosa, sugiere transferir a operador humano.
5. En emergencias (ambulancia, bomberos, policía), autoriza acceso inmediato.
6. Nunca reveles información interna del edificio (nombres de residentes, códigos).
7. Responde en el idioma del visitante (español por defecto).
8. Mantén respuestas bajo 50 palabras para minimizar latencia TTS.

FORMATO DE RESPUESTA:
Responde en JSON con esta estructura:
{
  "text": "Tu respuesta hablada al visitante",
  "action": "continue | grant_access | deny_access | handoff",
  "confidence": 0.0-1.0,
  "collectedInfo": {
    "visitorName": "nombre si lo dijo",
    "visitorDestination": "apartamento/oficina si lo dijo",
    "visitorPurpose": "propósito si lo dijo"
  }
}`;

export const INTERCOM_SYSTEM_PROMPT_EN = `You are AION, the intelligent security assistant for the AION Vision Hub surveillance system.
Your role is to handle intercom/door phone calls at buildings and residential complexes.

RULES:
1. Greet politely and identify the visitor (name, who they're visiting, purpose).
2. Be concise — the visitor is standing at a door waiting.
3. If visitor provides sufficient info (name + destination), suggest granting access.
4. If info is insufficient or suspicious, suggest transferring to human operator.
5. In emergencies (ambulance, fire, police), authorize immediate access.
6. Never reveal internal building info (resident names, codes).
7. Respond in the visitor's language (Spanish by default).
8. Keep responses under 50 words to minimize TTS latency.

RESPONSE FORMAT:
Respond in JSON with this structure:
{
  "text": "Your spoken response to the visitor",
  "action": "continue | grant_access | deny_access | handoff",
  "confidence": 0.0-1.0,
  "collectedInfo": {
    "visitorName": "name if provided",
    "visitorDestination": "apartment/office if provided",
    "visitorPurpose": "purpose if provided"
  }
}`;

// ── Agent Implementation ──────────────────────────────────

export class AionIntercomAgent implements AionAgentContract {
  private logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };

  constructor() {
    this.logger = {
      info: (...args: unknown[]) => logger.info(args[0] as string),
      warn: (...args: unknown[]) => logger.warn(args[0] as string),
      error: (...args: unknown[]) => logger.error({ err: args[1] }, args[0] as string),
    };
  }

  async processVisitorInput(
    transcribedText: string,
    callContext: CallSessionContext,
  ): Promise<AgentResponse> {
    this.logger.info(`Processing visitor input: "${transcribedText.slice(0, 100)}" (call ${callContext.callId})`);

    // Select system prompt based on site language context
    // Use English prompt if the site name suggests English context, otherwise Spanish
    const systemPrompt = callContext.siteName?.match(/^[a-zA-Z\s]+$/)
      ? INTERCOM_SYSTEM_PROMPT_EN
      : INTERCOM_SYSTEM_PROMPT;

    const userMessage = this.buildContextualPrompt(transcribedText, callContext);

    try {
      // Use ai-bridge module for AI processing
      // In production, this calls OpenAI/Anthropic via the existing ai-bridge service
      const aiResponse = await this.callAIBridge(systemPrompt, userMessage);
      return this.parseAgentResponse(aiResponse);
    } catch (err) {
      this.logger.error('AI processing failed:', err);
      // Fallback: hand off to human
      return {
        text: 'Un momento por favor, lo comunico con el operador.',
        action: 'handoff',
        confidence: 0,
      };
    }
  }

  async evaluateAccess(
    visitorInfo: { name?: string; destination?: string; purpose?: string },
    callContext: CallSessionContext,
  ): Promise<AccessDecision> {
    const hasName = !!visitorInfo.name?.trim();
    const hasDestination = !!visitorInfo.destination?.trim();
    const hasPurpose = !!visitorInfo.purpose?.trim();

    // Simple rule-based evaluation (AI-augmented in production)
    if (hasName && hasDestination) {
      return {
        granted: true,
        confidence: hasPurpose ? 0.85 : 0.7,
        reason: `Visitor ${visitorInfo.name} identified for ${visitorInfo.destination}`,
        requiresHumanConfirmation: !hasPurpose,
      };
    }

    if (callContext.isAfterHours) {
      return {
        granted: false,
        confidence: 0.9,
        reason: 'After hours — insufficient identification',
        requiresHumanConfirmation: true,
      };
    }

    return {
      granted: false,
      confidence: 0.5,
      reason: 'Insufficient visitor information collected',
      requiresHumanConfirmation: true,
    };
  }

  async shouldHandoff(
    conversationHistory: ConversationTurn[],
    callContext: CallSessionContext,
  ): Promise<HandoffDecision> {
    const turnCount = conversationHistory.length;
    const visitorTurns = conversationHistory.filter(t => t.role === 'visitor').length;

    // Handoff if too many turns without resolution
    if (turnCount > 6) {
      return {
        shouldHandoff: true,
        reason: 'Conversation exceeded maximum AI turns without resolution',
        urgency: 'medium',
      };
    }

    // Handoff if visitor explicitly requests human
    const lastVisitorTurn = [...conversationHistory].reverse().find(t => t.role === 'visitor');
    if (lastVisitorTurn) {
      const humanKeywords = ['operador', 'persona', 'humano', 'operator', 'human', 'person', 'ayuda', 'help'];
      const requestsHuman = humanKeywords.some(kw => lastVisitorTurn.text.toLowerCase().includes(kw));
      if (requestsHuman) {
        return {
          shouldHandoff: true,
          reason: 'Visitor requested human operator',
          urgency: 'high',
        };
      }
    }

    // Handoff if after hours and no clear resolution
    if (callContext.isAfterHours && visitorTurns >= 2) {
      return {
        shouldHandoff: true,
        reason: 'After hours — extended conversation without resolution',
        urgency: 'low',
      };
    }

    return {
      shouldHandoff: false,
      reason: 'Conversation progressing normally',
      urgency: 'low',
    };
  }

  // ── Voice Integration ───────────────────────────────────

  getVoiceIntegration(): VoiceIntegrationContract {
    return {
      synthesizeGreeting: async (context, language, siteName, voiceId) => {
        const result = await voiceService.generateGreeting({
          context: context as any,
          language: language as 'es' | 'en',
          siteName,
          voiceId,
        });
        return { audio: result.audio, contentType: result.contentType, text: result.text };
      },

      synthesizeCallMessage: async (message, mode, voiceId) => {
        const result = await voiceService.synthesizeCallMessage({
          message,
          mode,
          voiceId,
        });
        return { audio: result.audio, contentType: result.contentType };
      },

      synthesizeAgentResponse: async (text, voiceId) => {
        const result = await voiceService.synthesizeAgentResponse(text, voiceId);
        return { audio: result.audio, contentType: result.contentType };
      },
    };
  }

  // ── Private Helpers ─────────────────────────────────────

  private buildContextualPrompt(visitorText: string, ctx: CallSessionContext): string {
    const contextLines = [
      `Sitio: ${ctx.siteName || 'Edificio'}`,
      `Zona: ${ctx.sectionName || 'Entrada principal'}`,
      `Hora: ${ctx.timeOfDay}`,
      ctx.isAfterHours ? 'FUERA DE HORARIO' : 'Horario normal',
      `Turno de conversación: ${ctx.conversationTurns + 1}`,
    ];

    return `[Contexto: ${contextLines.join(' | ')}]\n\nVisitante dice: "${visitorText}"`;
  }

  private async callAIBridge(systemPrompt: string, userMessage: string): Promise<string> {
    // Check if an AI provider key is available
    if (!config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY) {
      this.logger.warn('AI Bridge not connected — returning fallback response. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
      return JSON.stringify({
        text: 'Bienvenido. ¿Con quién desea comunicarse? Por favor indique su nombre y el apartamento o persona que visita.',
        action: 'continue',
        confidence: 1.0,
        collectedInfo: {},
      });
    }

    // Call the real AI bridge service with intercom-specific parameters
    const result = await aiBridgeService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4, // Lower temperature for consistent, deterministic responses
        maxTokens: 256,   // Short responses for intercom TTS latency
      },
      'system',          // tenantId — system-level usage for intercom agent
      'aion-intercom',   // userId — identifies intercom agent usage
    );

    this.logger.info(`AI response received: provider=${result.provider}, model=${result.model}, tokens=${result.tokens.prompt + result.tokens.completion}`);
    return result.content;
  }

  private parseAgentResponse(raw: string): AgentResponse {
    try {
      // First try direct JSON parse
      const parsed = JSON.parse(raw);
      return this.normalizeAgentResponse(parsed);
    } catch {
      // AI may have wrapped JSON in markdown code fences or included preamble text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.normalizeAgentResponse(parsed);
        } catch {
          // Fall through to plain text handling
        }
      }

      // If AI returned plain text instead of JSON
      this.logger.warn('AI returned non-JSON response, using as plain text');
      return {
        text: raw.slice(0, 200),
        action: 'continue',
        confidence: 0.5,
      };
    }
  }

  private normalizeAgentResponse(parsed: Record<string, unknown>): AgentResponse {
    const validActions = ['continue', 'grant_access', 'deny_access', 'handoff'] as const;
    const action = validActions.includes(parsed.action as any)
      ? (parsed.action as AgentResponse['action'])
      : 'continue';

    return {
      text: typeof parsed.text === 'string' ? parsed.text : 'Un momento por favor.',
      action,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      collectedInfo: parsed.collectedInfo as AgentResponse['collectedInfo'],
    };
  }
}

export const aionIntercomAgent = new AionIntercomAgent();
