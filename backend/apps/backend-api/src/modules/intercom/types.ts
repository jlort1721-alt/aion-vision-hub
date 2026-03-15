/**
 * Intercom & VoIP Type Definitions
 *
 * Core contracts for SIP/VoIP abstraction, intercom connectors,
 * call session management, and welcome message orchestration.
 */

// ── SIP/VoIP Provider Abstraction ─────────────────────────

export type SipTransport = 'udp' | 'tcp' | 'tls' | 'wss';

export interface SipServerConfig {
  host: string;
  port: number;
  transport: SipTransport;
  domain: string;
  /** SIP proxy (if different from registrar) */
  outboundProxy?: string;
  /** Enable SRTP for encrypted media */
  srtp?: boolean;
  /** STUN server for NAT traversal */
  stunServer?: string;
  /** TURN server for NAT traversal */
  turnServer?: string;
  turnUsername?: string;
  turnPassword?: string;
}

export interface SipCredentials {
  username: string;
  password: string;
  authRealm?: string;
  displayName?: string;
}

export interface SipRegistration {
  uri: string;
  registered: boolean;
  expiresIn?: number;
  registeredAt?: Date;
  error?: string;
}

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'initiating' | 'ringing' | 'answered' | 'on_hold' | 'completed' | 'missed' | 'rejected' | 'failed' | 'busy';
export type CallMode = 'ai' | 'human' | 'mixed';

export interface CallSession {
  id: string;
  tenantId: string;
  deviceId?: string;
  sectionId?: string;
  direction: CallDirection;
  status: CallStatus;
  mode: CallMode;
  /** SIP Call-ID header */
  sipCallId?: string;
  /** Caller SIP URI or extension */
  callerUri: string;
  /** Callee SIP URI or extension */
  calleeUri: string;
  /** Operator who answered (human or 'aion-agent') */
  attendedBy?: string;
  /** Start time */
  startedAt: Date;
  /** When call was answered */
  answeredAt?: Date;
  /** When call ended */
  endedAt?: Date;
  /** Duration in seconds */
  durationSeconds?: number;
  /** Audio recording URL (if enabled) */
  recordingUrl?: string;
  /** AI greeting text that was played */
  greetingText?: string;
  /** Whether AI handoff to human occurred */
  handoffOccurred?: boolean;
  /** Handoff reason */
  handoffReason?: string;
  /** DTMF digits collected */
  dtmfCollected?: string;
  /** Visitor name (collected by AI or operator) */
  visitorName?: string;
  /** Visitor unit/apartment (for residential) */
  visitorDestination?: string;
  /** Door/gate open command sent */
  accessGranted?: boolean;
  /** Notes */
  notes?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface CallSessionSummary {
  id: string;
  deviceName?: string;
  direction: CallDirection;
  status: CallStatus;
  mode: CallMode;
  attendedBy?: string;
  durationSeconds?: number;
  visitorName?: string;
  accessGranted?: boolean;
  startedAt: Date;
}

// ── SIP Provider Contract ─────────────────────────────────

export interface SipProvider {
  readonly name: string;

  /** Check if provider is configured */
  isConfigured(): boolean;

  /** Register SIP endpoint with server */
  register(credentials: SipCredentials): Promise<SipRegistration>;

  /** Unregister SIP endpoint */
  unregister(): Promise<void>;

  /** Initiate outbound call */
  initiateCall(request: InitiateCallRequest): Promise<InitiateCallResult>;

  /** Answer inbound call */
  answerCall(callId: string): Promise<void>;

  /** Hang up active call */
  hangupCall(callId: string): Promise<void>;

  /** Send DTMF tone */
  sendDtmf(callId: string, digit: string): Promise<void>;

  /** Hold/unhold */
  holdCall(callId: string, hold: boolean): Promise<void>;

  /** Transfer call to another extension */
  transferCall(callId: string, targetUri: string): Promise<void>;

  /** Inject audio stream into active call (for AI TTS) */
  injectAudio(callId: string, audioBuffer: Buffer, format: string): Promise<void>;

