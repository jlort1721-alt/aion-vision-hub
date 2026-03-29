// =====================================================================
// AION VISION HUB -- Backend API Service Layer
// All calls route through apiClient (which handles auth, retries, etc.)
// Edge Functions are accessed via apiClient.edgeFunction() for functions
// not yet migrated to the Fastify backend.
// =====================================================================

import { apiClient } from '@/lib/api-client';

// ── Devices API ────────────────────────────────────────────
export const devicesApi = {
  list: (filters?: { site_id?: string; status?: string; brand?: string }) =>
    apiClient.edgeFunction<any[]>('devices-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiClient.edgeFunction<any>('devices-api', { id }, { method: 'GET' }),

  create: (device: Record<string, unknown>) =>
    apiClient.edgeFunction<any>('devices-api', undefined, { method: 'POST', body: JSON.stringify(device) }),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.edgeFunction<any>('devices-api', { id }, { method: 'PUT', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    apiClient.edgeFunction<{ success: boolean }>('devices-api', { id }, { method: 'DELETE' }),

  testConnection: (params: { ip_address: string; brand: string; device_id?: string }) =>
    apiClient.edgeFunction<{ success: boolean; message: string; latency_ms: number }>('devices-api', { action: 'test-connection' }, { method: 'POST', body: JSON.stringify(params) }),
};

// ── Events API ─────────────────────────────────────────────
export const eventsApi = {
  list: (filters?: { severity?: string; status?: string; site_id?: string; device_id?: string; limit?: string }) =>
    apiClient.edgeFunction<any[]>('events-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiClient.edgeFunction<any>('events-api', { id }, { method: 'GET' }),

  acknowledge: (id: string) =>
    apiClient.edgeFunction<any>('events-api', { id, action: 'acknowledge' }, { method: 'POST' }),

  resolve: (id: string) =>
    apiClient.edgeFunction<any>('events-api', { id, action: 'resolve' }, { method: 'POST' }),

  dismiss: (id: string) =>
    apiClient.edgeFunction<any>('events-api', { id, action: 'dismiss' }, { method: 'POST' }),

  assign: (id: string, assignedTo: string) =>
    apiClient.edgeFunction<any>('events-api', { id, action: 'assign' }, { method: 'POST', body: JSON.stringify({ assigned_to: assignedTo }) }),

  aiSummary: (id: string) =>
    apiClient.edgeFunction<any>('events-api', { id, action: 'ai-summary' }, { method: 'POST' }),
};

// ── Incidents API ──────────────────────────────────────────
export const incidentsApi = {
  list: (filters?: { status?: string; priority?: string }) =>
    apiClient.edgeFunction<any[]>('incidents-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiClient.edgeFunction<any>('incidents-api', { id }, { method: 'GET' }),

  create: (incident: Record<string, unknown>) =>
    apiClient.edgeFunction<any>('incidents-api', undefined, { method: 'POST', body: JSON.stringify(incident) }),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.edgeFunction<any>('incidents-api', { id }, { method: 'PUT', body: JSON.stringify(updates) }),

  addComment: (id: string, content: string) =>
    apiClient.edgeFunction<any>('incidents-api', { id, action: 'comment' }, { method: 'POST', body: JSON.stringify({ content }) }),

  close: (id: string) =>
    apiClient.edgeFunction<any>('incidents-api', { id, action: 'close' }, { method: 'POST' }),

  aiSummary: (id: string) =>
    apiClient.edgeFunction<any>('incidents-api', { id, action: 'ai-summary' }, { method: 'POST' }),
};

// ── Health API ─────────────────────────────────────────────
export const healthApi = {
  check: () =>
    apiClient.edgeFunction<{ status: string; timestamp: string; checks: Array<{ component: string; status: string; latency_ms?: number; details?: Record<string, unknown> }> }>('health-api', undefined, { method: 'GET' }),
};

// ── Reports API ────────────────────────────────────────────
export const reportsApi = {
  summary: () =>
    apiClient.edgeFunction<any>('reports-api', { type: 'summary' }, { method: 'GET' }),

  events: (from?: string, to?: string) =>
    apiClient.edgeFunction<any>('reports-api', { type: 'events', ...(from && { from }), ...(to && { to }) } as Record<string, string>, { method: 'GET' }),

  incidents: (from?: string, to?: string) =>
    apiClient.edgeFunction<any>('reports-api', { type: 'incidents', ...(from && { from }), ...(to && { to }) } as Record<string, string>, { method: 'GET' }),

  devices: () =>
    apiClient.edgeFunction<any>('reports-api', { type: 'devices' }, { method: 'GET' }),
};

// ── Integrations API ───────────────────────────────────────
export const integrationsApi = {
  list: () => apiClient.edgeFunction<any[]>('integrations-api', undefined, { method: 'GET' }),
  test: (id: string) => apiClient.edgeFunction<any>('integrations-api', { id, action: 'test' }, { method: 'POST' }),
  toggle: (id: string) => apiClient.edgeFunction<any>('integrations-api', { id, action: 'toggle' }, { method: 'POST' }),
};

// ── MCP API ────────────────────────────────────────────────
export const mcpApi = {
  list: () => apiClient.edgeFunction<any[]>('mcp-api', undefined, { method: 'GET' }),
  healthCheck: (id: string) => apiClient.edgeFunction<any>('mcp-api', { id, action: 'health-check' }, { method: 'POST' }),
  toggle: (id: string) => apiClient.edgeFunction<any>('mcp-api', { id, action: 'toggle' }, { method: 'POST' }),
};

// ── Event Alerts API ──────────────────────────────────────
export const eventAlertsApi = {
  test: () => apiClient.edgeFunction<any>('event-alerts', { action: 'test' }, { method: 'POST' }),
  send: (event: { event_id: string; severity: string; title: string; event_type?: string; site_id?: string; device_id?: string }) =>
    apiClient.edgeFunction<any>('event-alerts', undefined, { method: 'POST', body: JSON.stringify(event) }),
  listRecent: () => apiClient.edgeFunction<any>('event-alerts', undefined, { method: 'GET' }),
};

// ── Email API ─────────────────────────────────────────────
export const emailApi = {
  health: () =>
    apiClient.edgeFunction<{ data: { configured: boolean; provider: string; ok: boolean; latencyMs: number; message: string } }>('email-api', undefined, { method: 'GET' }),

  test: (to?: string) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string; healthCheck: { ok: boolean; provider: string; latencyMs: number; message: string } } }>('email-api', { action: 'test' }, { method: 'POST', body: JSON.stringify({ to }) }),

  send: (msg: { to: string[]; subject: string; html?: string; text?: string; replyTo?: string; cc?: string[]; bcc?: string[]; attachments?: Array<{ filename: string; content: string; contentType: string }> }) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'send' }, { method: 'POST', body: JSON.stringify(msg) }),

  sendEventAlert: (params: { to: string[]; severity: string; eventType: string; title: string; description: string; deviceName?: string; siteName?: string; timestamp?: string; snapshotUrl?: string }) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'event-alert' }, { method: 'POST', body: JSON.stringify(params) }),

  sendIncidentReport: (params: { to: string[]; incidentId: string; title: string; status: string; priority: string; summary: string; assignedTo?: string; eventsCount?: number; createdAt?: string }) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'incident-report' }, { method: 'POST', body: JSON.stringify(params) }),

  sendPeriodicReport: (params: { to: string[]; reportName: string; period: string; totalEvents: number; criticalEvents: number; activeIncidents: number; devicesOnline: number; devicesTotal: number; topEventTypes?: Array<{ type: string; count: number }> }) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'periodic-report' }, { method: 'POST', body: JSON.stringify(params) }),

  sendEvidencePackage: (params: { to: string[]; eventId: string; eventType: string; title: string; description: string; deviceName: string; siteName: string; timestamp?: string; recipientName?: string; exportedBy: string; attachments?: Array<{ filename: string; content: string; contentType: string }> }) =>
    apiClient.edgeFunction<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'evidence-package' }, { method: 'POST', body: JSON.stringify(params) }),

  logs: (limit?: number) =>
    apiClient.edgeFunction<{ data: Array<{ id: string; provider: string; action: string; to: string[]; subject: string; success: boolean; messageId?: string; error?: string; latencyMs: number; timestamp: string }> }>('email-api', { action: 'logs', ...(limit ? { limit: String(limit) } : {}) }, { method: 'GET' }),
};

