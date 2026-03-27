// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Backup API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const backupApi = {
  /** GET /backup/status — Backup status (last backup, next scheduled, disk usage) */
  status: () =>
    apiClient.get<{ success: boolean; data: any }>('/backup/status'),

  /** POST /backup/trigger — Manually trigger a backup */
  trigger: () =>
    apiClient.post<{ success: boolean; data: any }>('/backup/trigger'),

  /** GET /backup/list — List available backups with dates and sizes */
  list: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/backup/list'),
};
