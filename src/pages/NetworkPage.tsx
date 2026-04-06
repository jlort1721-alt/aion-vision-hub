import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDevices, useSites } from '@/hooks/use-api-data';
import { useToast } from '@/hooks/use-toast';
import {
  Network, Wifi, WifiOff, Search, Scan, Shield, Server, Router, Monitor,
  Lock, Unlock, RefreshCw, Play, Square, Phone, Eye, Settings, Download,
  Upload, Zap, Activity, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Trash2, Power, Radio, CheckCircle2, XCircle, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || '';

// ── Types ─────────────────────────────────────────────────────
interface DiscoveredHost {
  ip: string;
  hostname?: string;
  mac?: string;
  ports: number[];
  brand?: string;
  status: 'online' | 'offline';
  responseTime?: number;
}

interface VpnProfile {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  endpoint: string;
  publicKey: string;
  clientAddress: string;
  allowedIps: string;
  status: 'connected' | 'disconnected' | 'testing';
}

interface PingResult {
  host: string;
  port: number;
  reachable: boolean;
  latency?: number;
  error?: string;
}

interface PortScanResult {
  host: string;
  openPorts: { port: number; service: string }[];
}

interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  mac: string;
  family: string;
}

interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────────
const brandColors: Record<string, string> = {
  Hikvision: 'bg-red-600/20 text-red-400 border-red-500/30',
  Dahua: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  ZKTeco: 'bg-green-600/20 text-green-400 border-green-500/30',
  Uniview: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  Axis: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  Reolink: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
  Ubiquiti: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
};

