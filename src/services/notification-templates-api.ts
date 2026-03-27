// =====================================================================
// AION VISION HUB -- Notification Templates API Service Layer
// =====================================================================

import { apiClient } from '@/lib/api-client';

// -- Types -----------------------------------------------------------

export interface TemplateVariable {
  name: string;
  description?: string;
  sample?: string;
}

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  variables: TemplateVariable[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePreview {
  subject: string | null;
  body: string;
  channel: string;
  data: Record<string, string>;
}

export interface SendTestResult {
  success: boolean;
  channel: string;
  recipient: string;
  error?: string;
  sent?: number;
  failed?: number;
}

export interface TemplateMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// -- API -------------------------------------------------------------

export const notificationTemplatesApi = {
  list: (filters?: {
    category?: string;
    channel?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }) =>
    apiClient.get<{ success: boolean; data: NotificationTemplate[]; meta: TemplateMeta }>(
      '/notification-templates',
      filters as Record<string, string | number | boolean | undefined>,
    ),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: NotificationTemplate }>(
      `/notification-templates/${id}`,
    ),

  create: (template: {
    name: string;
    description?: string;
    category: string;
    channel: string;
    subject?: string;
    bodyTemplate: string;
    variables?: TemplateVariable[];
    isSystem?: boolean;
  }) =>
    apiClient.post<{ success: boolean; data: NotificationTemplate }>(
      '/notification-templates',
      template,
    ),

  update: (
    id: string,
    updates: {
      name?: string;
      description?: string;
      category?: string;
      channel?: string;
      subject?: string;
      bodyTemplate?: string;
      variables?: TemplateVariable[];
    },
  ) =>
    apiClient.patch<{ success: boolean; data: NotificationTemplate }>(
      `/notification-templates/${id}`,
      updates,
    ),

  delete: (id: string) =>
    apiClient.delete<void>(`/notification-templates/${id}`),

  preview: (id: string, data?: Record<string, string>) =>
    apiClient.post<{ success: boolean; data: TemplatePreview }>(
      `/notification-templates/${id}/preview`,
      { data: data ?? {} },
    ),

  sendTest: (params: {
    templateId: string;
    channel: 'email' | 'whatsapp' | 'push';
    recipient: string;
    data?: Record<string, string>;
  }) =>
    apiClient.post<{ success: boolean; data: SendTestResult }>(
      '/notification-templates/send-test',
      params,
    ),

  seed: () =>
    apiClient.post<{ success: boolean; data: { seeded: number; skipped: number } }>(
      '/notification-templates/seed',
    ),
};
