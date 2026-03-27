import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Power, PowerOff, Clock, Settings, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { TYPE_LABELS } from '../types';

interface DeviceSidebarProps {
  device: any; // Ideally typed with proper entity type
  sectionName: string;
  actions: any[];
  actionsLoading: boolean;
  ewelinkControlPending: boolean;
  onToggle: (device: any) => void;
  onDirectAction: (device: any, action: 'on' | 'off') => void;
  onTestConnection: (device: any) => void;
  onEdit: (device: any) => void;
}

export function DeviceSidebar({
  device, sectionName, actions, actionsLoading,
  ewelinkControlPending, onToggle, onDirectAction, onTestConnection, onEdit
}: DeviceSidebarProps) {
  const { t } = useI18n();
  
  if (!device) return null;

  return (
    <div className="w-[350px] shrink-0 border-l bg-accent/10 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b bg-background flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight">{device.name}</h2>
            <p className="text-xs text-muted-foreground">{sectionName}</p>
          </div>
        </div>
        <StatusBadge status={device.status} variant="device" pulse={device.status === 'online'} />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {t('domotics.quick_actions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('domotics.power_state')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">{device.state}</span>
                <Switch
                  checked={device.state === 'on'}
                  onCheckedChange={() => onToggle(device)}
                  disabled={ewelinkControlPending}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onDirectAction(device, 'on')} disabled={ewelinkControlPending}>
                <Power className="mr-1 h-3 w-3 text-success" /> {t('domotics.activate')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDirectAction(device, 'off')} disabled={ewelinkControlPending}>
                <PowerOff className="mr-1 h-3 w-3 text-muted-foreground" /> {t('domotics.deactivate')}
              </Button>
            </div>
            
            {ewelinkControlPending && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1.5 mt-2 bg-muted/50 p-1.5 rounded">
                <Loader2 className="h-3 w-3 animate-spin" /> Transmitiendo señal...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Device Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {t('domotics.device_info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">{t('common.type')}</span>
              <Badge variant="outline" className="text-[10px] capitalize font-normal">
                {TYPE_LABELS[device.type] || device.type}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">{t('domotics.brand_model')}</span>
              <span className="text-xs font-medium">{device.brand} {device.model}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">{t('domotics.last_action')}</span>
              <span className="text-xs">{device.last_action || '—'}</span>
            </div>
            {device.last_sync && (
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground text-xs">{t('domotics.last_sync')}</span>
                 <span className="text-[10px] font-mono">{new Date(device.last_sync).toLocaleString()}</span>
               </div>
            )}
            {device.config?.ewelink_id && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">eWeLink ID</span>
                <span className="text-[10px] font-mono select-all bg-muted px-1 py-0.5 rounded">{device.config.ewelink_id}</span>
              </div>
            )}
            {device.config?.firmware && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Firmware</span>
                <span className="text-[10px] font-mono">{device.config.firmware}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action History */}
        <Card className="flex-1 flex flex-col min-h-[200px]">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> {t('domotics.action_history')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {actionsLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : actions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay acciones recientes.</p>
            ) : (
              <div className="divide-y text-xs">
                {actions.map((action: any) => (
                  <div key={action.id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="font-medium mb-1 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                       {action.description || action.action || '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono ml-3.5">
                      {action.created_at ? new Date(action.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="p-4 border-t bg-background flex gap-2">
        <Button variant="outline" className="flex-1 text-xs h-8" onClick={() => onTestConnection(device)}>
          <RefreshCw className="mr-1.5 h-3 w-3" /> {t('domotics.test_connection')}
        </Button>
        <Button variant="outline" className="flex-1 text-xs h-8" onClick={() => onEdit(device)}>
          <Settings className="mr-1.5 h-3 w-3" /> {t('common.edit')}
        </Button>
      </div>
    </div>
  );
}
