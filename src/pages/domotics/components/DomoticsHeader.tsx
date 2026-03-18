import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Wifi, AlertTriangle, Power, LogIn, LogOut, Cloud, CloudOff, Loader2, CheckCircle2, XCircle, FileText, Download, RefreshCw, Plus } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

interface DomoticsHeaderProps {
  devicesCount: number;
  onlineCount: number;
  errorCount: number;
  activeCount: number;
  ewelinkAuth: any;
  ewelinkHealth: any;
  isSyncing: boolean;
  onSync: () => void;
  onRefresh: () => void;
  onAddDevice: () => void;
  onOpenLogin: () => void;
  onOpenLogs: () => void;
}

export function DomoticsHeader({
  devicesCount, onlineCount, errorCount, activeCount,
  ewelinkAuth, ewelinkHealth, isSyncing,
  onSync, onRefresh, onAddDevice, onOpenLogin, onOpenLogs
}: DomoticsHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 px-1">
      {/* Top Actions & Connection Status */}
      <div className="flex items-center justify-between">
        {/* eWeLink Health Banner */}
        {ewelinkHealth && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${
            ewelinkHealth.status === 'connected' ? "bg-green-500/10 text-green-600 dark:text-green-400" :
            ewelinkHealth.status === 'error' ? "bg-destructive/10 text-destructive" :
            "bg-muted text-muted-foreground"
          }`}>
            {ewelinkHealth.status === 'connected' ? <CheckCircle2 className="h-3 w-3" /> : 
             ewelinkHealth.status === 'error' ? <XCircle className="h-3 w-3" /> : 
             <CloudOff className="h-3 w-3" />}
            <span>{ewelinkHealth.message}</span>
            {(ewelinkHealth.latencyMs ?? 0) > 0 && <span className="ml-auto font-mono">{ewelinkHealth.latencyMs}ms</span>}
            
            {!ewelinkAuth.isAuthenticated && ewelinkAuth.isConfigured && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-2" onClick={onOpenLogin}>
                <LogIn className="mr-1 h-3 w-3" /> Iniciar Sesión
              </Button>
            )}
            {ewelinkAuth.isAuthenticated && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-2" onClick={ewelinkAuth.logout}>
                <LogOut className="mr-1 h-3 w-3" /> Cerrar
              </Button>
            )}
          </div>
        )}
        
        <div className="flex gap-2 ml-auto">
          {ewelinkAuth.isConfigured && (
            <Badge
              variant={ewelinkAuth.isAuthenticated ? 'default' : 'secondary'}
              className="text-[10px] cursor-pointer"
              onClick={() => ewelinkAuth.isAuthenticated ? null : onOpenLogin()}
            >
              <Cloud className="mr-1 h-3 w-3" /> eWeLink
            </Badge>
          )}
          {ewelinkAuth.isAuthenticated && (
            <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
              Sync
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenLogs}>
            <FileText className="mr-1 h-3 w-3" /> Logs
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={onAddDevice}>
            <Plus className="mr-1 h-3 w-3" /> {t('domotics.add_device')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <div><p className="text-[10px] text-muted-foreground uppercase">{t('common.all')}</p><p className="text-sm font-bold">{devicesCount}</p></div>
          </div>
        </Card>
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-emerald-500" />
            <div><p className="text-[10px] text-muted-foreground uppercase">{t('common.online')}</p><p className="text-sm font-bold">{onlineCount}</p></div>
          </div>
        </Card>
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div><p className="text-[10px] text-muted-foreground uppercase">{t('domotics.errors')}</p><p className="text-sm font-bold">{errorCount}</p></div>
          </div>
        </Card>
        <Card className="p-2">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-primary" />
            <div><p className="text-[10px] text-muted-foreground uppercase">{t('domotics.active')}</p><p className="text-sm font-bold">{activeCount}</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
