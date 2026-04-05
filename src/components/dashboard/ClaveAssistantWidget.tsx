import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Mic, Eye, Heart, Shield, Wifi, WifiOff } from 'lucide-react';

interface ClaveStatus {
  bridge: string;
  monitor: {
    running: boolean;
    operators_monitored: number;
  };
  aion_instances: Record<string, { status: string }>;
}

async function fetchClaveStatus(): Promise<ClaveStatus | null> {
  // Bridge status endpoint removed — it was returning 502 errors.
  // Return null so the widget shows "Offline" gracefully.
  return null;
}

export default function ClaveAssistantWidget() {
  const { data: status } = useQuery({
    queryKey: ['clave-status'],
    queryFn: fetchClaveStatus,
    refetchInterval: 15000,
    retry: false,
  });

  const isOnline = status?.bridge === 'active';

  return (
    <Card className="border-primary/20" aria-label="CLAVE Assistant Status">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              CLAVE Assistant
            </span>
          </div>
          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px]">
            {isOnline ? (
              <><Wifi className="h-3 w-3 mr-1" /> Active</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Voz</span>
            <span className="text-xs font-medium">{isOnline ? 'Ready' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Vision</span>
            <span className="text-xs font-medium">{isOnline ? 'Ready' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Bio</span>
            <span className="text-xs font-medium">{isOnline ? 'Ready' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">24/7</span>
            <span className="text-xs font-medium">{status?.monitor?.running ? 'On' : 'Off'}</span>
          </div>
        </div>
        {isOnline && status?.monitor?.operators_monitored !== undefined && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Monitoreando {status.monitor.operators_monitored} operador(es) en {Object.keys(status.aion_instances || {}).length} instancias
          </p>
        )}
      </CardContent>
    </Card>
  );
}