  /** Health check */
  healthCheck(): Promise<SipHealthCheck>;

  /** Get active calls */
  getActiveCalls(): CallSession[];
}

export interface InitiateCallRequest {
  targetUri: string;
  sourceUri?: string;
  autoAnswer?: boolean;
  priority?: 'normal' | 'emergency';
  /** Pre-synthesized audio to play on answer */
  greetingAudio?: Buffer;
  greetingFormat?: string;
  /** Headers to add to SIP INVITE */
  extraHeaders?: Record<string, string>;
}

export interface InitiateCallResult {
  success: boolean;
  callId?: string;
  sipCallId?: string;
  error?: string;
  errorCode?: number;
}

export interface SipHealthCheck {
  provider: string;
  configured: boolean;
  status: 'connected' | 'registered' | 'error' | 'not_configured';
  message: string;
  latencyMs: number;
  registrations?: SipRegistration[];
  activeCalls?: number;
  transport?: SipTransport;
  sipServer?: string;
}

// ── Intercom Connector Abstraction ────────────────────────

export type IntercomBrand = 'fanvil' | 'hikvision' | 'dahua' | 'akuvox' | 'generic_sip';

export interface IntercomConnector {
  readonly brand: IntercomBrand;
  readonly displayName: string;

  /** Test device reachability (HTTP ping + SIP OPTIONS) */
  testDevice(ipAddress: string, config?: Record<string, unknown>): Promise<DeviceTestResult>;

  /** Provision SIP account on device */
  provisionSipAccount(ipAddress: string, sipConfig: DeviceSipProvision): Promise<ProvisionResult>;

  /** Get device info (model, firmware, status) */
  getDeviceInfo(ipAddress: string, credentials?: DeviceCredentials): Promise<IntercomDeviceInfo>;

  /** Trigger door relay (open door) */
  triggerDoorRelay(ipAddress: string, credentials?: DeviceCredentials, relayIndex?: number): Promise<DoorActionResult>;

  /** Reboot device */
  rebootDevice(ipAddress: string, credentials?: DeviceCredentials): Promise<{ success: boolean; error?: string }>;

  /** Get provisioning template for this brand */
  getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string>;

  /** Generate auto-provision URL */
  getAutoProvisionUrl(deviceIp: string, param: string, value: string): string;
}

export interface DeviceTestResult {
  reachable: boolean;
  httpReachable?: boolean;
  sipReachable?: boolean;
  latencyMs: number;
  deviceModel?: string;
  firmwareVersion?: string;
  error?: string;
}

export interface DeviceSipProvision {
  sipServer: string;
  sipPort: number;
  transport: SipTransport;
  username: string;
  password: string;
  displayName?: string;
  domain?: string;
  /** Line/account index (most devices support multiple lines) */
  lineIndex?: number;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
  requiresReboot?: boolean;
  error?: string;
}

export interface DeviceCredentials {
  username: string;
  password: string;
}

export interface IntercomDeviceInfo {
  brand: IntercomBrand;
  model: string;
  firmwareVersion: string;
  macAddress?: string;
  serialNumber?: string;
  sipRegistered?: boolean;
  relayCount?: number;
  cameraEnabled?: boolean;
  ipAddress: string;
}

export interface DoorActionResult {
  success: boolean;
  relayIndex: number;
  message: string;
  error?: string;
}

// ── Welcome Message Orchestration ─────────────────────────

export interface WelcomeOrchestrationConfig {
  mode: CallMode;
  /** AI answers first, then transfers to human if needed */
  aiGreetingEnabled: boolean;
  /** Template to use for AI greeting */
  greetingContext: 'default' | 'after_hours' | 'emergency' | 'maintenance' | 'custom';
  /** Custom greeting text (when context = 'custom') */
  customGreetingText?: string;
  /** Language for greeting */
  language: 'es' | 'en';
  /** Site name for template substitution */
  siteName?: string;
  /** Voice ID for TTS */
  voiceId?: string;
  /** Max seconds AI waits for visitor response before handoff */
  aiTimeoutSeconds: number;
  /** DTMF digit to trigger door open (e.g., '#') */
  doorOpenDtmf?: string;
  /** Auto-open door after AI collects visitor info */
  autoOpenEnabled: boolean;
  /** Operator extension to transfer to in human/mixed mode */
  operatorExtension?: string;
  /** After-hours schedule (cron or simple time range) */
  afterHoursSchedule?: string;
  /** Enable call recording */
  recordingEnabled: boolean;
}

export interface WelcomeOrchestrationResult {
  callId: string;
  mode: CallMode;
  greetingPlayed: boolean;
  greetingText?: string;
  handoffToHuman: boolean;
  handoffReason?: string;
  visitorInfo?: {
    name?: string;
    destination?: string;
    purpose?: string;
  };
  accessGranted: boolean;
  durationSeconds: number;
}

// ── Integration Contracts ─────────────────────────────────

/** Contract for ElevenLabs integration in intercom context */
export interface VoiceIntegrationContract {
  /** Synthesize greeting for intercom call */
  synthesizeGreeting(
    context: string,
    language: string,
    siteName?: string,
    voiceId?: string,
  ): Promise<{ audio: Buffer; contentType: string; text: string }>;

