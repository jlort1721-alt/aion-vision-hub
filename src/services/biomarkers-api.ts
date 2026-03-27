// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Biomarkers API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const biomarkersApi = {
  /** POST /analytics/biomarkers — Ingest a facial/biometric vector */
  ingest: (data: {
    subjectId: string;
    embedding: number[];
    confidence: number;
    phenotypicMetadata?: Record<string, unknown>;
    featureTags?: string[];
    lastSeenLocationId?: string;
  }) =>
    apiClient.post<{ id: string; message: string }>('/analytics/biomarkers', data),

  /** POST /analytics/biomarkers/search — Deep neural similarity search */
  search: (targetEmbedding: number[]) =>
    apiClient.post<{ subjectId: string; matchPercentage: number; features: string[]; lastSeenLocationId: string | null; lastSeenAt: string }[]>(
      '/analytics/biomarkers/search',
      { targetEmbedding },
    ),
};
