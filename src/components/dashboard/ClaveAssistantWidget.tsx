import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Mic, Eye, Heart, Shield, Wifi, WifiOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface SystemStatus {
  health: boolean;
  ai: boolean;
  twilio: boolean;
  faceRec: boolean;
  services: number;
}

async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const [health, twilio, faceRec] = await Promise.allSettled([
      apiClient.get<{ status: string }>('/health/ready'),
      apiClient.get<{ status: string }>('/twilio/health'),
      apiClient.get<{ providerConfigured: boolean }>('/face-recognition/status'),
    ]);

    const healthOk = health.status === 'fulfilled' && (health.value as any)?.status === 'ready';
    const twilioOk = twilio.status === 'fulfilled' && (twilio.value as any)?.data?.status === 'healthy';
    const faceOk = faceRec.status === 'fulfilled' && (faceRec.value as any)?.data !== undefined;

    let servicesOnline = 0;
    if (healthOk) servicesOnline++;
    if (twilioOk) servicesOnline++;
    if (faceOk) servicesOnline++;

    return {
      health: healthOk,
      ai: healthOk, // AI depends on backend being up
      twilio: twilioOk,
      faceRec: faceOk,
      services: servicesOnline,
    };
  } catch {
    return { health: false, ai: false, twilio: false, faceRec: false, services: 0 };
  }
}

export default function ClaveAssistantWidget() {
  const { isAuthenticated } = useAuth();

  const { data: status } = useQuery({
    queryKey: ['system-status-widget'],
    queryFn: fetchSystemStatus,
    refetchInterval: 30000,
    retry: false,
    enabled: isAuthenticated,
  });

  const isOnline = status?.health ?? false;
  const servicesCount = status?.services ?? 0;

  return (
    <Card className="border-primary/20" aria-label="AION System Status">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              AION Platform
            </span>
          </div>
          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px]">
            {isOnline ? (
              <><Wifi className="h-3 w-3 mr-1" /> Online</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Mic className={`h-4 w-4 ${status?.twilio ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="text-[10px] text-muted-foreground">Twilio</span>
            <span className="text-xs font-medium">{status?.twilio ? 'OK' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Eye className={`h-4 w-4 ${status?.ai ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="text-[10px] text-muted-foreground">IA</span>
            <span className="text-xs font-medium">{status?.ai ? 'OK' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Heart className={`h-4 w-4 ${status?.faceRec ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="text-[10px] text-muted-foreground">FaceRec</span>
            <span className="text-xs font-medium">{status?.faceRec ? 'OK' : '--'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <Shield className={`h-4 w-4 ${isOnline ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="text-[10px] text-muted-foreground">24/7</span>
            <span className="text-xs font-medium">{isOnline ? 'On' : 'Off'}</span>
          </div>
        </div>
        {isOnline && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {servicesCount}/3 servicios activos — Monitoreo continuo
          </p>
        )}
      </CardContent>
    </Card>
  );
}
