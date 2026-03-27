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
import { intercomDevices, accessLogs } from '../../db/schema/index.js';
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
import { validateAccess } from './access-validator.js';
import type { VisitorInfo, AccessValidationResult } from './access-validator.js';
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

/** Active recording metadata tracked per call */
interface ActiveRecording {
  callId: string;
  sessionId: string;
  recordingName: string;
  format: string;
  startedAt: Date;
}

class OrchestrationService {
  private sipProvider: SipProvider;
  private logger: Logger;
  private configCache: Map<string, any> = new Map();
  /** Track active recordings by session ID */
  private activeRecordings: Map<string, ActiveRecording> = new Map();

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
    isAfterHours?: boolean;
  }> {
    const config = await this.getTenantVoipConfig(params.tenantId);

    // Evaluate after-hours schedule to adjust mode and greeting context
    const { mode, greetingContext, isAfterHours } = await this.resolveCallMode(params.tenantId);

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
      metadata: { isAfterHours },
    }).returning();

    // Start recording if enabled (non-blocking — do not fail the call if recording fails)
    this.startRecording(session.id, params.tenantId).catch(err => {
      this.logger.warn(`Background recording start failed for session ${session.id}:`, err);
    });

    // Decide action based on mode
    if (mode === 'human' && !isAfterHours) {
      return { session: session as any, action: 'ring_operator', isAfterHours };
    }

    // AI or Mixed: synthesize greeting
    // After-hours uses the after_hours greeting context regardless of mode
    try {
      const effectiveGreetingCtx = isAfterHours ? 'after_hours' : greetingContext;
      const language = (config?.greetingLanguage as 'es' | 'en') || 'es';
      const siteName = config?.customSiteName || undefined;

      const greetingResult = await voiceService.generateGreeting({
        context: effectiveGreetingCtx as any,
        language,
        siteName,
        voiceId: config?.greetingVoiceId || undefined,
      });

      await db.update(callSessions)
        .set({ greetingText: greetingResult.text })
        .where(eq(callSessions.id, session.id));

      // After-hours: play greeting and route to voicemail/recording (no operator ring)
      if (isAfterHours && mode === 'human') {
        return {
          session: { ...session, greetingText: greetingResult.text } as any,
          action: 'ai_greeting', // Play after-hours greeting only
          greeting: {
            text: greetingResult.text,
            audio: greetingResult.audio,
            contentType: greetingResult.contentType,
          },
          isAfterHours,
        };
      }

      return {
        session: { ...session, greetingText: greetingResult.text } as any,
        action: mode === 'ai' ? 'ai_greeting' : 'ai_then_operator',
        greeting: {
          text: greetingResult.text,
          audio: greetingResult.audio,
          contentType: greetingResult.contentType,
        },
        isAfterHours,
      };
    } catch (err) {
      this.logger.error('Greeting synthesis failed, falling back to ring operator:', err);
      return { session: session as any, action: 'ring_operator', isAfterHours };
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

  // ── Call Recording ─────────────────────────────────────

  async startRecording(sessionId: string, tenantId: string): Promise<{ recordingName: string } | null> {
    const config = await this.getTenantVoipConfig(tenantId);

    // Only record if recording is enabled for this tenant
    if (!config?.recordingEnabled) {
      this.logger.info(`Recording not enabled for tenant ${tenantId} — skipping`);
      return null;
    }

    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) {
      this.logger.warn(`Cannot start recording — session ${sessionId} not found`);
      return null;
    }

    if (!session.sipCallId) {
      this.logger.warn(`Cannot start recording — session ${sessionId} has no SIP call ID`);
      return null;
    }

    try {
      const recordingFormat = 'wav';
      const result = await this.sipProvider.startRecording(session.sipCallId, {
        name: `call-${sessionId}-${Date.now()}`,
        format: recordingFormat,
        maxDurationSeconds: 3600,
        beep: false,
      });

      // Track the active recording
      this.activeRecordings.set(sessionId, {
        callId: session.sipCallId,
        sessionId,
        recordingName: result.recordingName,
        format: recordingFormat,
        startedAt: new Date(),
      });

      this.logger.info(`Recording started for session ${sessionId}: ${result.recordingName}`);
      return { recordingName: result.recordingName };
    } catch (err) {
      this.logger.error(`Failed to start recording for session ${sessionId}:`, err);
      return null;
    }
  }

  async stopRecording(sessionId: string, tenantId: string): Promise<void> {
    const activeRec = this.activeRecordings.get(sessionId);
    if (!activeRec) {
      this.logger.info(`No active recording for session ${sessionId} — nothing to stop`);
      return;
    }

    try {
      await this.sipProvider.stopRecording(activeRec.recordingName);

      // Calculate recording duration
      const durationMs = Date.now() - activeRec.startedAt.getTime();
      const durationSeconds = Math.round(durationMs / 1000);

      // Try to get the recording URL from Asterisk
      const recordingUrl = await this.sipProvider.getRecordingUrl(activeRec.recordingName);

      // Update the call session with recording metadata
      const updateData: Record<string, any> = {};
      if (recordingUrl) {
        updateData.recordingUrl = recordingUrl;
      } else {
        // Store the recording name as a reference even without full URL
        updateData.recordingUrl = `recording:${activeRec.recordingName}.${activeRec.format}`;
      }

      // Store recording metadata in session metadata field
      updateData.metadata = {
        recording: {
          name: activeRec.recordingName,
          format: activeRec.format,
          durationSeconds,
          startedAt: activeRec.startedAt.toISOString(),
          stoppedAt: new Date().toISOString(),
        },
      };

      await db.update(callSessions)
        .set(updateData)
        .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)));

      this.activeRecordings.delete(sessionId);
      this.logger.info(`Recording stopped for session ${sessionId}: ${activeRec.recordingName} (${durationSeconds}s)`);
    } catch (err) {
      this.logger.error(`Failed to stop recording for session ${sessionId}:`, err);
      this.activeRecordings.delete(sessionId);
    }
  }

  // ── DTMF Event Handling ───────────────────────────────────

  async handleDtmfEvent(sessionId: string, tenantId: string, digit: string): Promise<{
    action: 'door_open' | 'transfer_operator' | 'collected' | 'ignored';
    detail?: string;
  }> {
    const config = await this.getTenantVoipConfig(tenantId);
    const doorOpenDtmf = config?.doorOpenDtmf || '#';

    this.logger.info(`DTMF received: digit='${digit}' on session ${sessionId}`);

    // Append digit to the session's dtmfCollected field
    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) {
      this.logger.warn(`DTMF event for unknown session ${sessionId}`);
      return { action: 'ignored', detail: 'Session not found' };
    }

    const updatedDtmf = (session.dtmfCollected || '') + digit;
    await db.update(callSessions)
      .set({ dtmfCollected: updatedDtmf })
      .where(eq(callSessions.id, sessionId));

    // Check if the digit triggers a door open
    if (digit === doorOpenDtmf) {
      this.logger.info(`DTMF door-open trigger '${digit}' on session ${sessionId}`);

      if (session.deviceId) {
        try {
          const result = await this.openDoor(session.deviceId, tenantId);
          if (result.success) {
            await db.update(callSessions)
              .set({ accessGranted: true })
              .where(eq(callSessions.id, sessionId));
            return { action: 'door_open', detail: result.message };
          }
          return { action: 'door_open', detail: `Door open failed: ${result.message}` };
        } catch (err) {
          this.logger.error(`DTMF door open failed for session ${sessionId}:`, err);
          return { action: 'door_open', detail: 'Door open command failed' };
        }
      }
      return { action: 'door_open', detail: 'No device associated with session' };
    }

    // Check if '0' triggers operator transfer
    if (digit === '0') {
      this.logger.info(`DTMF operator transfer '0' on session ${sessionId}`);
      try {
        await this.handoffToHuman(sessionId, tenantId, 'Visitor pressed 0 for operator');
        return { action: 'transfer_operator', detail: 'Transferring to operator' };
      } catch (err) {
        this.logger.error(`DTMF operator transfer failed for session ${sessionId}:`, err);
        return { action: 'transfer_operator', detail: 'Transfer failed' };
      }
    }

    return { action: 'collected', detail: `Digit '${digit}' collected. Total: ${updatedDtmf}` };
  }

  // ── After-Hours Schedule Evaluation ───────────────────────

  /**
   * Check whether the current time is outside business hours for the given tenant.
   *
   * The voipConfig `afterHoursSchedule` field supports a simple format:
   *   "HH:MM-HH:MM"           — business hours range (24h format), e.g. "08:00-18:00"
   *   "HH:MM-HH:MM|days"      — with day filter, e.g. "08:00-18:00|1-5" (Mon-Fri)
   *
   * If no schedule is configured, always returns false (assume business hours).
   */
  isAfterHours(configRow: Record<string, any> | null | undefined): boolean {
    if (!configRow) return false;

    // Use afterHoursSchedule from the voipConfig metadata if available,
    // or fall back to a convention stored in config metadata
    const schedule = (configRow.afterHoursSchedule as string)
      || ((configRow.metadata as Record<string, any>)?.afterHoursSchedule as string);

    if (!schedule || typeof schedule !== 'string') return false;

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // Parse schedule: "HH:MM-HH:MM" or "HH:MM-HH:MM|1-5"
      const parts = schedule.split('|');
      const timeRange = parts[0].trim();
      const dayRange = parts[1]?.trim();

      // Parse time range
      const timeMatch = timeRange.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        this.logger.warn(`Invalid after-hours schedule format: "${schedule}"`);
        return false;
      }

      const startHour = parseInt(timeMatch[1], 10);
      const startMin = parseInt(timeMatch[2], 10);
      const endHour = parseInt(timeMatch[3], 10);
      const endMin = parseInt(timeMatch[4], 10);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const currentMinutes = currentHour * 60 + currentMinute;

      // Check day range if specified (e.g., "1-5" = Mon-Fri)
      if (dayRange) {
        const dayMatch = dayRange.match(/^(\d)-(\d)$/);
        if (dayMatch) {
          const startDay = parseInt(dayMatch[1], 10);
          const endDay = parseInt(dayMatch[2], 10);
          // If current day is outside business days, it's after hours
          if (currentDay < startDay || currentDay > endDay) {
            return true;
          }
        }
      }

      // During business hours if time is within the range
      const isDuringBusinessHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      return !isDuringBusinessHours;
    } catch (err) {
      this.logger.error('Error evaluating after-hours schedule:', err);
      return false;
    }
  }

  /**
   * Determine the appropriate greeting context and mode adjustments
   * based on whether it's currently after hours.
   */
  async resolveCallMode(tenantId: string): Promise<{
    mode: CallMode;
    greetingContext: string;
    isAfterHours: boolean;
  }> {
    const config = await this.getTenantVoipConfig(tenantId);
    const baseMode = (config?.defaultMode as CallMode) || 'mixed';
    const afterHours = this.isAfterHours(config);

    if (afterHours) {
      this.logger.info(`After-hours detected for tenant ${tenantId}`);
      return {
        mode: baseMode === 'ai' ? 'ai' : 'mixed',
        greetingContext: 'after_hours',
        isAfterHours: true,
      };
    }

    return {
      mode: baseMode,
      greetingContext: (config?.greetingContext as string) || 'default',
      isAfterHours: false,
    };
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

    // Start recording when call transitions to 'answered' (non-blocking)
    if (data.status === 'answered') {
      this.startRecording(sessionId, tenantId).catch(err => {
        this.logger.warn(`Background recording start on answer failed for session ${sessionId}:`, err);
      });
    }

    // Stop recording when call reaches a terminal state
    if (data.status && ['completed', 'missed', 'rejected', 'failed'].includes(data.status)) {
      this.stopRecording(sessionId, tenantId).catch(err => {
        this.logger.warn(`Background recording stop failed for session ${sessionId}:`, err);
      });
    }

    return session;
  }

  async endCall(sessionId: string, tenantId: string, notes?: string) {
    const [session] = await db.select().from(callSessions)
      .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Stop any active recording before ending the call
    try {
      await this.stopRecording(sessionId, tenantId);
    } catch (err) {
      this.logger.warn(`Failed to stop recording for session ${sessionId} during endCall:`, err);
    }

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

  // ── Access Validation (Intercom → Access Control) ─────────

  /**
   * Validate visitor access during an intercom call.
   *
   * Called after the AI agent collects visitor information. Checks the
   * access_people, access_vehicles, and visitors tables to determine
   * if the visitor is authorized.
   *
   * If authorized and a deviceId is provided, attempts to open the door
   * via the device connector. If not authorized, the caller should
   * inform the visitor to wait for operator confirmation.
   */
  async validateAndProcessAccess(params: {
    sessionId: string;
    tenantId: string;
    visitorInfo: VisitorInfo;
    deviceId?: string;
    autoOpen?: boolean;
  }): Promise<{
    validation: AccessValidationResult;
    doorOpened: boolean;
    doorMessage?: string;
  }> {
    const { sessionId, tenantId, visitorInfo, deviceId, autoOpen } = params;

    // 1. Validate access
    const validation = await validateAccess(tenantId, visitorInfo);

    this.logger.info(
      `Access validation for session ${sessionId}: authorized=${validation.authorized}, rule=${validation.accessRule}, reason=${validation.reason}`,
    );

    // 2. Log the access decision
    try {
      await db.insert(accessLogs).values({
        tenantId,
        personId: validation.person?.id || null,
        vehicleId: validation.vehicle?.id || null,
        direction: 'in',
        method: 'intercom',
        notes: `Intercom call session ${sessionId}: ${validation.reason}`,
        operatorId: null,
      });
    } catch (err) {
      this.logger.error('Failed to log access decision:', err);
    }

    // 3. Update call session with access decision
    try {
      await db.update(callSessions)
        .set({
          accessGranted: validation.authorized,
          visitorName: visitorInfo.name || validation.person?.fullName || validation.visitor?.fullName || undefined,
          visitorDestination: visitorInfo.apartment || validation.person?.unit || validation.visitor?.hostUnit || undefined,
          notes: `Access: ${validation.reason} [rule: ${validation.accessRule}]`,
        })
        .where(and(eq(callSessions.id, sessionId), eq(callSessions.tenantId, tenantId)));
    } catch (err) {
      this.logger.error('Failed to update call session with access decision:', err);
    }

    // 4. If authorized and auto-open is enabled, open the door
    let doorOpened = false;
    let doorMessage: string | undefined;

    if (validation.authorized && autoOpen !== false && deviceId) {
      try {
        const result = await this.openDoor(deviceId, tenantId);
        doorOpened = result.success;
        doorMessage = result.message;
      } catch (err) {
        doorMessage = err instanceof Error ? err.message : 'Door open failed';
        this.logger.error(`Failed to open door for session ${sessionId}:`, err);
      }
    } else if (validation.authorized && !deviceId) {
      doorMessage = 'Authorized but no device configured for door relay';
    } else if (!validation.authorized) {
      doorMessage = 'Access not authorized — waiting for operator confirmation';
    }

    // 5. Emit security audit event
    emitSecurityAudit({
      event: validation.authorized ? 'intercom.access.granted' : 'intercom.access.denied',
      tenantId,
      deviceId: deviceId || undefined,
      detail: `Session ${sessionId}: ${validation.reason}`,
    });

    return { validation, doorOpened, doorMessage };
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