// ── WhatsApp API ──────────────────────────────────────────
export const whatsappApi = {
  // Config
  getConfig: () =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'config' }, { method: 'GET' }),
  saveConfig: (config: Record<string, unknown>) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'config' }, { method: 'PUT', body: JSON.stringify(config) }),

  // Health & Test
  health: () =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'health' }, { method: 'GET' }),
  testConnection: (to: string) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'test' }, { method: 'POST', body: JSON.stringify({ to }) }),

  // Messaging
  sendMessage: (msg: { to: string; type: string; body?: string; templateName?: string; templateLanguage?: string; templateParams?: string[]; mediaUrl?: string; caption?: string; interactive?: Record<string, unknown> }) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'send' }, { method: 'POST', body: JSON.stringify(msg) }),
  sendQuickReply: (msg: { to: string; body: string; buttons: Array<{ id: string; title: string }> }) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'quick-reply' }, { method: 'POST', body: JSON.stringify(msg) }),

  // Conversations
  listConversations: (filters?: { status?: string; phone?: string; limit?: string; offset?: string }) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'conversations', ...(filters || {}) } as Record<string, string>, { method: 'GET' }),
  getConversation: (id: string) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'conversation', id }, { method: 'GET' }),
  getMessages: (conversationId: string, limit?: number) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'messages', conversationId, ...(limit ? { limit: String(limit) } : {}) }, { method: 'GET' }),

  // Handoff & Close
  handoffToHuman: (conversationId: string, assignTo?: string, note?: string) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'handoff' }, { method: 'POST', body: JSON.stringify({ conversationId, assignTo, note }) }),
  closeConversation: (conversationId: string, resolution?: string) =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'close' }, { method: 'POST', body: JSON.stringify({ conversationId, resolution }) }),

  // Templates
  listTemplates: () =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'templates' }, { method: 'GET' }),
  syncTemplates: () =>
    apiClient.edgeFunction<any>('whatsapp-api', { action: 'sync-templates' }, { method: 'POST' }),
};

