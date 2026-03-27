import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSites } from '@/hooks/use-supabase-data';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Zap, ZapOff, RefreshCw, Download, Power, PowerOff,
  Wifi, WifiOff, Heart, LogIn, LogOut, ToggleLeft,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface EWeLinkDevice {
  deviceid: string;
  name: string;
  brandName?: string;
  productModel?: string;
  online: boolean;
  params?: {
    switch?: string;
    switches?: Array<{ switch: string; outlet: number }>;
  };
}

async function eweFetch(path: string, options?: RequestInit) {
  const resp = await fetch(`${API_URL}/api/v1/ewelink${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  return resp.json();
}

export default function EWeLinkCloudPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<EWeLinkDevice[]>([]);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSiteId, setImportSiteId] = useState('');
  const [importing, setImporting] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const { data: sites = [] } = useSites();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Error', description: 'Ingrese email y contraseña de eWeLink', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = await eweFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      if (data.success) {
        setConnected(true);
        toast({ title: 'Conectado a eWeLink', description: 'Cargando dispositivos...' });
        await loadDevices();
      } else {
        toast({ title: 'Error de autenticación', description: data.error || 'Credenciales inválidas', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con el servicio eWeLink', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await eweFetch('/logout', { method: 'POST' });
    setConnected(false);
    setDevices([]);
    toast({ title: 'Desconectado de eWeLink' });
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await eweFetch('/devices');
      if (data.success && data.data) {
        const deviceList = Array.isArray(data.data) ? data.data : data.data.devices || [];
        setDevices(deviceList);
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudieron cargar dispositivos', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    try {
      const data = await eweFetch('/health');
      if (data.success) {
        setHealthStatus(data.data?.status || 'healthy');
        toast({ title: 'eWeLink saludable', description: `Estado: ${data.data?.status || 'OK'}` });
      } else {
        setHealthStatus('error');
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      setHealthStatus('error');
    }
  };

  const toggleDevice = async (deviceId: string, currentState: string) => {
    setToggling(prev => new Set(prev).add(deviceId));
    try {
      const newState = currentState === 'on' ? 'off' : 'on';
      const data = await eweFetch('/devices/control', {
        method: 'POST',
        body: JSON.stringify({ deviceId, action: newState }),
      });
      if (data.success) {
        setDevices(prev => prev.map(d =>
          d.deviceid === deviceId
            ? { ...d, params: { ...d.params, switch: newState } }
            : d
        ));
        toast({ title: `Dispositivo ${newState === 'on' ? 'encendido' : 'apagado'}` });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error al controlar dispositivo', variant: 'destructive' });
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(deviceId); return s; });
    }
  };

  const batchControl = async (action: 'on' | 'off') => {
    setLoading(true);
    try {
      const onlineDevices = devices.filter(d => d.online);
      const commands = onlineDevices.map(d => ({ deviceId: d.deviceid, action }));
      const data = await eweFetch('/devices/batch', {
        method: 'POST',
        body: JSON.stringify({ commands }),
      });
      if (data.success) {
        toast({ title: `Todos ${action === 'on' ? 'encendidos' : 'apagados'}`, description: `${onlineDevices.length} dispositivos` });
        await loadDevices();
      }
    } catch {
      toast({ title: 'Error en control masivo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importSiteId) {
      toast({ title: 'Seleccione un sitio', variant: 'destructive' });
      return;
    }
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    try {
      for (const d of devices) {
        try {
          await apiClient.post('/devices', {
            site_id: importSiteId,
            name: d.name || d.deviceid,
            type: 'relay',
            brand: 'sonoff',
            model: d.productModel || d.brandName || 'eWeLink Device',
            serial_number: d.deviceid,
            status: d.online ? 'online' : 'offline',
            channels: d.params?.switches?.length || 1,
            connection_type: 'cloud',
            capabilities: { toggle: true, cloud: true, platform: 'ewelink' },
            tags: ['ewelink', 'cloud', 'sonoff', 'iot'],
            notes: `Importado desde eWeLink. ID: ${d.deviceid}`,
          });
          imported++;
        } catch {
          skipped++; // Already exists or validation error
        }
      }

      toast({
        title: 'Importación completada',
        description: `${imported} importados, ${skipped} ya existían`,
      });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setImportOpen(false);
    } catch {
      toast({ title: 'Error al importar', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const getDeviceState = (d: EWeLinkDevice): string => {
    if (d.params?.switch) return d.params.switch;
    if (d.params?.switches?.length) return d.params.switches[0].switch;
    return 'unknown';
  };

  const onlineCount = devices.filter(d => d.online).length;
  const onDevices = devices.filter(d => getDeviceState(d) === 'on').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            eWeLink / Sonoff — Dispositivos IoT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Conecta tu cuenta de eWeLink para controlar interruptores, enchufes, relés y sensores Sonoff
                directamente desde Clave Seguridad.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email de eWeLink</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraseña</Label>
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña de eWeLink" type="password" />
                </div>
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full">
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {loading ? 'Conectando...' : 'Conectar a eWeLink'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">Conectado</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{devices.length} dispositivos</Badge>
                  <Badge variant="outline" className="text-[10px]">{onlineCount} en línea</Badge>
                  <Badge variant="outline" className="text-[10px] text-warning">{onDevices} encendidos</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={checkHealth} title="Verificar salud">
                    <Heart className={`h-3 w-3 ${healthStatus === 'healthy' ? 'text-success' : healthStatus === 'error' ? 'text-destructive' : ''}`} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadDevices} disabled={loading}>
                    <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Sync
                  </Button>
                  <Button size="sm" onClick={() => { setImportOpen(true); setImportSiteId(sites[0]?.id || ''); }}>
                    <Download className="mr-1 h-3 w-3" /> Importar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Batch controls */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-success" onClick={() => batchControl('on')} disabled={loading}>
                  <Power className="mr-1 h-3 w-3" /> Encender Todos
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => batchControl('off')} disabled={loading}>
                  <PowerOff className="mr-1 h-3 w-3" /> Apagar Todos
                </Button>
              </div>

              {/* Device grid */}
              {devices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {devices.map(device => {
                    const state = getDeviceState(device);
                    const isOn = state === 'on';
                    const isToggling = toggling.has(device.deviceid);

                    return (
                      <Card key={device.deviceid} className={`transition-colors ${isOn ? 'border-warning/30 bg-warning/5' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {device.online
                                  ? <Wifi className="h-3 w-3 text-success shrink-0" />
                                  : <WifiOff className="h-3 w-3 text-destructive shrink-0" />}
                                <span className="text-sm font-medium truncate">{device.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {device.productModel || device.brandName || 'Sonoff'}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                ID: {device.deviceid}
                              </div>
                              {device.params?.switches && device.params.switches.length > 1 && (
                                <div className="flex gap-1 mt-1.5">
                                  {device.params.switches.map((sw, i) => (
                                    <Badge key={i} variant={sw.switch === 'on' ? 'default' : 'secondary'} className="text-[9px]">
                                      CH{sw.outlet}: {sw.switch}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-1 ml-3">
                              <Switch
                                checked={isOn}
                                disabled={!device.online || isToggling}
                                onCheckedChange={() => toggleDevice(device.deviceid, state)}
                              />
                              <span className="text-[9px] text-muted-foreground">
                                {isToggling ? '...' : isOn ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ToggleLeft className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay dispositivos eWeLink vinculados</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Dispositivos eWeLink</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se importarán {devices.length} dispositivo(s) al inventario de Clave Seguridad como dispositivos IoT.
            </p>
            <div className="space-y-1.5">
              <Label>Sitio de destino *</Label>
              <Select value={importSiteId} onValueChange={setImportSiteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sitio" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg divide-y max-h-[200px] overflow-auto">
              {devices.map(d => (
                <div key={d.deviceid} className="flex items-center gap-3 p-2 text-sm">
                  <Zap className="h-3 w-3 text-warning shrink-0" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <Badge variant={d.online ? 'default' : 'secondary'} className="text-[9px]">
                    {d.online ? 'online' : 'offline'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {importing ? 'Importando...' : 'Importar Dispositivos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
