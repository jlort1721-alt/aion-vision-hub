/**
 * Welcome Message Orchestration Service
 *
 * Manages the lifecycle of an intercom call:
 *   1. Inbound call arrives from intercom device
 *   2. Based on mode (ai/human/mixed), decide response
 *   3. If AI: synthesize greeting via ElevenLabs, play to caller
 *   4. If mixed: AI greets, collects info, then handoff to human
 *   5. If human: ring operator directly
 *   6. Track full session with visitor info and access decisions
 *
 * INTEGRATION POINTS:
 *   - SIP Provider: for call control (answer, play, transfer, hangup)
 *   - Voice Service: for TTS synthesis (ElevenLabs)
 *   - AI Bridge: for AION agent conversation (future)
 *   - Intercom Connectors: for door relay control
 *   - Call Sessions DB: for logging and analytics
 */

import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { callSessions, voipConfig } from '../../db/schema/call-sessions.js';
import { intercomDevices } from '../../db/schema/index.js';
import { voiceService } from '../voice/service.js';
import { AsteriskSipProvider, NoopSipProvider } from './sip-provider.js';
import { getConnector } from './connectors/index.js';
import {
  maskUrlCredentials,
  stripSensitiveFields,
  checkRateLimit,
  emitSecurityAudit,
  validateDeviceIp,
} from './security-utils.js';
import type {
  CallSession,
  CallMode,
  SipProvider,
} from './types.js';
import type {
  InitiateCallInput,
  CallSessionFilters,
  UpdateCallSessionInput,
  VoipConfigInput,
} from './schemas.js';

type Logger = { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };

class OrchestrationService {
  private sipProvider: SipProvider;
  private logger: Logger;
  private configCache: Map<string, any> = new Map();

  constructor() {
    this.logger = {
      info: (...args) => console.log('[Orchestration]', ...args),
      warn: (...args) => console.warn('[Orchestration]', ...args),
      error: (...args) => console.error('[Orchestration]', ...args),
    };

    // Initialize with NoopSipProvider — will be upgraded when config is loaded
    this.sipProvider = new NoopSipProvider();
  }

  // ── SIP Provider Management ─────────────────────────────

  async initializeSipProvider(tenantId: string): Promise<void> {
    const config = await this.getTenantVoipConfig(tenantId);

    if (config?.sipHost && config?.ariUrl) {
      this.sipProvider = new AsteriskSipProvider(
        {
          server: {
            host: config.sipHost,
            port: config.sipPort || 5060,
            transport: (config.sipTransport as any) || 'udp',
            domain: config.sipDomain || config.sipHost,
          },
          ariUrl: config.ariUrl,
          ariUsername: config.ariUsername || undefined,
          ariPassword: config.ariPassword || undefined,
        },
        this.logger,
      );
      this.logger.info(`SIP provider initialized for tenant ${tenantId}: ARI at ${maskUrlCredentials(config.ariUrl)}`);
    } else {
      this.sipProvider = new NoopSipProvider();
      this.logger.warn(`No SIP config for tenant ${tenantId} — using noop provider`);
    }
  }

  getSipProvider(): SipProvider {
    return this.sipProvider;
  }

  // ── Call Initiation ─────────────────────────────────────

  async initiateCall(input: InitiateCallInput, tenantId: string): Promise<{
    session: CallSession;
    sipResult: { success: boolean; error?: string };
    greeting?: { text: string; audioBytes: number };
  }> {
    await this.initializeSipProvider(tenantId);
    const config = await this.getTenantVoipConfig(tenantId);
    const mode = input.mode || (config?.defaultMode as CallMode) || 'mixed';

    // Create call session record
    const [session] = await db.insert(callSessions).values({
      tenantId,
      deviceId: input.deviceId || undefined,
      direction: 'outbound',
      status: 'initiating',
      mode,
      callerUri: input.sourceExtension || 'aion-operator',
      calleeUri: input.targetUri,
    }).returning();

    this.logger.info(`Call session ${session.id} created: ${mode} mode, target=${input.targetUri}`);

    // Synthesize greeting if AI or mixed mode
    let greeting: { text: string; audioBytes: number } | undefined;
    if (mode !== 'human') {
      try {
        const greetingCtx = input.greetingContext || (config?.greetingContext as any) || 'default';
        const language = (config?.greetingLanguage as 'es' | 'en') || 'es';
        const siteName = config?.customSiteName || undefined;

        const greetingResult = await voiceService.generateGreeting({
          context: greetingCtx,
          language,
          siteName,
          customText: input.customGreetingText,
          voiceId: config?.greetingVoiceId || undefined,
        });

        greeting = { text: greetingResult.text, audioBytes: greetingResult.audio.length };

        // Update session with greeting text
        await db.update(callSessions)
          .set({ greetingText: greetingResult.text })
          .where(eq(callSessions.id, session.id));

        this.logger.info(`Greeting synthesized: "${greetingResult.text.slice(0, 60)}..." (${greetingResult.audio.length} bytes)`);
      } catch (err) {
        this.logger.error('Greeting synthesis failed:', err);
      }
    }

    // Initiate SIP call
    const sipResult = await this.sipProvider.initiateCall({
      targetUri: input.targetUri,
      sourceUri: input.sourceExtension,
      autoAnswer: input.autoAnswer,
      priority: input.priority,
    });

    // Update session with SIP result
    const newStatus = sipResult.success ? 'ringing' : 'failed';
    await db.update(callSessions)
      .set({
        status: newStatus,
        sipCallId: sipResult.sipCallId || null,
      })
      .where(eq(callSessions.id, session.id));

    return {
      session: { ...session, status: newStatus, sipCallId: sipResult.sipCallId } as any,
      sipResult: { success: sipResult.success, error: sipResult.error },
      greeting,
    };
  }