// ── Operations API ──────────────────────────────────────
export const operationsApi = {
  dashboard: () =>
    apiClient.edgeFunction<any>('operations-api', { action: 'dashboard' }, { method: 'GET' }),

  sitesStatus: () =>
    apiClient.edgeFunction<any>('operations-api', { action: 'sites-status' }, { method: 'GET' }),
};

// ── Cloud Accounts API ──────────────────────────────────
export const cloudAccountsApi = {
  mapping: () =>
    apiClient.edgeFunction<any>('cloud-accounts-api', { action: 'mapping' }, { method: 'GET' }),

  inventory: () =>
    apiClient.edgeFunction<any>('cloud-accounts-api', { action: 'inventory' }, { method: 'GET' }),

  pending: () =>
    apiClient.edgeFunction<any>('cloud-accounts-api', { action: 'pending' }, { method: 'GET' }),
};

// ── Backup API ──────────────────────────────────────────
export const backupApi = {
  status: () =>
    apiClient.edgeFunction<any>('backup-api', undefined, { method: 'GET' }),

  trigger: () =>
    apiClient.edgeFunction<any>('backup-api', { action: 'trigger' }, { method: 'POST' }),

  list: () =>
    apiClient.edgeFunction<any[]>('backup-api', { action: 'list' }, { method: 'GET' }),
};

// ── AI API ──────────────────────────────────────────────
export const aiApi = {
  shiftSummary: () =>
    apiClient.edgeFunction<any>('ai-api', { action: 'shift-summary' }, { method: 'GET' }),
};

// ── Analytics API ───────────────────────────────────────
export const analyticsApi = {
  riskScore: () =>
    apiClient.edgeFunction<any>('analytics-api', { action: 'risk-score' }, { method: 'GET' }),
};
