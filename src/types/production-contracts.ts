// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Production Contracts
// Shared interfaces for Backend API + Edge Gateway
// ═══════════════════════════════════════════════════════════

// ── Device Adapter Interfaces ─────────────────────────────

export interface IDeviceAdapter {
  readonly brand: string;
  readonly supportedProtocols: string[];
  connect(config: DeviceConnectionConfig): Promise<ConnectionResult>;
  disconnect(deviceId: string): Promise<void>;
  testConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult>;
}

export interface IDiscoveryAdapter {
  discover(networkRange: string, timeout?: number): Promise<DiscoveredDevice[]>;
  identify(ip: string, port: number): Promise<DeviceIdentity | null>;
}

export interface IStreamAdapter {
  getStreams(deviceId: string): Promise<StreamProfile[]>;
  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string;
  registerStream(deviceId: string, profile: StreamProfile): Promise<void>;
  getStreamState(deviceId: string): StreamState;
}

export interface IPlaybackAdapter {
  search(params: PlaybackSearchParams): Promise<PlaybackSegment[]>;
  startPlayback(params: PlaybackStartParams): Promise<PlaybackSession>;
  exportClip(params: ClipExportParams): Promise<ExportJob>;
  getSnapshot(deviceId: string, timestamp: Date, channel?: number): Promise<Buffer>;
}

export interface IEventAdapter {
  subscribe(deviceId: string, callback: (event: DeviceEventPayload) => void): Promise<Unsubscribe>;
  getEventTypes(deviceId: string): Promise<string[]>;
}

export interface IPTZAdapter {
  sendCommand(deviceId: string, command: PTZCommand): Promise<void>;
  getPresets(deviceId: string): Promise<PTZPreset[]>;
  setPreset(deviceId: string, preset: PTZPreset): Promise<void>;
  startPatrol(deviceId: string, patrolId: number): Promise<void>;
  stopPatrol(deviceId: string): Promise<void>;
}

export interface IConfigAdapter {
  getCapabilities(deviceId: string): Promise<DeviceCapabilities>;
  getSystemInfo(deviceId: string): Promise<DeviceSystemInfo>;
  setConfig(deviceId: string, config: Record<string, unknown>): Promise<void>;
}

export interface IHealthAdapter {
  getHealth(deviceId: string): Promise<DeviceHealthReport>;
  ping(ip: string, port: number): Promise<{ reachable: boolean; latencyMs: number }>;
}

// ── Domotic Interfaces ────────────────────────────────────

