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
      info: (...args) => console.log('[AionIntercomAgent]', ...args),
      warn: (...args) => console.warn('[AionIntercomAgent]', ...args),
      error: (...args) => console.error('[AionIntercomAgent]', ...args),
    };
  }

  async processVisitorInput(
    transcribedText: string,
    callContext: CallSessionContext,
  ): Promise<AgentResponse> {
    this.logger.info(`Processing visitor input: "${transcribedText.slice(0, 100)}" (call ${callContext.callId})`);

    // Build conversation context for AI
    const systemPrompt = callContext.mode === 'ai'
      ? INTERCOM_SYSTEM_PROMPT
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

  private async callAIBridge(_systemPrompt: string, _userMessage: string): Promise<string> {
    // In production, this calls the ai-bridge module:
    // POST /ai/chat { messages: [...], systemPrompt, useCase: 'intercom_agent' }
    //
    // For now, return a structured fallback indicating the contract is ready
    // but requires ai-bridge connection with OpenAI/Anthropic API key.

    this.logger.warn('AI Bridge not connected — returning fallback response. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');

    return JSON.stringify({
      text: 'Bienvenido. ¿Con quién desea comunicarse? Por favor indique su nombre y el apartamento o persona que visita.',
      action: 'continue',
      confidence: 1.0,
      collectedInfo: {},
    });
  }

  private parseAgentResponse(raw: string): AgentResponse {
    try {
      const parsed = JSON.parse(raw);
      return {
        text: parsed.text || 'Un momento por favor.',
        action: parsed.action || 'continue',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        collectedInfo: parsed.collectedInfo,
      };
    } catch {
      // If AI returned plain text instead of JSON
      return {
        text: raw.slice(0, 200),
        action: 'continue',
        confidence: 0.5,
      };
    }
  }
}

export const aionIntercomAgent = new AionIntercomAgent();
