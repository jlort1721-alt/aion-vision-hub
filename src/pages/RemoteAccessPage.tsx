import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSites } from '@/hooks/use-api-data';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import {
  Globe, Server, Router, Monitor, Camera, Lock,
  Activity, CheckCircle2, XCircle, Wifi, WifiOff, Phone,
  Eye, Zap, Copy, Network, Signal, ArrowRight,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────

interface AccessMethod {
  protocol: string;
  port: number;
  url: string;
  description: string;
  requiresAuth: boolean;
}

interface PortForwardRule {
  externalPort: number;
  internalPort: number;
  protocol: string;
  service: string;
  description: string;
  deviceName?: string;
  deviceIp?: string | null;
}

interface DeviceAccessInfo {
  deviceId: string;
  name: string;
  siteName: string;
  siteId: string;
  type: string;
  brand: string;
  lanIp: string | null;
  wanIp: string | null;
  mappedPort: number | null;
  remoteAddress: string | null;
  accessMethods: AccessMethod[];
  connectivity: {
    reachable: boolean;
    latencyMs: number | null;
    lastChecked: string | null;
  };
  portForwarding: PortForwardRule[];
}

interface SiteAccessMap {
  site: { id: string; name: string; wanIp: string | null; address: string | null };
  devices: DeviceAccessInfo[];
  portForwardingSummary: PortForwardRule[];
}

interface ConnectivityResult {
  deviceId: string;
  name: string;
  host: string;
  port: number;
  reachable: boolean;
  latencyMs: number;
}

// ── Helpers ───────────────────────────────────────────────────

const typeIcons: Record<string, typeof Camera> = {
  camera: Camera, nvr: Server, dvr: Server, xvr: Server,
  router: Router, network_wan: Router, access_point: Wifi,
  intercom: Phone, access_control: Lock, encoder: Monitor,
};

const brandColors: Record<string, string> = {
  hikvision: 'bg-red-600/20 text-red-400 border-red-500/30',
  dahua: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  fanvil: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  grandstream: 'bg-teal-600/20 text-teal-400 border-teal-500/30',
  mikrotik: 'bg-sky-600/20 text-sky-400 border-sky-500/30',
  zkteco: 'bg-green-600/20 text-green-400 border-green-500/30',
  axis: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  generic_onvif: 'bg-zinc-600/20 text-zinc-400 border-zinc-500/30',
};

function copyToClipboard(text: string, toast: ReturnType<typeof useToast>['toast']) {
  navigator.clipboard.writeText(text);
  toast({ title: 'Copiado', description: text });
}

// ── Main Component ────────────────────────────────────────────

export default function RemoteAccessPage() {
  const { data: sitesData } = useSites();
  const { toast } = useToast();

  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [accessMap, setAccessMap] = useState<SiteAccessMap | null>(null);
  const [connectivityResults, setConnectivityResults] = useState<ConnectivityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnectivity, setTestingConnectivity] = useState(false);
  const [proxyResult, setProxyResult] = useState<Record<string, unknown> | null>(null);
  const [proxyLoading, setProxyLoading] = useState<string | null>(null);

  const sites = (sitesData ?? []) as Array<Record<string, unknown>>;

  // Load access map for selected site
  const loadAccessMap = useCallback(async (siteId: string) => {
    if (!siteId) return;
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: SiteAccessMap }>(`/remote-access/sites/${siteId}/access-map`);
      setAccessMap((response as Record<string, unknown>).data as SiteAccessMap);
      setConnectivityResults([]);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo cargar el mapa de acceso', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Test connectivity for all devices at site
  const testConnectivity = useCallback(async () => {
    if (!selectedSiteId) return;
    setTestingConnectivity(true);
    try {
      const response = await apiClient.post<{ data: { devices: ConnectivityResult[] } }>(`/remote-access/sites/${selectedSiteId}/test-connectivity`, {});
      const data = (response as Record<string, unknown>).data as { devices: ConnectivityResult[] };
      setConnectivityResults(data.devices);
      const online = (data.devices || []).filter(d => d.reachable).length;
      toast({ title: 'Prueba completada', description: `${online}/${data.devices.length} dispositivos alcanzables` });
    } catch (err) {
      toast({ title: 'Error', description: 'Error al probar conectividad', variant: 'destructive' });
    } finally {
      setTestingConnectivity(false);
    }
  }, [selectedSiteId, toast]);

  // Proxy HTTP request to device
  const proxyRequest = useCallback(async (deviceId: string, path: string) => {
    setProxyLoading(deviceId);
    try {
      const response = await apiClient.post<{ data: Record<string, unknown> }>(`/remote-access/devices/${deviceId}/proxy`, {
        method: 'GET',
        path,
        timeout: 15000,
      });
      setProxyResult((response as Record<string, unknown>).data as Record<string, unknown>);
      toast({ title: 'Proxy exitoso', description: `Respuesta del dispositivo recibida` });
    } catch (err) {
      toast({ title: 'Error de proxy', description: 'No se pudo conectar al dispositivo', variant: 'destructive' });
    } finally {
      setProxyLoading(null);
    }
  }, [toast]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setAccessMap(null);
    setConnectivityResults([]);
    setProxyResult(null);
    loadAccessMap(siteId);
  };

  // Merge connectivity data with device access info
  const getDeviceConnectivity = (deviceId: string) => {
    return connectivityResults.find(r => r.deviceId === deviceId);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            AION Remote Connect
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acceso remoto universal a equipos de seguridad — Proxy HTTP, RTSP, SIP, ISAPI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSiteId} onValueChange={handleSiteChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Seleccionar sitio..." />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id as string} value={site.id as string}>
                  <div className="flex items-center gap-2">
                    <Signal className="h-3 w-3" />
                    {String(site.name || '')}
                    {site.wan_ip && (
                      <span className="text-xs text-muted-foreground ml-1">({String(site.wan_ip)})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSiteId && (
            <Button
              variant="outline"
              size="sm"
              onClick={testConnectivity}
              disabled={testingConnectivity}
            >
              {testingConnectivity ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Activity className="h-4 w-4 mr-1" />}
              Probar Conectividad
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Cargando mapa de acceso...</span>
        </div>
      )}

      {/* No site selected */}
      {!selectedSiteId && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Selecciona un sitio para comenzar</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Verás todos los dispositivos, puertos mapeados, y URLs de acceso remoto
            </p>
          </CardContent>
        </Card>
      )}

      {/* Access Map Loaded */}
      {accessMap && (
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="devices" className="gap-1">
              <Server className="h-3.5 w-3.5" /> Dispositivos ({accessMap.devices.length})
            </TabsTrigger>
            <TabsTrigger value="port-forwarding" className="gap-1">
              <Network className="h-3.5 w-3.5" /> Port Forwarding ({accessMap.portForwardingSummary.length})
            </TabsTrigger>
            <TabsTrigger value="proxy" className="gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> Proxy HTTP
            </TabsTrigger>
          </TabsList>

          {/* ── Site Info Banner ─────────────────────────────── */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="font-semibold">{accessMap.site.name}</span>
                  {accessMap.site.address && (
                    <span className="text-xs text-muted-foreground ml-2">| {accessMap.site.address}</span>
                  )}
                </div>
                {accessMap.site.wanIp && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => copyToClipboard(accessMap.site.wanIp!, toast)}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    WAN: {accessMap.site.wanIp}
                    <Copy className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {connectivityResults.length > 0 && (
                  <>
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {connectivityResults.filter(r => r.reachable).length} En línea
                    </Badge>
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {connectivityResults.filter(r => !r.reachable).length} Fuera de línea
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Tab: Devices ────────────────────────────────── */}
          <TabsContent value="devices" className="space-y-3">
            {(accessMap.devices || []).map((device) => {
              const conn = getDeviceConnectivity(device.deviceId);
              const Icon = typeIcons[device.type] ?? Monitor;
              const colorClass = brandColors[device.brand] ?? brandColors.generic_onvif;

              return (
                <Card key={device.deviceId} className="overflow-hidden">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg border', colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{device.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {device.brand}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {device.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Connection info */}
                        <div className="text-right text-xs space-y-0.5">
                          {device.lanIp && (
                            <div className="text-muted-foreground">
                              LAN: <span className="font-mono">{device.lanIp}</span>
                            </div>
                          )}
                          {device.remoteAddress && (
                            <div
                              className="font-mono cursor-pointer hover:text-primary"
                              onClick={() => copyToClipboard(device.remoteAddress!, toast)}
                            >
                              WAN: <span className="text-primary font-semibold">{device.remoteAddress}</span>
                              <Copy className="h-3 w-3 inline ml-1" />
                            </div>
                          )}
                        </div>
                        {/* Connectivity status */}
                        {conn && (
                          <Badge variant={conn.reachable ? 'default' : 'destructive'} className={conn.reachable ? 'bg-green-600' : ''}>
                            {conn.reachable ? (
                              <><Wifi className="h-3 w-3 mr-1" />{conn.latencyMs}ms</>
                            ) : (
                              <><WifiOff className="h-3 w-3 mr-1" />Fuera de línea</>
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {(device.accessMethods || []).length > 0 && (
                    <CardContent className="py-2 px-4 border-t bg-muted/30">
                      <div className="flex flex-wrap gap-2">
                        {(device.accessMethods || []).map((method, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/20 text-[11px] font-mono"
                            onClick={() => copyToClipboard(method.url, toast)}
                          >
                            <span className="uppercase text-[9px] font-bold mr-1 text-primary">
                              {method.protocol}
                            </span>
                            :{method.port}
                            <Copy className="h-2.5 w-2.5 ml-1 opacity-50" />
                          </Badge>
                        ))}
                        {/* Quick proxy button for cameras/DVRs */}
                        {['camera', 'nvr', 'dvr', 'xvr'].includes(device.type) && device.remoteAddress && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => proxyRequest(device.deviceId, device.brand === 'hikvision' ? '/ISAPI/System/deviceInfo' : '/')}
                            disabled={proxyLoading === device.deviceId}
                          >
                            {proxyLoading === device.deviceId ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Eye className="h-3 w-3 mr-1" />
                            )}
                            Info
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          {/* ── Tab: Port Forwarding ────────────────────────── */}
          <TabsContent value="port-forwarding">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Reglas de Port Forwarding — {accessMap.site.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Configurar estas reglas en el router del sitio ({accessMap.site.wanIp ?? 'WAN IP no configurada'})
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Puerto Externo</TableHead>
                      <TableHead>Puerto Interno</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(accessMap.portForwardingSummary || []).map((rule, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono font-bold text-primary">{rule.externalPort}</TableCell>
                        <TableCell className="font-mono">{rule.internalPort}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{rule.protocol}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{rule.service}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{rule.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {accessMap.portForwardingSummary.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    No hay reglas de port forwarding definidas para este sitio
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: HTTP Proxy ──────────────────────────────── */}
          <TabsContent value="proxy">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  HTTP Reverse Proxy — Acceso a dispositivos
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enviar peticiones HTTP a dispositivos remotos a traves de AION como proxy
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProxyPanel
                  devices={accessMap.devices}
                  onProxy={proxyRequest}
                  loading={proxyLoading}
                  result={proxyResult}
                  toast={toast}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Proxy Panel Sub-component ─────────────────────────────────

function ProxyPanel({
  devices,
  onProxy,
  loading,
  result,
  toast,
}: {
  devices: DeviceAccessInfo[];
  onProxy: (deviceId: string, path: string) => void;
  loading: string | null;
  result: Record<string, unknown> | null;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [proxyPath, setProxyPath] = useState('/');

  const quickPaths: Record<string, Array<{ label: string; path: string }>> = {
    hikvision: [
      { label: 'Device Info', path: '/ISAPI/System/deviceInfo' },
      { label: 'Channels', path: '/ISAPI/System/Video/inputs/channels' },
      { label: 'HDD Status', path: '/ISAPI/ContentMgmt/Storage/hdd' },
      { label: 'Network', path: '/ISAPI/System/Network/interfaces' },
      { label: 'Time', path: '/ISAPI/System/time' },
      { label: 'Users', path: '/ISAPI/Security/users' },
    ],
    dahua: [
      { label: 'System Info', path: '/cgi-bin/magicBox.cgi?action=getSystemInfo' },
      { label: 'Software Version', path: '/cgi-bin/magicBox.cgi?action=getSoftwareVersion' },
      { label: 'HDD Info', path: '/cgi-bin/diskManager.cgi?action=factory.getCollect' },
      { label: 'Network', path: '/cgi-bin/configManager.cgi?action=getConfig&name=Network' },
    ],
    fanvil: [
      { label: 'Status', path: '/cgi-bin/ConfigManApp.com?Id=34' },
    ],
  };

  const selectedDevice = devices.find(d => d.deviceId === selectedDeviceId);
  const brand = selectedDevice?.brand?.toLowerCase() ?? '';
  const paths = quickPaths[brand] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Seleccionar dispositivo..." />
          </SelectTrigger>
          <SelectContent>
            {devices.filter(d => d.remoteAddress).map(d => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.name} ({d.remoteAddress})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={proxyPath}
          onChange={(e) => setProxyPath(e.target.value)}
          placeholder="/ISAPI/System/deviceInfo"
          className="flex-1 font-mono text-sm"
        />
        <Button
          onClick={() => selectedDeviceId && onProxy(selectedDeviceId, proxyPath)}
          disabled={!selectedDeviceId || loading === selectedDeviceId}
        >
          {loading === selectedDeviceId ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Zap className="h-4 w-4 mr-1" />
          )}
          Enviar
        </Button>
      </div>

      {/* Quick paths */}
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Rutas rápidas:</span>
          {paths.map((p, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setProxyPath(p.path);
                if (selectedDeviceId) onProxy(selectedDeviceId, p.path);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant={Number(result.statusCode) < 300 ? 'default' : 'destructive'}>
                {String(result.statusCode)}
              </Badge>
              <span className="text-muted-foreground">{String(result.latencyMs)}ms</span>
              {(result.target as Record<string, unknown>)?.deviceName && (
                <span className="font-medium">{(result.target as Record<string, unknown>).deviceName as string}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => copyToClipboard(result.body as string, toast)}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
          <pre className="p-3 text-xs overflow-auto max-h-[400px] bg-background font-mono whitespace-pre-wrap">
            {typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