export interface IDomoticConnector {
  readonly provider: string;
  connect(config: DomoticConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  listDevices(): Promise<DomoticDeviceState[]>;
  executeAction(deviceId: string, action: DomoticAction): Promise<DomoticActionResult>;
  getDeviceState(deviceId: string): Promise<DomoticDeviceState>;
  subscribe(callback: (event: DomoticEvent) => void): Promise<Unsubscribe>;
}

export interface IDomoticDeviceService {
  list(tenantId: string, sectionId?: string): Promise<DomoticDeviceState[]>;
  sync(tenantId: string): Promise<SyncResult>;
  getHealth(tenantId: string): Promise<DomoticHealthReport>;
}

export interface IDomoticActionService {
  execute(tenantId: string, deviceId: string, action: DomoticAction, userId: string): Promise<DomoticActionResult>;
  getHistory(tenantId: string, deviceId?: string, limit?: number): Promise<DomoticActionLog[]>;
}

// ── Access Control Interfaces ─────────────────────────────

export interface IAccessControlConnector {
  readonly provider: string;
  connect(config: AccessControlConfig): Promise<void>;
  syncPeople(people: AccessPerson[]): Promise<SyncResult>;
  grantAccess(personId: string, doorId: string): Promise<void>;
  revokeAccess(personId: string, doorId: string): Promise<void>;
  getAccessLog(from: Date, to: Date): Promise<AccessLogEntry[]>;
}

export interface ICredentialService {
  register(personId: string, credential: AccessCredential): Promise<void>;
  revoke(credentialId: string): Promise<void>;
  validate(credential: AccessCredential): Promise<ValidationResult>;
  list(personId: string): Promise<AccessCredential[]>;
}

export interface IAccessEventService {
  log(entry: AccessLogEntry): Promise<void>;
  query(params: AccessLogQuery): Promise<AccessLogEntry[]>;
  getReport(params: AccessReportParams): Promise<AccessReport>;
}

export interface IPersonRegistryService {
  create(person: AccessPerson): Promise<AccessPerson>;
  update(id: string, updates: Partial<AccessPerson>): Promise<AccessPerson>;
  delete(id: string): Promise<void>;
  search(query: string, sectionId?: string): Promise<AccessPerson[]>;
  getWithVehicles(id: string): Promise<AccessPersonWithVehicles>;
}

export interface IVehicleRegistryService {
  create(vehicle: AccessVehicle): Promise<AccessVehicle>;
  update(id: string, updates: Partial<AccessVehicle>): Promise<AccessVehicle>;
  delete(id: string): Promise<void>;
  findByPlate(plate: string): Promise<AccessVehicle | null>;
  listByPerson(personId: string): Promise<AccessVehicle[]>;
}

// ── Intercom Interfaces ───────────────────────────────────

export interface IIntercomConnector {
  readonly provider: string;
  connect(config: IntercomConfig): Promise<void>;
  initiateCall(deviceId: string): Promise<CallSession>;
  endCall(sessionId: string): Promise<void>;
  getDeviceStatus(deviceId: string): Promise<IntercomDeviceStatus>;
}

export interface ICallSessionService {
  create(params: CallInitParams): Promise<CallSession>;
  end(sessionId: string, notes?: string): Promise<void>;
  transfer(sessionId: string, target: string): Promise<void>;
  getHistory(params: CallHistoryQuery): Promise<CallSession[]>;
}

export interface IVoiceAgentService {
  startSession(config: VoiceAgentConfig): Promise<VoiceSession>;
  processInput(sessionId: string, audio: Buffer): Promise<VoiceResponse>;
  endSession(sessionId: string): Promise<void>;
  getWelcomeMessage(sectionId: string): Promise<string>;
  setWelcomeMessage(sectionId: string, message: string): Promise<void>;
}

export interface IWelcomeMessageService {
  get(sectionId: string): Promise<WelcomeMessage>;
  set(sectionId: string, message: WelcomeMessage): Promise<void>;
  generateAudio(text: string, voice?: string): Promise<Buffer>;
}

// ── AI Interfaces ─────────────────────────────────────────

export interface IAIProvider {
  readonly name: string;
  readonly models: string[];
  chat(params: AIChatParams): Promise<AIChatResponse>;
  chatStream(params: AIChatParams): AsyncIterable<AIChatChunk>;
  structuredOutput<T>(params: AIStructuredParams<T>): Promise<T>;
}

export interface IPromptRegistry {
  get(key: string, version?: string): PromptTemplate;
  register(key: string, template: PromptTemplate): void;
  list(): PromptTemplate[];
}

export interface IAIGovernance {
  checkRateLimit(tenantId: string): Promise<boolean>;
  logUsage(tenantId: string, usage: AIUsageRecord): Promise<void>;
  getUsage(tenantId: string, period: string): Promise<AIUsageSummary>;
  getSettings(tenantId: string): Promise<AIGovernanceSettings>;
}

// ── MCP Interfaces ────────────────────────────────────────

export interface IMCPConnector {
  readonly type: string;
  readonly tools: MCPTool[];
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<MCPHealthResult>;
  executeTool(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult>;
}

export interface IMCPToolRegistry {
  register(connector: IMCPConnector): void;
  unregister(connectorId: string): void;
  list(tenantId: string): MCPTool[];
  get(toolName: string): MCPTool | null;
}

export interface IMCPExecutor {
  execute(tenantId: string, toolName: string, params: Record<string, unknown>): Promise<MCPToolResult>;
  getLog(tenantId: string, limit?: number): Promise<MCPExecutionLog[]>;
}

// ── WhatsApp Interfaces ───────────────────────────────────

export interface IWhatsAppService {
  sendMessage(params: WhatsAppMessage): Promise<WhatsAppResult>;
  sendTemplate(params: WhatsAppTemplateMessage): Promise<WhatsAppResult>;
  processInbound(payload: WhatsAppInbound): Promise<void>;
  getThreads(tenantId: string): Promise<WhatsAppThread[]>;
}

// ── Data Types ────────────────────────────────────────────

export type Unsubscribe = () => void;

export type StreamState = 'idle' | 'connecting' | 'live' | 'degraded' | 'reconnecting' | 'failed' | 'unauthorized' | 'unavailable';

export interface DeviceConnectionConfig {
  ip: string;
  port: number;
  username: string;
  password: string;
  brand: string;
  protocol?: string;
}

export interface ConnectionResult { success: boolean; message: string; sessionId?: string }
export interface ConnectionTestResult { success: boolean; message: string; latencyMs: number; capabilities?: DeviceCapabilities }
export interface DiscoveredDevice { ip: string; port: number; brand: string; model: string; serial?: string; mac?: string; protocols: string[] }
export interface DeviceIdentity { brand: string; model: string; serial: string; firmware: string }
export interface StreamProfile { type: 'main' | 'sub' | 'third'; url: string; codec: string; resolution: string; fps: number; bitrate?: number }
export interface PlaybackSearchParams { deviceId: string; channel: number; startTime: Date; endTime: Date; eventType?: string }
export interface PlaybackSegment { startTime: Date; endTime: Date; type: 'continuous' | 'motion' | 'alarm'; sizeBytes?: number }
export interface PlaybackStartParams { deviceId: string; channel: number; startTime: Date; speed?: number }
export interface PlaybackSession { sessionId: string; streamUrl: string }
export interface ClipExportParams { deviceId: string; channel: number; startTime: Date; endTime: Date; format?: string }
export interface ExportJob { jobId: string; status: 'pending' | 'processing' | 'ready' | 'failed'; outputUrl?: string }
export interface DeviceEventPayload { deviceId: string; eventType: string; severity: string; channel?: number; timestamp: Date; metadata: Record<string, unknown> }
export interface PTZCommand { action: string; speed?: number; presetId?: number }
export interface PTZPreset { id: number; name: string; position?: { pan: number; tilt: number; zoom: number } }
export interface DeviceCapabilities { ptz: boolean; audio: boolean; smartEvents: boolean; anpr: boolean; faceDetection: boolean; channels: number; codecs: string[]; maxResolution: string }
export interface DeviceSystemInfo { firmware: string; uptime: number; storage?: { total: number; used: number }; network?: Record<string, unknown> }
export interface DeviceHealthReport { online: boolean; latencyMs: number; cpuUsage?: number; memoryUsage?: number; storageUsage?: number; errors: string[] }

export interface DomoticConnectionConfig { provider: string; apiKey?: string; endpoint?: string; credentials?: Record<string, string> }
export interface DomoticDeviceState { id: string; name: string; type: string; state: 'on' | 'off' | 'unknown'; online: boolean; lastSync?: Date }
export interface DomoticAction { type: 'on' | 'off' | 'toggle' | 'pulse'; duration?: number }
export interface DomoticActionResult { success: boolean; newState: string; message?: string; executionMs: number }
export interface DomoticEvent { deviceId: string; type: string; oldState: string; newState: string; timestamp: Date }
export interface DomoticActionLog { id: string; deviceId: string; action: string; result: string; userId: string; timestamp: Date }
export interface DomoticHealthReport { totalDevices: number; onlineDevices: number; errorDevices: number; lastSync: Date }
export interface SyncResult { synced: number; added: number; removed: number; errors: string[] }

export interface AccessPerson { id: string; fullName: string; type: 'resident' | 'visitor' | 'staff' | 'contractor'; sectionId?: string; unit?: string; documentId?: string; phone?: string; email?: string; photoUrl?: string; status: 'active' | 'inactive' | 'suspended' }
export interface AccessPersonWithVehicles extends AccessPerson { vehicles: AccessVehicle[] }
export interface AccessVehicle { id: string; plate: string; personId?: string; brand?: string; model?: string; color?: string; type: 'car' | 'motorcycle' | 'truck' | 'bicycle' }
export interface AccessCredential { id?: string; type: 'card' | 'tag' | 'biometric' | 'facial' | 'plate' | 'pin'; value: string; isActive: boolean; expiresAt?: Date }
export interface AccessLogEntry { id?: string; personId?: string; vehicleId?: string; sectionId?: string; direction: 'in' | 'out'; method: string; operatorId?: string; notes?: string; timestamp: Date }
export interface AccessLogQuery { sectionId?: string; personId?: string; from: Date; to: Date; direction?: string; limit?: number }
export interface AccessReportParams { sectionId?: string; period: 'daily' | 'weekly' | 'biweekly' | 'monthly'; from: Date; to: Date }
export interface AccessReport { period: string; totalEntries: number; totalExits: number; uniquePersons: number; byMethod: Record<string, number>; bySection: Record<string, number> }
export interface AccessControlConfig { provider: string; endpoint: string; apiKey?: string }
export interface ValidationResult { valid: boolean; message?: string }

export interface IntercomConfig { provider: string; sipServer?: string; credentials?: Record<string, string> }
export interface IntercomDeviceStatus { online: boolean; inCall: boolean; lastActivity?: Date }
export interface CallInitParams { deviceId: string; sectionId?: string; mode: 'human' | 'ai' | 'mixed' }
export interface CallSession { id: string; deviceId: string; status: 'ringing' | 'active' | 'ended' | 'missed'; startTime: Date; endTime?: Date; durationSeconds?: number; attendedBy: string; notes?: string }
export interface CallHistoryQuery { sectionId?: string; deviceId?: string; from: Date; to: Date; status?: string }
export interface VoiceAgentConfig { language: string; voice: string; welcomeMessage: string; context: Record<string, unknown> }
export interface VoiceSession { id: string; status: 'active' | 'ended' }
export interface VoiceResponse { text: string; audio?: Buffer; shouldTransfer: boolean; confidence: number }
export interface WelcomeMessage { text: string; audioUrl?: string; voice: string; language: string }

export interface AIChatParams { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number; maxTokens?: number; stream?: boolean }
export interface AIChatResponse { content: string; model: string; tokens: { prompt: number; completion: number }; finishReason: string }
export interface AIChatChunk { content: string; done: boolean }
export interface AIStructuredParams<T> { prompt: string; schema: Record<string, unknown>; model?: string }
export interface PromptTemplate { key: string; version: string; systemPrompt: string; userTemplate: string; variables: string[] }
export interface AIUsageRecord { provider: string; model: string; tokens: number; cost: number; context: string }
export interface AIUsageSummary { totalTokens: number; totalCost: number; byProvider: Record<string, number>; byContext: Record<string, number> }
export interface AIGovernanceSettings { maxTokensPerRequest: number; maxRequestsPerMinute: number; allowedProviders: string[]; allowedModels: string[] }

export interface MCPTool { name: string; description: string; inputSchema: Record<string, unknown>; connectorId: string }
export interface MCPHealthResult { healthy: boolean; latencyMs: number; errorCount: number; lastCheck: Date }
export interface MCPToolResult { success: boolean; data?: unknown; error?: string; executionMs: number }
export interface MCPExecutionLog { id: string; toolName: string; params: Record<string, unknown>; result: MCPToolResult; userId: string; timestamp: Date }

export interface WhatsAppMessage { to: string; body: string; mediaUrl?: string }
export interface WhatsAppTemplateMessage { to: string; templateName: string; parameters: string[] }
export interface WhatsAppResult { messageId: string; status: string }
export interface WhatsAppInbound { from: string; body: string; timestamp: Date; mediaUrl?: string }
export interface WhatsAppThread { id: string; contact: string; lastMessage: string; lastTimestamp: Date; unreadCount: number }
