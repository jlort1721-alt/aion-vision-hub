// ═══════════════════════════════════════════════════════════
// AION VISION HUB — WhatsApp API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Configuration ───────────────────────────────────────────

export const whatsappConfigApi = {
  /** GET /whatsapp/config — Get current WhatsApp config */
  get: () =>
    apiClient.get<{ success: boolean; data: any }>('/whatsapp/config'),

  /** PUT /whatsapp/config — Save WhatsApp config */
  save: (config: Record<string, unknown>) =>
    apiClient.put<{ success: boolean; data: any }>('/whatsapp/config', config),
};

// ── Health & Test ───────────────────────────────────────────

export const whatsappHealthApi = {
  /** GET /whatsapp/health — WhatsApp health check */
  check: () =>
    apiClient.get<{ success: boolean; data: any }>('/whatsapp/health'),

  /** POST /whatsapp/test — Send test message */
  sendTest: (to: string) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/test', { to }),
};

// ── Messaging ───────────────────────────────────────────────

export const whatsappMessagesApi = {
  /** POST /whatsapp/messages — Send a message */
  send: (message: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/messages', message),

  /** POST /whatsapp/messages/quick-reply — Send a quick reply */
  quickReply: (data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/messages/quick-reply', data),
};

// ── Conversations ───────────────────────────────────────────

export const whatsappConversationsApi = {
  /** GET /whatsapp/conversations — List conversations */
  list: (filters?: { status?: string; search?: string }) =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>('/whatsapp/conversations', filters as Record<string, string | number | boolean | undefined>),

  /** GET /whatsapp/conversations/:id — Get single conversation */
  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/whatsapp/conversations/${id}`),

  /** GET /whatsapp/conversations/:id/messages — Get conversation messages */
  getMessages: (id: string, filters?: { limit?: number; before?: string }) =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>(`/whatsapp/conversations/${id}/messages`, filters as Record<string, string | number | boolean | undefined>),

  /** POST /whatsapp/conversations/handoff — Handoff to human agent */
  handoff: (data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/conversations/handoff', data),

  /** POST /whatsapp/conversations/close — Close conversation */
  close: (data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/conversations/close', data),
};

// ── Templates ───────────────────────────────────────────────

export const whatsappTemplatesApi = {
  /** GET /whatsapp/templates — List synced templates */
  list: () =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>('/whatsapp/templates'),

  /** POST /whatsapp/templates/sync — Sync templates from Meta */
  sync: (force?: boolean) =>
    apiClient.post<{ success: boolean; data: any }>('/whatsapp/templates/sync', { force }),
};

// ── Unified export ──────────────────────────────────────────

export const whatsappApi = {
  config: whatsappConfigApi,
  health: whatsappHealthApi,
  messages: whatsappMessagesApi,
  conversations: whatsappConversationsApi,
  templates: whatsappTemplatesApi,
};