  // ── Inbound Call Handler ────────────────────────────────

  async handleInboundCall(params: {
    tenantId: string;
    deviceId?: string;
    callerUri: string;
    sipCallId?: string;
  }): Promise<{
    session: CallSession;
    action: 'ai_greeting' | 'ring_operator' | 'ai_then_operator';
    greeting?: { text: string; audio: Buffer; contentType: string };
  }> {
    const config = await this.getTenantVoipConfig(params.tenantId);
    const mode = (config?.defaultMode as CallMode) || 'mixed';

    // Determine operator extension for ring
    const operatorExt = config?.operatorExtension || '100';

    // Create inbound session
    const [session] = await db.insert(callSessions).values({
      tenantId: params.tenantId,
      deviceId: params.deviceId || undefined,
      direction: 'inbound',
      status: 'ringing',
      mode,
      callerUri: params.callerUri,
      calleeUri: operatorExt,
      sipCallId: params.sipCallId || undefined,
    }).returning();

    // Decide action based on mode
    if (mode === 'human') {
      return { session: session as any, action: 'ring_operator' };
    }

    // AI or Mixed: synthesize greeting
    try {
      const greetingCtx = (config?.greetingContext as any) || 'default';
      const language = (config?.greetingLanguage as 'es' | 'en') || 'es';
      const siteName = config?.customSiteName || undefined;

      const greetingResult = await voiceService.generateGreeting({
        context: greetingCtx,
        language,
        siteName,
        voiceId: config?.greetingVoiceId || undefined,
      });

      await db.update(callSessions)
        .set({ greetingText: greetingResult.text })
        .where(eq(callSessions.id, session.id));

      return {
        session: { ...session, greetingText: greetingResult.text } as any,
        action: mode === 'ai' ? 'ai_greeting' : 'ai_then_operator',
        greeting: {
          text: greetingResult.text,
          audio: greetingResult.audio,
          contentType: greetingResult.contentType,
        },
      };
    } catch (err) {
      this.logger.error('Greeting synthesis failed, falling back to ring operator:', err);
      return { session: session as any, action: 'ring_operator' };
    }
  }

  // ── Handoff to Human ────────────────────────────────────

  async handoffToHuman(sessionId: string, tenantId: string, reason?: string): Promise<void> {
    const config = await this.getTenantVoipConfig(tenantId);
    const operatorExt = config?.operatorExtension || '100';

    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Transfer call via SIP
    if (session.sipCallId) {
      await this.sipProvider.transferCall(session.sipCallId, `sip:${operatorExt}@${config?.sipDomain || config?.sipHost || 'localhost'}`);
    }

    await db.update(callSessions)
      .set({
        handoffOccurred: true,
        handoffReason: reason || 'AI timeout or visitor request',
        mode: 'mixed',
      })
      .where(eq(callSessions.id, sessionId));

    this.logger.info(`Call ${sessionId} handed off to operator ${operatorExt}: ${reason}`);
  }

  // ── Door Relay ──────────────────────────────────────────

