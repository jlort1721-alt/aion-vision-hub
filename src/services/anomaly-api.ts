import { apiClient } from '@/lib/api-client';

export interface Anomaly {
  type: 'time_anomaly' | 'volume_anomaly' | 'device_anomaly' | 'access_anomaly' | 'pattern_anomaly';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  deviceId?: string;
  siteId?: string;
  confidence: number;
  suggestedAction: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export const anomalyApi = {
  detect: () =>
    apiClient.get<{ success: boolean; data: Anomaly[]; meta: { count: number; scannedAt: string } }>('/anomalies'),

  getBaseline: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/anomalies/baseline'),

  scan: () =>
    apiClient.post<{ success: boolean; data: Anomaly[] }>('/anomalies/scan'),

  rebuildBaseline: () =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/anomalies/rebuild-baseline'),
};
