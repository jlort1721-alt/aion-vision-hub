import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSites } from '@/hooks/use-supabase-data';
import { useQueryClient } from '@tanstack/react-query';
import {
  Cloud, CloudOff, RefreshCw, Download, Check, X, Eye, Video,
  MonitorSpeaker, Wifi, WifiOff, Lock, Camera, Play,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CloudDevice {
  platform: 'ezviz' | 'imou';
  serialOrId: string;
  name: string;
  model: string;
  type: string;
  status: 'online' | 'offline';
  channels: number;
  channelList: Array<{ id: string | number; name: string; status: string }>;
  capabilities: { ptz: boolean; talk: boolean; video: boolean };
}

async function cloudFetch(path: string, options?: RequestInit) {
  const resp = await fetch(`${API_URL}/api/v1/cloud${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  return resp.json();
}

export default function CloudAccountsPanel() {
  const [platform, setPlatform] = useState<'ezviz' | 'imou'>('ezviz');
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<{ ezviz: boolean; imou: boolean }>({ ezviz: false, imou: false });
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importSiteId, setImportSiteId] = useState('');
  const [importing, setImporting] = useState(false);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamDevice, setStreamDevice] = useState<string | null>(null);

  const { toast } = useToast();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();

  const handleLogin = async () => {
    if (!appKey.trim() || !appSecret.trim()) {
      toast({ title: 'Error', description: 'Ingrese App Key y App Secret', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const endpoint = platform === 'ezviz' ? '/ezviz/login' : '/imou/login';
      const body = platform === 'ezviz'
        ? { appKey: appKey.trim(), appSecret: appSecret.trim() }
        : { appId: appKey.trim(), appSecret: appSecret.trim() };

      const data = await cloudFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });

      if (data.success) {
        setConnected(prev => ({ ...prev, [platform]: true }));
        toast({ title: 'Conectado', description: data.data?.message || `Conectado a ${platform === 'ezviz' ? 'Hik-Connect' : 'DMSS'}` });
        // Auto-load devices
        await loadDevices();
      } else {
        toast({ title: 'Error de conexión', description: data.error || 'No se pudo autenticar', variant: 'destructive' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const endpoint = platform === 'ezviz' ? '/ezviz/devices' : '/imou/devices';
      const data = await cloudFetch(endpoint);

      if (data.success && data.data?.devices) {
        setDevices(data.data.devices);
        toast({ title: `${data.data.total} dispositivos encontrados`, description: `${data.data.online} en línea` });
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudieron cargar dispositivos', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importSiteId) {
      toast({ title: 'Error', description: 'Seleccione un sitio', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const endpoint = platform === 'ezviz' ? '/ezviz/import' : '/imou/import';
      const serials = selectedForImport.size > 0 ? Array.from(selectedForImport) : undefined;
      const body = platform === 'ezviz'
        ? { siteId: importSiteId, deviceSerials: serials }
        : { siteId: importSiteId, deviceIds: serials };

      const data = await cloudFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });

      if (data.success) {
        toast({
          title: 'Importación completada',
          description: `${data.data.imported} importados, ${data.data.skipped} ya existían`,
        });
        queryClient.invalidateQueries({ queryKey: ['devices'] });
        setImportOpen(false);
        setSelectedForImport(new Set());
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al importar', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const getStream = async (serialOrId: string, channel: number = 1) => {
    try {
      const endpoint = platform === 'ezviz'
        ? `/ezviz/devices/${serialOrId}/stream?channel=${channel}`
        : `/imou/devices/${serialOrId}/stream?channel=${channel}`;

      const data = await cloudFetch(endpoint, { method: 'POST' });

      if (data.success && data.data?.hlsUrl) {
        setStreamUrl(data.data.hlsUrl);
        setStreamDevice(serialOrId);
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo obtener stream', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al obtener stream', variant: 'destructive' });
    }
  };

  const toggleImportSelection = (id: string) => {
    setSelectedForImport(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'nvr': case 'dvr': return <MonitorSpeaker className="h-4 w-4" />;
      case 'intercom': return <Lock className="h-4 w-4" />;
      case 'accesscontrol': return <Lock className="h-4 w-4" />;
      default: return <Camera className="h-4 w-4" />;
    }
  };

  const isPlatformConnected = connected[platform];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Cuentas Cloud — Hik-Connect / DMSS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={platform} onValueChange={(v) => { setPlatform(v as 'ezviz' | 'imou'); setDevices([]); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="ezviz" className="gap-1.5">
                {connected.ezviz ? <Cloud className="h-3.5 w-3.5 text-green-400" /> : <CloudOff className="h-3.5 w-3.5" />}
                Hik-Connect / EZVIZ
              </TabsTrigger>
              <TabsTrigger value="imou" className="gap-1.5">
                {connected.imou ? <Cloud className="h-3.5 w-3.5 text-green-400" /> : <CloudOff className="h-3.5 w-3.5" />}
                DMSS / IMOU
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ezviz" className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">
                Conecta tu cuenta de Hik-Connect para importar automáticamente cámaras, NVR, DVR, video porteros y controles de acceso Hikvision.
                Obtén tus credenciales en <span className="font-mono text-primary">open.ezviz.com</span>
              </p>
            </TabsContent>
            <TabsContent value="imou" className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">
                Conecta tu cuenta DMSS/IMOU para importar automáticamente cámaras, NVR y dispositivos Dahua.
                Obtén tus credenciales en <span className="font-mono text-primary">open.imoulife.com</span>
              </p>
            </TabsContent>
          </Tabs>

          {!isPlatformConnected ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{platform === 'ezviz' ? 'App Key' : 'App ID'}</Label>
                <Input
                  value={appKey}
                  onChange={e => setAppKey(e.target.value)}
                  placeholder={platform === 'ezviz' ? 'EZVIZ App Key' : 'IMOU App ID'}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>App Secret</Label>
                <Input
                  type="password"
                  value={appSecret}
                  onChange={e => setAppSecret(e.target.value)}
                  placeholder="App Secret"
                />
              </div>
              <div className="col-span-2">
                <Button onClick={handleLogin} disabled={loading} className="w-full">
                  {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                  {loading ? 'Conectando...' : `Conectar a ${platform === 'ezviz' ? 'Hik-Connect' : 'DMSS'}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Conectado</span>
                  <Badge variant="secondary" className="text-[10px]">{devices.length} dispositivos</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadDevices} disabled={loading}>
                    <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                  </Button>
                  <Button size="sm" onClick={() => { setImportOpen(true); setImportSiteId(sites[0]?.id || ''); }}>
                    <Download className="mr-1 h-3 w-3" /> Importar a Clave Seguridad
                  </Button>
                </div>
              </div>

              {/* Device list */}
              {devices.length > 0 && (
                <div className="border rounded-lg divide-y max-h-[400px] overflow-auto">
                  {devices.map(device => (
                    <div key={device.serialOrId} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <div className="shrink-0">
                        {device.status === 'online'
                          ? <Wifi className="h-4 w-4 text-green-400" />
                          : <WifiOff className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="shrink-0 text-muted-foreground">{typeIcon(device.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{device.name}</span>
                          <Badge variant="outline" className="text-[9px] capitalize shrink-0">{device.type}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {device.model} · SN: <span className="font-mono">{device.serialOrId}</span>
                          {device.channels > 1 && <span> · {device.channels} canales</span>}
                        </div>
                        {device.channelList.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {device.channelList.map(ch => (
                              <Badge key={String(ch.id)} variant={ch.status === 'online' ? 'default' : 'secondary'} className="text-[8px]">
                                {ch.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {device.status === 'online' && device.capabilities.video && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver stream" onClick={() => getStream(device.serialOrId)}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalles">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stream preview */}
              {streamUrl && (
                <Card className="bg-black">
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/60">Stream: {streamDevice}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white/60" onClick={() => { setStreamUrl(null); setStreamDevice(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <video
                      src={streamUrl}
                      autoPlay
                      muted
                      controls
                      className="w-full rounded aspect-video bg-black"
                    />
                    <p className="text-[10px] text-white/40 mt-1">HLS Cloud Stream — {platform === 'ezviz' ? 'EZVIZ' : 'IMOU'}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Dispositivos Cloud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sitio de destino *</Label>
              <Select value={importSiteId} onValueChange={setImportSiteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sitio" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Todos los dispositivos importados se asignarán a este sitio.</p>
            </div>

            <div className="space-y-2">
              <Label>Dispositivos a importar ({selectedForImport.size > 0 ? `${selectedForImport.size} seleccionados` : 'todos'})</Label>
              <div className="border rounded-lg divide-y max-h-[250px] overflow-auto">
                {devices.map(d => (
                  <label key={d.serialOrId} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedForImport.has(d.serialOrId)}
                      onChange={() => toggleImportSelection(d.serialOrId)}
                      className="rounded"
                    />
                    <span className="text-sm">{d.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{d.model}</span>
                    <Badge variant={d.status === 'online' ? 'default' : 'secondary'} className="text-[9px]">{d.status}</Badge>
                  </label>
                ))}
              </div>
              {selectedForImport.size === 0 && <p className="text-xs text-muted-foreground">Si no selecciona ninguno, se importarán todos.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {importing ? 'Importando...' : `Importar ${selectedForImport.size > 0 ? selectedForImport.size : devices.length} dispositivos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