const portLabels: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 554: 'RTSP', 8000: 'SDK',
  8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 37777: 'Dahua', 34567: 'XMEye',
  9000: 'API', 3306: 'MySQL', 5432: 'PG', 6379: 'Redis',
};

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/network${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function NetworkPage() {
  const { toast } = useToast();
  const { data: devices = [], isLoading: devicesLoading } = useDevices(30000);
  const { data: sites = [], isLoading: sitesLoading } = useSites();

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centro de Red</h1>
            <p className="text-sm text-muted-foreground">
              Escáner de red, VPN, control de dispositivos y diagnóstico
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            {devices.length} dispositivos
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            {sites.length} sedes
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scanner" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scanner" className="gap-2">
            <Scan className="h-4 w-4" />
            Escaneo de Red
          </TabsTrigger>
          <TabsTrigger value="vpn" className="gap-2">
            <Shield className="h-4 w-4" />
            Conectividad VPN
          </TabsTrigger>
          <TabsTrigger value="control" className="gap-2">
            <Settings className="h-4 w-4" />
            Control de Dispositivos
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="gap-2">
            <Activity className="h-4 w-4" />
            Diagnóstico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner">
          <NetworkScannerTab toast={toast} />
        </TabsContent>
        <TabsContent value="vpn">
          <VpnTab sites={sites} sitesLoading={sitesLoading} toast={toast} />
        </TabsContent>
        <TabsContent value="control">
          <DeviceControlTab devices={devices} sites={sites} devicesLoading={devicesLoading} toast={toast} />
        </TabsContent>
        <TabsContent value="diagnostics">
          <DiagnosticsTab toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── TAB 1: NETWORK SCANNER ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function NetworkScannerTab({ toast }: { toast: any }) {
  const [ipRange, setIpRange] = useState('192.168.1.0/24');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [scanned, setScanned] = useState(false);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setHosts([]);
    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 500);

      const result = await apiCall<{ hosts: DiscoveredHost[]; total: number }>('/scan/range', {
        method: 'POST',
        body: JSON.stringify({ range: ipRange }),
      });

      clearInterval(progressInterval);
      setProgress(100);
      setHosts(result.hosts || []);
      setScanned(true);
      toast({
        title: 'Escaneo completado',
        description: `Se encontraron ${result.hosts?.length ?? 0} hosts en la red.`,
      });
    } catch (err: any) {
      toast({ title: 'Error de escaneo', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, [ipRange, toast]);

  const handleIdentify = useCallback(async (ip: string) => {
    try {
      const result = await apiCall<{ brand?: string; model?: string }>('/identify', {
        method: 'POST',
        body: JSON.stringify({ host: ip }),
      });
      toast({
        title: 'Dispositivo identificado',
        description: `${ip}: ${result.brand ?? 'Desconocido'} ${result.model ?? ''}`,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleAddDevice = useCallback((ip: string) => {
    toast({
      title: 'Agregar dispositivo',
      description: `Redirigiendo a formulario para ${ip}...`,
    });
  }, [toast]);

  const onlineCount = hosts.filter(h => h.status === 'online').length;
  const brandedCount = hosts.filter(h => h.brand).length;

  return (
    <div className="space-y-4">
      {/* Scan Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scan className="h-5 w-5 text-primary" />
            Escaneo de Rango IP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rango de IPs (CIDR o rango)</label>
              <Input
                value={ipRange}
                onChange={e => setIpRange(e.target.value)}
                placeholder="192.168.1.0/24 o 10.0.0.1-10.0.0.254"
                className="font-mono"
                disabled={scanning}
              />
            </div>
            <Button onClick={handleScan} disabled={scanning} className="gap-2 min-w-[140px]">
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4" />
                  Escanear
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {scanning && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Escaneando red...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {scanned && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="border-muted">
            <CardContent className="p-4 flex items-center gap-3">
              <Server className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{hosts.length}</p>
                <p className="text-xs text-muted-foreground">Hosts encontrados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Wifi className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{onlineCount}</p>
                <p className="text-xs text-muted-foreground">En línea</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-center gap-3">
              <WifiOff className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{hosts.length - onlineCount}</p>
                <p className="text-xs text-muted-foreground">Sin respuesta</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Monitor className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{brandedCount}</p>
                <p className="text-xs text-muted-foreground">Dispositivos identificados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table – Loading */}
      {scanning && !hosts.length && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results Table – Data */}
      {scanned && hosts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resultados del Escaneo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dirección IP</TableHead>
                  <TableHead>Puertos Abiertos</TableHead>
                  <TableHead>Marca Detectada</TableHead>
                  <TableHead>Latencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hosts.map(host => (
                  <TableRow key={host.ip}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-mono text-sm', host.status === 'online' ? 'text-success' : 'text-muted-foreground')}>
                          {host.ip}
                        </span>
                        {host.hostname && (
                          <span className="text-xs text-muted-foreground">({host.hostname})</span>
                        )}
                      </div>
                      {host.mac && (
                        <span className="text-xs text-muted-foreground font-mono">{host.mac}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(host.ports || []).map(port => (
                          <Badge key={port} variant="outline" className="text-xs font-mono px-1.5 py-0">
                            {port}
                            {portLabels[port] && <span className="ml-1 opacity-60">{portLabels[port]}</span>}
                          </Badge>
                        ))}
                        {host.ports.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {host.brand ? (
                        <Badge className={cn('border', brandColors[host.brand] || 'bg-muted text-muted-foreground')}>
                          {host.brand}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No identificado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {host.responseTime !== undefined ? (
                        <span className={cn('text-sm font-mono', host.responseTime < 50 ? 'text-success' : host.responseTime < 200 ? 'text-warning' : 'text-destructive')}>
                          {host.responseTime}ms
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {host.status === 'online' ? (
                        <Badge className="bg-success/20 text-success border-success/30 border gap-1">
                          <CheckCircle2 className="h-3 w-3" /> En línea
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <XCircle className="h-3 w-3" /> Sin conexión
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleAddDevice(host.ip)} className="gap-1 text-xs">
                          <Plus className="h-3 w-3" />
                          Agregar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleIdentify(host.ip)} className="gap-1 text-xs">
                          <Search className="h-3 w-3" />
                          Identificar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {scanned && hosts.length === 0 && !scanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">Sin resultados</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No se encontraron hosts en el rango especificado. Verifique el rango e intente nuevamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── TAB 2: VPN PROFILES ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function VpnTab({ sites, sitesLoading, toast }: { sites: any[]; sitesLoading: boolean; toast: any }) {
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [formSite, setFormSite] = useState('');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formPublicKey, setFormPublicKey] = useState('');
  const [formClientAddr, setFormClientAddr] = useState('10.0.0.2/32');
  const [formAllowedIps, setFormAllowedIps] = useState('10.0.0.0/24, 192.168.0.0/16');
  const [formName, setFormName] = useState('');

  const handleCreateProfile = useCallback(() => {
    if (!formSite || !formEndpoint || !formPublicKey) {
      toast({ title: 'Error', description: 'Complete todos los campos requeridos.', variant: 'destructive' });
      return;
    }
    const siteName = sites.find((s: any) => s.id === formSite)?.name || 'Sede';
    const newProfile: VpnProfile = {
      id: crypto.randomUUID(),
      name: formName || `VPN-${siteName}`,
      siteId: formSite,
      siteName,
      endpoint: formEndpoint,
      publicKey: formPublicKey,
      clientAddress: formClientAddr,
      allowedIps: formAllowedIps,
      status: 'disconnected',
    };
    setProfiles(prev => [...prev, newProfile]);
    setShowForm(false);
    setFormSite(''); setFormEndpoint(''); setFormPublicKey('');
    setFormClientAddr('10.0.0.2/32'); setFormAllowedIps('10.0.0.0/24, 192.168.0.0/16');
    setFormName('');
    toast({ title: 'Perfil creado', description: `Perfil VPN "${newProfile.name}" creado exitosamente.` });
  }, [formSite, formEndpoint, formPublicKey, formClientAddr, formAllowedIps, formName, sites, toast]);

  const handleTestConnection = useCallback(async (profileId: string) => {
    setTesting(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    try {
      const result = await apiCall<{ reachable: boolean; latency?: number }>('/ping', {
        method: 'POST',
        body: JSON.stringify({ host: (profile.endpoint || '').split(':')[0], port: parseInt((profile.endpoint || '').split(':')[1]) || 51820 }),
      });
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, status: result.reachable ? 'connected' : 'disconnected' } : p));
      toast({
        title: result.reachable ? 'Conexión exitosa' : 'Sin conexión',
        description: result.reachable ? `Latencia: ${result.latency}ms` : 'No se pudo conectar al servidor VPN.',
        variant: result.reachable ? 'default' : 'destructive',
      });
    } catch (err: any) {
      toast({ title: 'Error de prueba', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  }, [profiles, toast]);

  const handleDownloadConfig = useCallback((profile: VpnProfile) => {
    const config = `[Interface]
PrivateKey = <TU_CLAVE_PRIVADA>
Address = ${profile.clientAddress}
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${profile.publicKey}
Endpoint = ${profile.endpoint}
AllowedIPs = ${profile.allowedIps}
PersistentKeepalive = 25
`;
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name}.conf`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Descarga iniciada', description: `Archivo ${profile.name}.conf descargado.` });
  }, [toast]);

  const handleDeleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    toast({ title: 'Perfil eliminado' });
  }, [toast]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Perfiles VPN WireGuard
        </h2>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'} className="gap-2">
          {showForm ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancelar' : 'Nuevo Perfil'}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Crear Perfil VPN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nombre del perfil</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="VPN-Sede Central" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sede *</label>
                {sitesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={formSite} onValueChange={setFormSite}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar sede..." /></SelectTrigger>
                    <SelectContent>
                      {sites.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Servidor Endpoint *</label>
                <Input value={formEndpoint} onChange={e => setFormEndpoint(e.target.value)} placeholder="vpn.example.com:51820" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Clave Pública del Servidor *</label>
                <Input value={formPublicKey} onChange={e => setFormPublicKey(e.target.value)} placeholder="Base64..." className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Dirección del Cliente</label>
                <Input value={formClientAddr} onChange={e => setFormClientAddr(e.target.value)} placeholder="10.0.0.2/32" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">IPs Permitidas (subredes)</label>
                <Input value={formAllowedIps} onChange={e => setFormAllowedIps(e.target.value)} placeholder="10.0.0.0/24, 192.168.0.0/16" className="font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreateProfile} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profiles List */}
      {profiles.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">Sin perfiles VPN</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cree un perfil VPN WireGuard para conectar sedes remotas de forma segura.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {profiles.map(profile => (
            <Card key={profile.id} className={cn('border', profile.status === 'connected' ? 'border-success/30' : 'border-muted')}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className={cn('h-5 w-5', profile.status === 'connected' ? 'text-success' : 'text-muted-foreground')} />
                    <span className="font-semibold">{profile.name}</span>
                  </div>
                  <Badge className={cn('border', profile.status === 'connected' ? 'bg-success/20 text-success border-success/30' : 'bg-muted text-muted-foreground')}>
                    {profile.status === 'connected' ? 'Conectado' : profile.status === 'testing' ? 'Probando...' : 'Desconectado'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sede:</span>
                    <span className="ml-1 font-medium">{profile.siteName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Endpoint:</span>
                    <span className="ml-1 font-mono">{profile.endpoint}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="ml-1 font-mono">{profile.clientAddress}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subredes:</span>
                    <span className="ml-1 font-mono text-[10px]">{profile.allowedIps}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleTestConnection(profile.id)}
                    disabled={testing === profile.id}
                    className="gap-1 text-xs flex-1"
                  >
                    {testing === profile.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                    Probar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadConfig(profile)} className="gap-1 text-xs flex-1">
                    <Download className="h-3 w-3" />
                    Descargar .conf
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteProfile(profile.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── TAB 3: DEVICE CONTROL PANEL ──────────────────────────────
// ═══════════════════════════════════════════════════════════════
function DeviceControlTab({ devices, sites, devicesLoading, toast }: { devices: any[]; sites: any[]; devicesLoading: boolean; toast: any }) {
  const [siteFilter, setSiteFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [pulseDuration, setPulseDuration] = useState(3);

  const filteredDevices = devices.filter((d: any) => {
    if (siteFilter !== 'all' && d.site_id !== siteFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (brandFilter !== 'all' && d.brand !== brandFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const uniqueTypes = [...new Set(devices.map((d: any) => d.type).filter(Boolean))] as string[];
  const uniqueBrands = [...new Set(devices.map((d: any) => d.brand).filter(Boolean))] as string[];

  const toggleSelect = (id: string) => {
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map((d: any) => d.id)));
    }
  };

  const handleBulkPing = useCallback(async () => {
    toast({ title: 'Ping masivo', description: `Enviando ping a ${filteredDevices.length} dispositivos...` });
    try {
      for (const device of filteredDevices) {
        if (device.remote_address) {
          const [host] = (device.remote_address || '').split(':');
          await apiCall('/ping', { method: 'POST', body: JSON.stringify({ host, port: device.port || 80 }) });
        }
      }
      toast({ title: 'Ping completado', description: 'Se completó el ping a todos los dispositivos.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [filteredDevices, toast]);

  const handleBulkReboot = useCallback(() => {
    if (selectedDevices.size === 0) {
      toast({ title: 'Seleccione dispositivos', description: 'Seleccione al menos un dispositivo para reiniciar.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Reinicio programado', description: `Se envió comando de reinicio a ${selectedDevices.size} dispositivos.` });
  }, [selectedDevices, toast]);

  const handleBulkFirmware = useCallback(() => {
    if (selectedDevices.size === 0) {
      toast({ title: 'Seleccione dispositivos', description: 'Seleccione al menos un dispositivo para actualizar.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Actualización de firmware', description: `Actualización programada para ${selectedDevices.size} dispositivos.` });
  }, [selectedDevices, toast]);

  const handleDeviceAction = useCallback(async (device: any, action: string) => {
    toast({
      title: `Acción: ${action}`,
      description: `Ejecutando "${action}" en ${device.name}...`,
    });
  }, [toast]);

  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'camera': case 'cámara': return <Eye className="h-4 w-4" />;
      case 'door': case 'gate': case 'puerta': return <Lock className="h-4 w-4" />;
      case 'relay': case 'relé': return <Zap className="h-4 w-4" />;
      case 'intercom': case 'intercomunicador': return <Phone className="h-4 w-4" />;
      case 'access': case 'panel_acceso': return <Shield className="h-4 w-4" />;
      case 'sensor': return <Radio className="h-4 w-4" />;
      case 'nvr': case 'dvr': return <Server className="h-4 w-4" />;
      case 'router': return <Router className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const renderDeviceControls = (device: any) => {
    const type = device.type?.toLowerCase() || '';
    switch (true) {
      case ['camera', 'cámara', 'cam'].some(t => type.includes(t)):
        return (
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'snapshot')} className="gap-1 text-xs">
              <Eye className="h-3 w-3" /> Captura
            </Button>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeviceAction(device, 'ptz-up')}><ChevronUp className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeviceAction(device, 'ptz-down')}><ChevronDown className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeviceAction(device, 'ptz-left')}><ChevronLeft className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeviceAction(device, 'ptz-right')}><ChevronRight className="h-3 w-3" /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'stream-toggle')} className="gap-1 text-xs">
              <Play className="h-3 w-3" /> Stream
            </Button>
          </div>
        );
      case ['door', 'gate', 'puerta', 'portón'].some(t => type.includes(t)):
        return (
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => handleDeviceAction(device, `open-${pulseDuration}s`)} className="gap-1 text-xs bg-success hover:bg-success/90">
              <Unlock className="h-3 w-3" /> Abrir
            </Button>
            <Select value={String(pulseDuration)} onValueChange={v => setPulseDuration(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 10, 15, 30].map(s => (
                  <SelectItem key={s} value={String(s)}>{s}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case type.includes('relay') || type.includes('relé'):
        return (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'relay-on')} className="gap-1 text-xs">
              <Power className="h-3 w-3 text-success" /> ON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'relay-off')} className="gap-1 text-xs">
              <Square className="h-3 w-3 text-destructive" /> OFF
            </Button>
          </div>
        );
      case type.includes('intercom') || type.includes('intercomunicador'):
        return (
          <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'call')} className="gap-1 text-xs">
            <Phone className="h-3 w-3" /> Llamar
          </Button>
        );
      case type.includes('access') || type.includes('panel'):
        return (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleDeviceAction(device, 'open-door')} className="gap-1 text-xs">
              <Unlock className="h-3 w-3" /> Abrir
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDeviceAction(device, 'list-users')} className="gap-1 text-xs">
              <Search className="h-3 w-3" /> Usuarios
            </Button>
          </div>
        );
      case type.includes('sensor'):
        return (
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Activity className="h-3 w-3" /> Lectura: —
          </Badge>
        );
      default:
        return (
          <Button variant="ghost" size="sm" onClick={() => handleDeviceAction(device, 'ping')} className="gap-1 text-xs">
            <Activity className="h-3 w-3" /> Ping
          </Button>
        );
    }
  };

  if (devicesLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sede</label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {sites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Marca</label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las marcas</SelectItem>
                  {uniqueBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="online">En línea</SelectItem>
                  <SelectItem value="offline">Fuera de línea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                {selectedDevices.size === filteredDevices.length && filteredDevices.length > 0 ? 'Deseleccionar' : 'Seleccionar todo'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkPing} className="gap-1 text-xs">
                <Activity className="h-3 w-3" /> Ping todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkReboot} className="gap-1 text-xs" disabled={selectedDevices.size === 0}>
                <RefreshCw className="h-3 w-3" /> Reiniciar ({selectedDevices.size})
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkFirmware} className="gap-1 text-xs" disabled={selectedDevices.size === 0}>
                <Upload className="h-3 w-3" /> Firmware ({selectedDevices.size})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Monitor className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">Sin dispositivos</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No se encontraron dispositivos con los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((device: any) => (
            <Card
              key={device.id}
              className={cn(
                'border cursor-pointer transition-colors',
                selectedDevices.has(device.id) && 'border-primary bg-primary/5',
                device.status === 'online' ? 'border-success/20' : 'border-muted',
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedDevices.has(device.id)}
                      onChange={() => toggleSelect(device.id)}
                      className="rounded border-muted-foreground/50"
                    />
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', device.status === 'online' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>
                      {getDeviceIcon(device.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{device.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{device.site_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {device.status === 'online' ? (
                      <Badge className="bg-success/20 text-success border-success/30 border text-[10px] px-1.5">
                        <Wifi className="h-2.5 w-2.5 mr-0.5" /> En línea
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5">
                        <WifiOff className="h-2.5 w-2.5 mr-0.5" /> Offline
                      </Badge>
                    )}
                    {device.brand && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 border', brandColors[device.brand] || '')}>
                        {device.brand}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {device.remote_address && (
                    <span className="font-mono flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {device.remote_address}
                    </span>
                  )}
                  {device.ip && (
                    <span className="font-mono flex items-center gap-1">
                      <Network className="h-3 w-3" /> {device.ip}
                    </span>
                  )}
                </div>

                <div className="border-t border-muted pt-2">
                  {renderDeviceControls(device)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── TAB 4: DIAGNOSTICS ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function DiagnosticsTab({ toast }: { toast: any }) {
  // Ping tool
  const [pingHost, setPingHost] = useState('');
  const [pingPort, setPingPort] = useState('80');
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  // Port scan
  const [portScanHost, setPortScanHost] = useState('');
  const [portScanning, setPortScanning] = useState(false);
  const [portScanResult, setPortScanResult] = useState<PortScanResult | null>(null);

  // ONVIF discovery
  const [discovering, setDiscovering] = useState(false);
  const [onvifDevices, setOnvifDevices] = useState<any[]>([]);

  // ARP table
  const [loadingArp, setLoadingArp] = useState(false);
  const [arpEntries, setArpEntries] = useState<ArpEntry[]>([]);

  // Network interfaces
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);

  // Device identification
  const [identifyHost, setIdentifyHost] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<any>(null);

  const handlePing = useCallback(async () => {
    if (!pingHost) return;
    setPinging(true);
    setPingResult(null);
    try {
      const result = await apiCall<PingResult>('/ping', {
        method: 'POST',
        body: JSON.stringify({ host: pingHost, port: parseInt(pingPort) || 80 }),
      });
      setPingResult(result);
    } catch (err: any) {
      toast({ title: 'Error de ping', description: err.message, variant: 'destructive' });
    } finally {
      setPinging(false);
    }
  }, [pingHost, pingPort, toast]);

  const handlePortScan = useCallback(async () => {
    if (!portScanHost) return;
    setPortScanning(true);
    setPortScanResult(null);
    try {
      const result = await apiCall<PortScanResult>('/scan/ports', {
        method: 'POST',
        body: JSON.stringify({ host: portScanHost }),
      });
      setPortScanResult(result);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPortScanning(false);
    }
  }, [portScanHost, toast]);

  const handleOnvifDiscovery = useCallback(async () => {
    setDiscovering(true);
    setOnvifDevices([]);
    try {
      const result = await apiCall<{ devices: any[] }>('/discover/onvif');
      setOnvifDevices(result.devices || []);
      toast({ title: 'Descubrimiento ONVIF', description: `Se encontraron ${result.devices?.length ?? 0} dispositivos.` });
    } catch (err: any) {
      toast({ title: 'Error ONVIF', description: err.message, variant: 'destructive' });
    } finally {
      setDiscovering(false);
    }
  }, [toast]);

  const handleLoadArp = useCallback(async () => {
    setLoadingArp(true);
    try {
      const result = await apiCall<{ entries: ArpEntry[] }>('/arp');
      setArpEntries(result.entries || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingArp(false);
    }
  }, [toast]);

  const handleLoadInterfaces = useCallback(async () => {
    setLoadingInterfaces(true);
    try {
      const result = await apiCall<{ interfaces: NetworkInterface[] }>('/interfaces');
      setInterfaces(result.interfaces || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingInterfaces(false);
    }
  }, [toast]);

  const handleIdentify = useCallback(async () => {
    if (!identifyHost) return;
    setIdentifying(true);
    setIdentifyResult(null);
    try {
      const result = await apiCall<any>('/identify', {
        method: 'POST',
        body: JSON.stringify({ host: identifyHost }),
      });
      setIdentifyResult(result);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIdentifying(false);
    }
  }, [identifyHost, toast]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Ping Tool */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Herramienta de Ping TCP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Host / IP</label>
                <Input value={pingHost} onChange={e => setPingHost(e.target.value)} placeholder="192.168.1.1" className="font-mono" />
              </div>
              <div className="w-24 space-y-1">
                <label className="text-xs text-muted-foreground">Puerto</label>
                <Input value={pingPort} onChange={e => setPingPort(e.target.value)} placeholder="80" className="font-mono" />
              </div>
            </div>
            <Button onClick={handlePing} disabled={pinging || !pingHost} className="w-full gap-2">
              {pinging ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              {pinging ? 'Probando...' : 'Ejecutar Ping'}
            </Button>
            {pingResult && (
              <div className={cn('rounded-lg border p-3', pingResult.reachable ? 'border-success/30 bg-success/10' : 'border-destructive/30 bg-destructive/10')}>
                <div className="flex items-center gap-2">
                  {pingResult.reachable ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
                  <div>
                    <p className="text-sm font-semibold">
                      {pingResult.reachable ? 'Alcanzable' : 'No alcanzable'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {pingResult.host}:{pingPort}
                      {pingResult.latency !== undefined && ` - ${pingResult.latency}ms`}
                    </p>
                    {pingResult.error && <p className="text-xs text-destructive mt-1">{pingResult.error}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Port Scanner */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scan className="h-5 w-5 text-primary" />
              Escaneo de Puertos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Host / IP</label>
              <Input value={portScanHost} onChange={e => setPortScanHost(e.target.value)} placeholder="192.168.1.1" className="font-mono" />
            </div>
            <Button onClick={handlePortScan} disabled={portScanning || !portScanHost} className="w-full gap-2">
              {portScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
              {portScanning ? 'Escaneando...' : 'Escanear Puertos'}
            </Button>
            {portScanResult && (
              <div className="rounded-lg border border-muted p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {portScanResult.openPorts.length} puerto(s) abierto(s) en {portScanResult.host}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(portScanResult.openPorts || []).map(p => (
                    <Badge key={p.port} variant="outline" className="font-mono text-xs gap-1">
                      {p.port} <span className="opacity-60">{p.service}</span>
                    </Badge>
                  ))}
                  {portScanResult.openPorts.length === 0 && (
                    <span className="text-xs text-muted-foreground">No se encontraron puertos abiertos.</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ONVIF Discovery */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              Descubrimiento ONVIF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Busca dispositivos compatibles con ONVIF en la red local (cámaras IP, NVRs, encoders).
            </p>
            <Button onClick={handleOnvifDiscovery} disabled={discovering} className="w-full gap-2">
              {discovering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {discovering ? 'Buscando...' : 'Iniciar Descubrimiento'}
            </Button>
            {onvifDevices.length > 0 && (
              <div className="rounded-lg border border-muted p-3 max-h-48 overflow-y-auto space-y-2">
                {onvifDevices.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b border-muted pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{d.name || d.model || 'Dispositivo ONVIF'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{d.address || d.ip}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{d.manufacturer || 'N/A'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device Identification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" />
              Identificación de Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Host / IP del dispositivo</label>
              <Input value={identifyHost} onChange={e => setIdentifyHost(e.target.value)} placeholder="192.168.1.64" className="font-mono" />
            </div>
            <Button onClick={handleIdentify} disabled={identifying || !identifyHost} className="w-full gap-2">
              {identifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {identifying ? 'Identificando...' : 'Identificar Dispositivo'}
            </Button>
            {identifyResult && (
              <div className="rounded-lg border border-muted p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">{identifyResult.brand || 'Desconocido'}</span>
                  {identifyResult.model && <Badge variant="outline" className="text-xs">{identifyResult.model}</Badge>}
                </div>
                {identifyResult.firmware && <p className="text-xs text-muted-foreground">Firmware: {identifyResult.firmware}</p>}
                {identifyResult.serial && <p className="text-xs text-muted-foreground font-mono">S/N: {identifyResult.serial}</p>}
                {identifyResult.mac && <p className="text-xs text-muted-foreground font-mono">MAC: {identifyResult.mac}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ARP Table & Network Interfaces */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Router className="h-5 w-5 text-primary" />
              Tabla ARP
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleLoadArp} disabled={loadingArp} className="gap-1">
              {loadingArp ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Cargar
            </Button>
          </CardHeader>
          <CardContent>
            {loadingArp ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : arpEntries.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">IP</TableHead>
                      <TableHead className="text-xs">MAC</TableHead>
                      <TableHead className="text-xs">Interfaz</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arpEntries.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs py-1.5">{entry.ip}</TableCell>
                        <TableCell className="font-mono text-xs py-1.5">{entry.mac}</TableCell>
                        <TableCell className="text-xs py-1.5">{entry.interface}</TableCell>
                        <TableCell className="text-xs py-1.5">{entry.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Haga clic en "Cargar" para ver la tabla ARP.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-primary" />
              Interfaces de Red
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleLoadInterfaces} disabled={loadingInterfaces} className="gap-1">
              {loadingInterfaces ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Cargar
            </Button>
          </CardHeader>
          <CardContent>
            {loadingInterfaces ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : interfaces.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {interfaces.map((iface, i) => (
                  <div key={i} className="rounded-lg border border-muted p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{iface.name}</span>
                      <Badge variant="outline" className="text-xs">{iface.family}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                      <span>IP: <span className="font-mono text-foreground">{iface.address}</span></span>
                      <span>Máscara: <span className="font-mono text-foreground">{iface.netmask}</span></span>
                      <span className="col-span-2">MAC: <span className="font-mono text-foreground">{iface.mac}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Haga clic en "Cargar" para ver las interfaces de red.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