  async openDoor(deviceId: string, tenantId: string, relayIndex = 1): Promise<{
    success: boolean;
    message: string;
  }> {
    // Rate limit: max 5 door opens per device per 60 seconds
    const rlKey = `door-open:${tenantId}:${deviceId}`;
    const rl = checkRateLimit(rlKey, 5, 60_000);
    if (!rl.allowed) {
      emitSecurityAudit({ event: 'door.open.rate_limited', tenantId, deviceId, detail: `Retry after ${rl.retryAfterMs}ms` });
      return { success: false, message: `Rate limit exceeded. Try again in ${Math.ceil((rl.retryAfterMs || 0) / 1000)}s.` };
    }

    const [device] = await db.select().from(intercomDevices)
      .where(and(eq(intercomDevices.id, deviceId), eq(intercomDevices.tenantId, tenantId)))
      .limit(1);

    if (!device) throw new Error(`Device ${deviceId} not found`);
    if (!device.ipAddress) throw new Error(`Device ${deviceId} has no IP address configured`);

    const ipCheck = validateDeviceIp(device.ipAddress);
    if (!ipCheck.valid) {
      return { success: false, message: `Invalid device IP: ${ipCheck.reason}` };
    }

    const connector = getConnector(device.brand || 'fanvil');
    const deviceConfig = (device.config as Record<string, unknown>) || {};
    // No fallback to 'admin' — credentials must be explicitly configured
    const creds = deviceConfig.adminUser && deviceConfig.adminPassword
      ? { username: deviceConfig.adminUser as string, password: deviceConfig.adminPassword as string }
      : undefined;

    const result = await connector.triggerDoorRelay(device.ipAddress, creds, relayIndex);

    emitSecurityAudit({
      event: result.success ? 'door.open' : 'door.open.denied',
      tenantId,
      deviceId,
      detail: `Relay ${relayIndex} on ${device.name}: ${result.success ? 'OK' : result.error || 'failed'}`,
    });

    this.logger.info(`Door relay ${relayIndex} on ${device.name}: ${result.success ? 'OK' : 'FAILED'}`);
    return { success: result.success, message: result.message };
  }

  // ── Call Session CRUD ───────────────────────────────────

  async listSessions(tenantId: string, filters?: CallSessionFilters) {
    const conditions = [eq(callSessions.tenantId, tenantId)];
    if (filters?.deviceId) conditions.push(eq(callSessions.deviceId, filters.deviceId));
    if (filters?.sectionId) conditions.push(eq(callSessions.sectionId, filters.sectionId));
    if (filters?.direction) conditions.push(eq(callSessions.direction, filters.direction));
    if (filters?.status) conditions.push(eq(callSessions.status, filters.status));
    if (filters?.mode) conditions.push(eq(callSessions.mode, filters.mode));
    if (filters?.from) conditions.push(gte(callSessions.startedAt, new Date(filters.from)));
    if (filters?.to) conditions.push(lte(callSessions.startedAt, new Date(filters.to)));

    return db.select().from(callSessions)
      .where(and(...conditions))
      .orderBy(desc(callSessions.startedAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);
  }

  async getSession(sessionId: string, tenantId: string) {
    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) throw new Error(`Call session ${sessionId} not found`);
    return session;
  }

