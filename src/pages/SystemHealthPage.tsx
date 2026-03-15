import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';

const statusConfig: Record<string, { icon: React.ReactNode; bg: string }> = {
  healthy: { icon: <CheckCircle2 className="h-5 w-5 text-success" />, bg: 'border-l-success' },
  degraded: { icon: <AlertCircle className="h-5 w-5 text-warning" />, bg: 'border-l-warning' },
  down: { icon: <XCircle className="h-5 w-5 text-destructive" />, bg: 'border-l-destructive' },
  unknown: { icon: <AlertCircle className="h-5 w-5 text-muted-foreground" />, bg: 'border-l-muted' },
};

export default function SystemHealthPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => healthApi.check(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const checks = data?.checks || [];
  const healthy = checks.filter(c => c.status === 'healthy').length;
  const degraded = checks.filter(c => c.status === 'degraded').length;
  const down = checks.filter(c => c.status === 'down').length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['system-health'] });
    setRefreshing(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('system.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('system.subtitle')} {data?.timestamp && `• ${t('system.last_check')}: ${new Date(data.timestamp).toLocaleTimeString()}`}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { count: healthy, label: t('system.healthy'), icon: <CheckCircle2 className="h-8 w-8 text-success" /> },
          { count: degraded, label: t('system.degraded'), icon: <AlertCircle className="h-8 w-8 text-warning" /> },
          { count: down, label: t('system.down'), icon: <XCircle className="h-8 w-8 text-destructive" /> },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              {isLoading ? <Skeleton className="h-8 w-8 rounded-full" /> : s.icon}
              <div>
                {isLoading ? <Skeleton className="h-6 w-8" /> : <p className="text-2xl font-bold">{s.count}</p>}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            {t('system.fetch_error')}: {error instanceof Error ? error.message : 'Unknown error'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          checks.map(h => {
            const cfg = statusConfig[h.status] || statusConfig.unknown;
            return (
              <Card key={h.component} className={`border-l-4 ${cfg.bg}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  {cfg.icon}
                  <div className="flex-1">
                    <p className="font-medium">{h.component}</p>
                    {h.details && (
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(h.details).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                      </p>
                    )}
                  </div>
                  {h.latency_ms !== undefined && (
                    <div className="text-right">
                      <p className="text-sm font-mono">{h.latency_ms}ms</p>
                      <p className="text-[10px] text-muted-foreground">{t('system.latency')}</p>
                    </div>
                  )}
                  <Badge variant={h.status === 'healthy' ? 'default' : h.status === 'degraded' ? 'secondary' : 'destructive'} className="capitalize text-xs">
                    {h.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
