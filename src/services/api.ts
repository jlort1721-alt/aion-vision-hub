// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Backend API Service Layer
// All mutations go through edge functions for audit + validation
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function apiFetch<T = unknown>(fn: string, params?: Record<string, string>, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const url = new URL(`${BASE_URL}/${fn}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), { ...options, headers: { ...headers, ...(options?.headers || {}) } });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

// ── Devices API ────────────────────────────────────────────
export const devicesApi = {
  list: (filters?: { site_id?: string; status?: string; brand?: string }) =>
    apiFetch<any[]>('devices-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiFetch<any>('devices-api', { id }, { method: 'GET' }),

  create: (device: Record<string, unknown>) =>
    apiFetch<any>('devices-api', undefined, { method: 'POST', body: JSON.stringify(device) }),

  update: (id: string, updates: Record<string, unknown>) =>
    apiFetch<any>('devices-api', { id }, { method: 'PUT', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>('devices-api', { id }, { method: 'DELETE' }),

  testConnection: (params: { ip_address: string; brand: string; device_id?: string }) =>
    apiFetch<{ success: boolean; message: string; latency_ms: number }>('devices-api', { action: 'test-connection' }, { method: 'POST', body: JSON.stringify(params) }),
};

// ── Events API ─────────────────────────────────────────────
export const eventsApi = {
  list: (filters?: { severity?: string; status?: string; site_id?: string; device_id?: string; limit?: string }) =>
    apiFetch<any[]>('events-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiFetch<any>('events-api', { id }, { method: 'GET' }),

  acknowledge: (id: string) =>
    apiFetch<any>('events-api', { id, action: 'acknowledge' }, { method: 'POST' }),

  resolve: (id: string) =>
    apiFetch<any>('events-api', { id, action: 'resolve' }, { method: 'POST' }),

  dismiss: (id: string) =>
    apiFetch<any>('events-api', { id, action: 'dismiss' }, { method: 'POST' }),

  assign: (id: string, assignedTo: string) =>
    apiFetch<any>('events-api', { id, action: 'assign' }, { method: 'POST', body: JSON.stringify({ assigned_to: assignedTo }) }),

  aiSummary: (id: string) =>
    apiFetch<any>('events-api', { id, action: 'ai-summary' }, { method: 'POST' }),
};

// ── Incidents API ──────────────────────────────────────────
export const incidentsApi = {
  list: (filters?: { status?: string; priority?: string }) =>
    apiFetch<any[]>('incidents-api', filters as Record<string, string>, { method: 'GET' }),

  get: (id: string) =>
    apiFetch<any>('incidents-api', { id }, { method: 'GET' }),

  create: (incident: Record<string, unknown>) =>
    apiFetch<any>('incidents-api', undefined, { method: 'POST', body: JSON.stringify(incident) }),

  update: (id: string, updates: Record<string, unknown>) =>
    apiFetch<any>('incidents-api', { id }, { method: 'PUT', body: JSON.stringify(updates) }),

  addComment: (id: string, content: string) =>
    apiFetch<any>('incidents-api', { id, action: 'comment' }, { method: 'POST', body: JSON.stringify({ content }) }),

  close: (id: string) =>
    apiFetch<any>('incidents-api', { id, action: 'close' }, { method: 'POST' }),

  aiSummary: (id: string) =>
    apiFetch<any>('incidents-api', { id, action: 'ai-summary' }, { method: 'POST' }),
};

// ── Health API ─────────────────────────────────────────────
export const healthApi = {
  check: () =>
    apiFetch<{ status: string; timestamp: string; checks: Array<{ component: string; status: string; latency_ms?: number; details?: Record<string, unknown> }> }>('health-api', undefined, { method: 'GET' }),
};

// ── Reports API ────────────────────────────────────────────
export const reportsApi = {
  summary: () =>
    apiFetch<any>('reports-api', { type: 'summary' }, { method: 'GET' }),

  events: (from?: string, to?: string) =>
    apiFetch<any>('reports-api', { type: 'events', ...(from && { from }), ...(to && { to }) } as Record<string, string>, { method: 'GET' }),

  incidents: (from?: string, to?: string) =>
    apiFetch<any>('reports-api', { type: 'incidents', ...(from && { from }), ...(to && { to }) } as Record<string, string>, { method: 'GET' }),

  devices: () =>
    apiFetch<any>('reports-api', { type: 'devices' }, { method: 'GET' }),
};

// ── Integrations API ───────────────────────────────────────
export const integrationsApi = {
  list: () => apiFetch<any[]>('integrations-api', undefined, { method: 'GET' }),
  test: (id: string) => apiFetch<any>('integrations-api', { id, action: 'test' }, { method: 'POST' }),
  toggle: (id: string) => apiFetch<any>('integrations-api', { id, action: 'toggle' }, { method: 'POST' }),
};

// ── MCP API ────────────────────────────────────────────────
export const mcpApi = {
  list: () => apiFetch<any[]>('mcp-api', undefined, { method: 'GET' }),
  healthCheck: (id: string) => apiFetch<any>('mcp-api', { id, action: 'health-check' }, { method: 'POST' }),
  toggle: (id: string) => apiFetch<any>('mcp-api', { id, action: 'toggle' }, { method: 'POST' }),
};

// ── Event Alerts API ──────────────────────────────────────
export const eventAlertsApi = {
  test: () => apiFetch<any>('event-alerts', { action: 'test' }, { method: 'POST' }),
  send: (event: { event_id: string; severity: string; title: string; event_type?: string; site_id?: string; device_id?: string }) =>
    apiFetch<any>('event-alerts', undefined, { method: 'POST', body: JSON.stringify(event) }),
  listRecent: () => apiFetch<any>('event-alerts', undefined, { method: 'GET' }),
};

// ── Email API ─────────────────────────────────────────────
export const emailApi = {
  health: () =>
    apiFetch<{ data: { configured: boolean; provider: string; ok: boolean; latencyMs: number; message: string } }>('email-api', undefined, { method: 'GET' }),

  test: (to?: string) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string; healthCheck: { ok: boolean; provider: string; latencyMs: number; message: string } } }>('email-api', { action: 'test' }, { method: 'POST', body: JSON.stringify({ to }) }),

  send: (msg: { to: string[]; subject: string; html?: string; text?: string; replyTo?: string; cc?: string[]; bcc?: string[]; attachments?: Array<{ filename: string; content: string; contentType: string }> }) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'send' }, { method: 'POST', body: JSON.stringify(msg) }),

  sendEventAlert: (params: { to: string[]; severity: string; eventType: string; title: string; description: string; deviceName?: string; siteName?: string; timestamp?: string; snapshotUrl?: string }) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'event-alert' }, { method: 'POST', body: JSON.stringify(params) }),

  sendIncidentReport: (params: { to: string[]; incidentId: string; title: string; status: string; priority: string; summary: string; assignedTo?: string; eventsCount?: number; createdAt?: string }) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'incident-report' }, { method: 'POST', body: JSON.stringify(params) }),

  sendPeriodicReport: (params: { to: string[]; reportName: string; period: string; totalEvents: number; criticalEvents: number; activeIncidents: number; devicesOnline: number; devicesTotal: number; topEventTypes?: Array<{ type: string; count: number }> }) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'periodic-report' }, { method: 'POST', body: JSON.stringify(params) }),

  sendEvidencePackage: (params: { to: string[]; eventId: string; eventType: string; title: string; description: string; deviceName: string; siteName: string; timestamp?: string; recipientName?: string; exportedBy: string; attachments?: Array<{ filename: string; content: string; contentType: string }> }) =>
    apiFetch<{ data: { success: boolean; messageId?: string; error?: string } }>('email-api', { action: 'evidence-package' }, { method: 'POST', body: JSON.stringify(params) }),

  logs: (limit?: number) =>
    apiFetch<{ data: Array<{ id: string; provider: string; action: string; to: string[]; subject: string; success: boolean; messageId?: string; error?: string; latencyMs: number; timestamp: string }> }>('email-api', { action: 'logs', ...(limit ? { limit: String(limit) } : {}) }, { method: 'GET' }),
};

// ── WhatsApp API ──────────────────────────────────────────
export const whatsappApi = {
  // Config
  getConfig: () =>
    apiFetch<any>('whatsapp-api', { action: 'config' }, { method: 'GET' }),
  saveConfig: (config: Record<string, unknown>) =>
    apiFetch<any>('whatsapp-api', { action: 'config' }, { method: 'PUT', body: JSON.stringify(config) }),

  // Health & Test
  health: () =>
    apiFetch<any>('whatsapp-api', { action: 'health' }, { method: 'GET' }),
  testConnection: (to: string) =>
    apiFetch<any>('whatsapp-api', { action: 'test' }, { method: 'POST', body: JSON.stringify({ to }) }),

  // Messaging
  sendMessage: (msg: { to: string; type: string; body?: string; templateName?: string; templateLanguage?: string; templateParams?: string[]; mediaUrl?: string; caption?: string; interactive?: Record<string, unknown> }) =>
    apiFetch<any>('whatsapp-api', { action: 'send' }, { method: 'POST', body: JSON.stringify(msg) }),
  sendQuickReply: (msg: { to: string; body: string; buttons: Array<{ id: string; title: string }> }) =>
    apiFetch<any>('whatsapp-api', { action: 'quick-reply' }, { method: 'POST', body: JSON.stringify(msg) }),

  // Conversations
  listConversations: (filters?: { status?: string; phone?: string; limit?: string; offset?: string }) =>
    apiFetch<any>('whatsapp-api', { action: 'conversations', ...(filters || {}) } as Record<string, string>, { method: 'GET' }),
  getConversation: (id: string) =>
    apiFetch<any>('whatsapp-api', { action: 'conversation', id }, { method: 'GET' }),
  getMessages: (conversationId: string, limit?: number) =>
    apiFetch<any>('whatsapp-api', { action: 'messages', conversationId, ...(limit ? { limit: String(limit) } : {}) }, { method: 'GET' }),

  // Handoff & Close
  handoffToHuman: (conversationId: string, assignTo?: string, note?: string) =>
    apiFetch<any>('whatsapp-api', { action: 'handoff' }, { method: 'POST', body: JSON.stringify({ conversationId, assignTo, note }) }),
  closeConversation: (conversationId: string, resolution?: string) =>
    apiFetch<any>('whatsapp-api', { action: 'close' }, { method: 'POST', body: JSON.stringify({ conversationId, resolution }) }),

  // Templates
  listTemplates: () =>
    apiFetch<any>('whatsapp-api', { action: 'templates' }, { method: 'GET' }),
  syncTemplates: () =>
    apiFetch<any>('whatsapp-api', { action: 'sync-templates' }, { method: 'POST' }),
};
