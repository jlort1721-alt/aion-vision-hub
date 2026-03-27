import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { anomalyApi } from '@/services/anomaly-api';
import type { Anomaly } from '@/services/anomaly-api';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const severityColors: Record<string, string> = {
  critical: 'bg-destructive/20 border-destructive/50 text-destructive',
  high: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  medium: 'bg-warning/20 border-warning/50 text-warning',
  low: 'bg-primary/20 border-primary/50 text-primary',
  info: 'bg-muted border-border text-muted-foreground',
};

export default function AnomalyAlertBanner() {
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () => anomalyApi.detect(),
    enabled: isAuthenticated,
    refetchInterval: 300_000, // 5 minutes
    staleTime: 120_000,
  });

  const anomalies = (data?.data || []).filter(
    (a: Anomaly) => !dismissed.has(a.detectedAt + a.type) && (a.severity === 'critical' || a.severity === 'high'),
  );

  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {anomalies.slice(0, 3).map((anomaly: Anomaly, i: number) => (
        <div
          key={`${anomaly.type}-${anomaly.detectedAt}-${i}`}
          className={`rounded-lg border p-3 flex items-start gap-3 ${severityColors[anomaly.severity] || severityColors.info}`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {anomaly.type.replace('_', ' ')}
              </Badge>
              <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                {anomaly.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Confidence: {Math.round(anomaly.confidence * 100)}%
              </span>
            </div>
            <p className="text-sm font-medium">{anomaly.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Shield className="h-3 w-3 inline mr-1" />
              {anomaly.suggestedAction}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate('/events')}
            >
              Investigate <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDismissed((prev) => new Set(prev).add(anomaly.detectedAt + anomaly.type))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