  async updateSession(sessionId: string, data: UpdateCallSessionInput, tenantId: string) {
    const updateData: Record<string, any> = {};

    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'answered' && !updateData.answeredAt) {
        updateData.answeredAt = new Date();
      }
      if (['completed', 'missed', 'rejected', 'failed'].includes(data.status)) {
        updateData.endedAt = new Date();
      }
    }
    if (data.attendedBy) updateData.attendedBy = data.attendedBy;
    if (data.visitorName) updateData.visitorName = data.visitorName;
    if (data.visitorDestination) updateData.visitorDestination = data.visitorDestination;
    if (data.accessGranted !== undefined) updateData.accessGranted = data.accessGranted;
    if (data.notes) updateData.notes = data.notes;
    if (data.handoffReason) {
      updateData.handoffReason = data.handoffReason;
      updateData.handoffOccurred = true;
    }

    const [session] = await db.update(callSessions)
      .set(updateData)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .returning();

    if (!session) throw new Error(`Call session ${sessionId} not found`);
    return session;
  }

  async endCall(sessionId: string, tenantId: string, notes?: string) {
    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Hang up SIP call
    if (session.sipCallId) {
      try {
        await this.sipProvider.hangupCall(session.sipCallId);
      } catch (err) {
        this.logger.warn(`Failed to hangup SIP call ${session.sipCallId}:`, err);
      }
    }

    const now = new Date();
    const durationSeconds = session.answeredAt
      ? Math.round((now.getTime() - new Date(session.answeredAt).getTime()) / 1000)
      : 0;

    const [updated] = await db.update(callSessions)
      .set({
        status: 'completed',
        endedAt: now,
        durationSeconds,
        notes: notes || session.notes,
      })
      .where(eq(callSessions.id, sessionId))
      .returning();

    return updated;
  }

  // ── Call Statistics ─────────────────────────────────────

  async getCallStats(tenantId: string, from?: string, to?: string) {
    const conditions = [eq(callSessions.tenantId, tenantId)];
    if (from) conditions.push(gte(callSessions.startedAt, new Date(from)));
    if (to) conditions.push(lte(callSessions.startedAt, new Date(to)));

    const sessions = await db.select().from(callSessions).where(and(...conditions));

    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed').length;
    const missed = sessions.filter(s => s.status === 'missed').length;
    const aiHandled = sessions.filter(s => s.mode === 'ai' && !s.handoffOccurred).length;
    const humanHandled = sessions.filter(s => s.mode === 'human' || s.handoffOccurred).length;
    const accessGranted = sessions.filter(s => s.accessGranted).length;
    const avgDuration = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / (completed || 1);

    return {
      total,
      completed,
      missed,
      failed: sessions.filter(s => s.status === 'failed').length,
      aiHandled,
      humanHandled,
      mixedHandled: sessions.filter(s => s.mode === 'mixed').length,
      handoffs: sessions.filter(s => s.handoffOccurred).length,
      accessGranted,
      accessDenied: total - accessGranted - missed,
      avgDurationSeconds: Math.round(avgDuration),
    };
  }

  // ── VoIP Config Management ─────────────────────────────

  async getTenantVoipConfig(tenantId: string) {
    const cacheKey = `voip-${tenantId}`;
    if (this.configCache.has(cacheKey)) return this.configCache.get(cacheKey);

    const [config] = await db.select().from(voipConfig)
      .where(eq(voipConfig.tenantId, tenantId))
      .limit(1);

    if (config) this.configCache.set(cacheKey, config);
    return config;
  }

  async updateTenantVoipConfig(tenantId: string, input: VoipConfigInput) {
    emitSecurityAudit({ event: 'voip.config.update', tenantId, detail: Object.keys(input).join(', ') });

    const existing = await this.getTenantVoipConfig(tenantId);

    if (existing) {
      const [config] = await db.update(voipConfig)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(voipConfig.tenantId, tenantId))
        .returning();
      this.configCache.set(`voip-${tenantId}`, config);
      // Strip credentials before returning to caller
      return stripSensitiveFields(config as Record<string, unknown>);
    }

    const [config] = await db.insert(voipConfig)
      .values({ tenantId, ...input })
      .returning();
    this.configCache.set(`voip-${tenantId}`, config);
    return stripSensitiveFields(config as Record<string, unknown>);
  }

  // ── SIP Health ──────────────────────────────────────────

  async getSipHealth(tenantId: string) {
    await this.initializeSipProvider(tenantId);
    return this.sipProvider.healthCheck();
  }

  // ── Device Management Helpers ───────────────────────────

  async testDevice(ipAddress: string, brand: string, credentials?: { username?: string; password?: string }) {
    const connector = getConnector(brand);
    return connector.testDevice(ipAddress, credentials as any);
  }

  async provisionDevice(params: {
    deviceId: string;
    tenantId: string;
    sipUsername: string;
    sipPassword: string;
    displayName?: string;
    lineIndex?: number;
  }) {
    const [device] = await db.select().from(intercomDevices)
      .where(and(eq(intercomDevices.id, params.deviceId), eq(intercomDevices.tenantId, params.tenantId)))
      .limit(1);

    if (!device) throw new Error(`Device ${params.deviceId} not found`);
    if (!device.ipAddress) throw new Error(`Device ${params.deviceId} has no IP address`);

    const config = await this.getTenantVoipConfig(params.tenantId);
    if (!config?.sipHost) throw new Error('SIP server not configured for this tenant');

    const connector = getConnector(device.brand || 'fanvil');
    const result = await connector.provisionSipAccount(device.ipAddress, {
      sipServer: config.sipHost,
      sipPort: config.sipPort || 5060,
      transport: (config.sipTransport as any) || 'udp',
      username: params.sipUsername,
      password: params.sipPassword,
      displayName: params.displayName,
      domain: config.sipDomain || config.sipHost,
      lineIndex: params.lineIndex,
    });

    // Update device SIP URI
    if (result.success) {
      const sipUri = `sip:${params.sipUsername}@${config.sipDomain || config.sipHost}`;
      await db.update(intercomDevices)
        .set({ sipUri, updatedAt: new Date() })
        .where(eq(intercomDevices.id, params.deviceId));
    }

    return result;
  }
}

export const orchestrationService = new OrchestrationService();
