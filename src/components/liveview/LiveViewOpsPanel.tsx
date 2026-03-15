import React from 'react'; // eslint-disable-line
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Zap, DoorOpen, RotateCcw, Phone, Database, Bot, Siren,
  Lightbulb, Shield, Power, UserCheck, Car, AlertTriangle,
  MessageSquare, Search, Cloud, CloudOff, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDomoticDevices } from '@/hooks/use-module-data';
import { useEWeLinkAuth, useEWeLinkControl } from '@/hooks/use-ewelink';

interface LiveViewOpsPanelProps {
  onClose: () => void;
}

export default function LiveViewOpsPanel({ onClose }: LiveViewOpsPanelProps) {
  const navigate = useNavigate();
  const { data: devices = [] } = useDomoticDevices();
  const ewelinkAuth = useEWeLinkAuth();
  const ewelinkControl = useEWeLinkControl();

  // Get devices by type for quick actions
  const doorDevices = devices.filter((d: any) => d.type === 'door' && d.status === 'online');
  const sirenDevices = devices.filter((d: any) => d.type === 'siren' && d.status === 'online');
  const lightDevices = devices.filter((d: any) => d.type === 'light' && d.status === 'online');
  const lockDevices = devices.filter((d: any) => d.type === 'lock' && d.status === 'online');

  const handleQuickControl = (device: any, action: 'on' | 'off' | 'toggle') => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({
        deviceId: device.config.ewelink_id,
        action,
      });
    } else if (!ewelinkAuth.isAuthenticated) {
      toast.warning('Conecta tu cuenta eWeLink en Domóticos para control real');
      navigate('/domotics');
    } else {
      toast.info(`"${device.name}" no tiene eWeLink ID asociado — configúralo en Domóticos`);
    }
  };

  const handleBatchAction = (type: string, action: 'on' | 'off') => {
    const targets = devices.filter((d: any) => d.type === type && d.status === 'online' && d.config?.ewelink_id);
    if (targets.length === 0) {
      toast.info(`No hay dispositivos tipo "${type}" en línea con eWeLink configurado`);
      return;
    }
    if (!ewelinkAuth.isAuthenticated) {
      toast.warning('Conecta tu cuenta eWeLink en Domóticos');
      return;
    }
    for (const device of targets) {
      ewelinkControl.mutate({
        deviceId: device.config.ewelink_id,
        action,
      });
    }
    toast.info(`Enviando "${action}" a ${targets.length} dispositivo(s) tipo "${type}"`);
  };

  return (
    <div className="w-64 border-l bg-card flex flex-col shrink-0">
      <div className="p-2 border-b flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operations</p>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onClose}>Hide</Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* eWeLink Status */}
          <div className="p-2 rounded bg-muted/50 border">
            <div className="flex items-center gap-1.5 mb-1">
              {ewelinkAuth.isAuthenticated ? <Cloud className="h-3 w-3 text-green-500" /> : <CloudOff className="h-3 w-3 text-muted-foreground" />}
              <span className="text-[10px] font-semibold">eWeLink</span>
              <Badge variant={ewelinkAuth.isAuthenticated ? 'default' : 'secondary'} className="text-[8px] ml-auto">
                {ewelinkAuth.isAuthenticated ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>
            {!ewelinkAuth.isAuthenticated && (
              <Button variant="outline" size="sm" className="h-5 text-[9px] w-full mt-1" onClick={() => navigate('/domotics')}>
                Configurar en Domóticos
              </Button>
            )}
          </div>

          <Separator />

          {/* Domotics Quick Actions */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Domóticos
            </p>
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant="outline" size="sm"
                className="h-7 text-[10px] justify-start"
                onClick={() => doorDevices.length > 0 ? handleBatchAction('door', 'on') : navigate('/domotics')}
                disabled={ewelinkControl.isPending}
              >
                <DoorOpen className="mr-1 h-3 w-3" /> Puertas
                {doorDevices.length > 0 && <Badge variant="outline" className="text-[7px] ml-auto h-3 px-1">{doorDevices.length}</Badge>}
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-7 text-[10px] justify-start"
                onClick={() => sirenDevices.length > 0 ? handleBatchAction('siren', 'on') : toast.info('Configura sirenas en Domóticos')}
                disabled={ewelinkControl.isPending}
              >
                <Siren className="mr-1 h-3 w-3" /> Sirenas
                {sirenDevices.length > 0 && <Badge variant="outline" className="text-[7px] ml-auto h-3 px-1">{sirenDevices.length}</Badge>}
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-7 text-[10px] justify-start"
                onClick={() => lightDevices.length > 0 ? handleBatchAction('light', 'on') : toast.info('Configura luces en Domóticos')}
                disabled={ewelinkControl.isPending}
              >
                <Lightbulb className="mr-1 h-3 w-3" /> Luces
                {lightDevices.length > 0 && <Badge variant="outline" className="text-[7px] ml-auto h-3 px-1">{lightDevices.length}</Badge>}
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-7 text-[10px] justify-start"
                onClick={() => lockDevices.length > 0 ? handleBatchAction('lock', 'on') : toast.info('Configura chapas en Domóticos')}
                disabled={ewelinkControl.isPending}
              >
                <Shield className="mr-1 h-3 w-3" /> Chapas
                {lockDevices.length > 0 && <Badge variant="outline" className="text-[7px] ml-auto h-3 px-1">{lockDevices.length}</Badge>}
              </Button>
            </div>
            {ewelinkControl.isPending && (
              <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
              </p>
            )}
            {/* Quick per-device toggles for online devices */}
            {ewelinkAuth.isAuthenticated && devices.filter((d: any) => d.status === 'online').length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-[9px] text-muted-foreground mb-1">Dispositivos en línea:</p>
                {devices.filter((d: any) => d.status === 'online').slice(0, 6).map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between gap-1">
                    <span className="text-[9px] truncate flex-1">{d.name}</span>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleQuickControl(d, 'on')}>
                        <Power className="h-2.5 w-2.5 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleQuickControl(d, 'off')}>
                        <Power className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {devices.filter((d: any) => d.status === 'online').length > 6 && (
                  <Button variant="link" size="sm" className="h-4 text-[8px] p-0" onClick={() => navigate('/domotics')}>
                    Ver todos...
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Access Control */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <DoorOpen className="h-3 w-3" /> Access Control
            </p>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/access-control')}>
                <UserCheck className="mr-1 h-3 w-3" /> Resident Lookup
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/access-control')}>
                <Car className="mr-1 h-3 w-3" /> Vehicle Lookup
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => toast.info('Gate operation requires access control device configuration')}>
                <Power className="mr-1 h-3 w-3" /> Open Gate
              </Button>
            </div>
          </div>

          <Separator />

          {/* Reboots */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Reboots
            </p>
            <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/reboots')}>
              <AlertTriangle className="mr-1 h-3 w-3" /> Restart Device
            </Button>
          </div>

          <Separator />

          {/* Intercom */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <Phone className="h-3 w-3" /> Intercom
            </p>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/intercom')}>
                <Phone className="mr-1 h-3 w-3" /> Quick Call
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => toast.info('Welcome message requires intercom VoIP configuration')}>
                <MessageSquare className="mr-1 h-3 w-3" /> Welcome Msg
              </Button>
            </div>
          </div>

          <Separator />

          {/* Database */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <Database className="h-3 w-3" /> Database
            </p>
            <Button variant="outline" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/database')}>
              <Search className="mr-1 h-3 w-3" /> Quick Search
            </Button>
          </div>

          <Separator />

          {/* AION Agent */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <Bot className="h-3 w-3" /> AION Agent
            </p>
            <Button variant="default" size="sm" className="h-7 text-[10px] w-full justify-start" onClick={() => navigate('/ai-assistant')}>
              <Bot className="mr-1 h-3 w-3" /> Ask AION
            </Button>
            <div className="mt-1.5 p-2 rounded bg-muted/50 border">
              <p className="text-[9px] text-muted-foreground">AION operational. Click 'Ask AION' for AI-assisted monitoring.</p>
              <Badge variant="outline" className="text-[8px] mt-1">Ready</Badge>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
