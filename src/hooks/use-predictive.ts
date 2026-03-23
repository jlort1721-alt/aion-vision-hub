import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { STALE_TIMES } from '@/lib/query-config';

interface ForecastData {
  time: string;
  realEvents: number | null;
  predictedRisk: number;
}

interface HotspotData {
  id: number;
  name: string;
  confidence: number;
  severity: 'critical' | 'elevated' | 'nominal';
  x: number;
  y: number;
}

export function usePredictiveForecast() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['predictive', 'forecast'],
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean; data: ForecastData[]}>('/analytics/predictive/forecast');
      return response.data;
    },
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function usePredictiveHotzones() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['predictive', 'hotzones'],
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean; data: HotspotData[]}>('/analytics/predictive/hotzones');
      return response.data;
    },
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}
