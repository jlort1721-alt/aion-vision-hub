// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Evidence API Service
// Manages evidence attachments for incidents (snapshots,
// clips, documents, notes) via the Fastify backend.
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export interface EvidenceRecord {
  id: string;
  tenant_id: string;
  incident_id: string;
  device_id: string | null;
  type: 'snapshot' | 'clip' | 'document' | 'note';
  file_url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  description: string | null;
  captured_at: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateEvidencePayload {
  incident_id: string;
  device_id?: string;
  type: 'snapshot' | 'clip' | 'document' | 'note';
  file_url?: string;
  thumbnail_url?: string;
  file_name?: string;
  mime_type?: string;
  description?: string;
  captured_at?: string;
}

export interface CaptureSnapshotPayload {
  incident_id: string;
  device_id: string;
  description?: string;
}

interface EvidenceListResponse {
  success: boolean;
  data: EvidenceRecord[];
}

interface EvidenceSingleResponse {
  success: boolean;
  data: EvidenceRecord;
}

export const evidenceApi = {
  /** List all evidence for an incident */
  list: (incidentId: string) =>
    apiClient.get<EvidenceListResponse>('/evidence', { incident_id: incidentId }),

  /** Create an evidence record (manual upload / note) */
  create: (data: CreateEvidencePayload) =>
    apiClient.post<EvidenceSingleResponse>('/evidence', data),

  /** Capture a live snapshot from a device and attach to incident */
  captureSnapshot: (incidentId: string, deviceId: string, description?: string) =>
    apiClient.post<EvidenceSingleResponse>('/evidence/capture', {
      incident_id: incidentId,
      device_id: deviceId,
      description,
    }),

  /** Delete an evidence record */
  delete: (id: string) =>
    apiClient.delete<EvidenceSingleResponse>(`/evidence/${id}`),
};