  /** Synthesize arbitrary message for active call */
  synthesizeCallMessage(
    message: string,
    mode: CallMode,
    voiceId?: string,
  ): Promise<{ audio: Buffer; contentType: string }>;

  /** Synthesize AION agent response */
  synthesizeAgentResponse(text: string, voiceId?: string): Promise<{ audio: Buffer; contentType: string }>;
}

/** Contract for AION AI agent in intercom context */
export interface AionAgentContract {
  /** Process visitor speech and generate response */
  processVisitorInput(
    transcribedText: string,
    callContext: CallSessionContext,
  ): Promise<AgentResponse>;

  /** Decide whether to grant access */
  evaluateAccess(
    visitorInfo: { name?: string; destination?: string; purpose?: string },
    callContext: CallSessionContext,
  ): Promise<AccessDecision>;

  /** Determine if call should be handed off to human */
  shouldHandoff(
    conversationHistory: ConversationTurn[],
    callContext: CallSessionContext,
  ): Promise<HandoffDecision>;
}

export interface CallSessionContext {
  callId: string;
  deviceId?: string;
  sectionName?: string;
  siteName?: string;
  timeOfDay: string;
  isAfterHours: boolean;
  mode: CallMode;
  conversationTurns: number;
}

export interface AgentResponse {
  text: string;
  action?: 'continue' | 'grant_access' | 'deny_access' | 'handoff';
  confidence: number;
  collectedInfo?: {
    visitorName?: string;
    visitorDestination?: string;
    visitorPurpose?: string;
  };
}

export interface AccessDecision {
  granted: boolean;
  confidence: number;
  reason: string;
  requiresHumanConfirmation: boolean;
}

export interface HandoffDecision {
  shouldHandoff: boolean;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface ConversationTurn {
  role: 'visitor' | 'agent' | 'operator';
  text: string;
  timestamp: Date;
}

// ── VoIP System Config ────────────────────────────────────

export interface VoipSystemConfig {
  sipServer: SipServerConfig;
  defaultMode: CallMode;
  welcomeOrchestration: WelcomeOrchestrationConfig;
  recording: {
    enabled: boolean;
    storageProvider: 'local' | 's3' | 'supabase';
    storagePath?: string;
    maxDurationSeconds: number;
    format: 'wav' | 'mp3' | 'ogg';
  };
  pbx: {
    type: 'asterisk' | 'freeswitch' | 'freepbx' | '3cx' | 'cloud' | 'none';
    amiHost?: string;
    amiPort?: number;
    amiUsername?: string;
    amiPassword?: string;
    ariUrl?: string;
    ariUsername?: string;
    ariPassword?: string;
  };
  fanvil: {
    defaultAdminUser: string;
    defaultAdminPassword: string;
    provisioningServerUrl?: string;
    autoProvisionEnabled: boolean;
  };
}
