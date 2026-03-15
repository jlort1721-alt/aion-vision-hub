import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/contexts/I18nContext';
import { useSections, useDomoticDevices, useDomoticMutations, useDomoticActions } from '@/hooks/use-module-data';
import { useEWeLinkAuth, useEWeLinkControl, useEWeLinkSync, useEWeLinkHealth, useEWeLinkLogs } from '@/hooks/use-ewelink';
import { toast } from 'sonner';
import {
  Lightbulb, DoorOpen, Siren, ToggleLeft, Zap, Search, Plus,
  RefreshCw, Activity, Power, PowerOff, Clock, AlertTriangle,
  Settings, Shield, Wifi, WifiOff, MoreHorizontal, CircuitBoard,
  LogIn, LogOut, CloudOff, Cloud, Download, FileText, Loader2,
  CheckCircle2, XCircle
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, React.ReactNode> = {
  door: <DoorOpen className="h-4 w-4" />, lock: <Shield className="h-4 w-4" />,
  siren: <Siren className="h-4 w-4" />, light: <Lightbulb className="h-4 w-4" />,
  relay: <CircuitBoard className="h-4 w-4" />, sensor: <Activity className="h-4 w-4" />,
  switch: <ToggleLeft className="h-4 w-4" />,
};
const typeLabels: Record<string, string> = {
  door: 'Puerta', lock: 'Chapa', siren: 'Sirena', light: 'Luz',
  relay: 'Relé', sensor: 'Sensor', switch: 'Interruptor',
};

export default function DomoticsPage() {
  const { t } = useI18n();
  const { data: sections = [], isLoading: sectionsLoading } = useSections();
  const { data: devices = [], isLoading: devicesLoading, refetch } = useDomoticDevices();
  const { create, toggleState, remove } = useDomoticMutations();

  // eWeLink integration hooks
  const ewelinkAuth = useEWeLinkAuth();
  const ewelinkControl = useEWeLinkControl();
  const ewelinkSync = useEWeLinkSync();
  const { data: ewelinkHealth } = useEWeLinkHealth();
  const { data: ewelinkLogs = [] } = useEWeLinkLogs(30);

  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'relay', section_id: '', brand: 'Sonoff', model: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '', countryCode: '+1' });
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  const isLoading = sectionsLoading || devicesLoading;

  const filtered = devices.filter((d: any) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (sectionFilter !== 'all' && d.section_id !== sectionFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    return true;
  });

  const selected = selectedDevice ? devices.find((d: any) => d.id === selectedDevice) : null;
  const onlineCount = devices.filter((d: any) => d.status === 'online').length;
  const errorCount = devices.filter((d: any) => d.status === 'error' || d.status === 'offline').length;

  const { data: actions = [], isLoading: actionsLoading } = useDomoticActions(selectedDevice ?? undefined);

  // Real eWeLink test connection
  const handleTestConnection = async (device: any) => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      const { ewelink } = await import('@/services/integrations/ewelink');
      const state = await ewelink.getDeviceState(device.config.ewelink_id);
      if (state.success) {
        toast.success(`Conexión exitosa con "${device.name}" — dispositivo ${device.status}`);
      } else {
        toast.error(`Fallo de conexión: ${state.error}`);
      }
    } else if (!ewelinkAuth.isAuthenticated) {
      toast.warning('Inicia sesión en eWeLink para probar la conexión real');
    } else {
      toast.info(`Test de conexión para "${device.name}" — sin eWeLink ID asociado`);
    }
  };

  // Real eWeLink toggle via API
  const handleToggle = (device: any) => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({
        deviceId: device.config.ewelink_id,
        action: 'toggle',
      });
    }
    // Also update local DB state
    toggleState.mutate({ id: device.id, currentState: device.state });
  };

  // Real eWeLink direct on/off
  const handleDirectAction = (device: any, action: 'on' | 'off') => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({
        deviceId: device.config.ewelink_id,
        action,
      });
    }
    toggleState.mutate({ id: device.id, currentState: action === 'on' ? 'off' : 'on' });
  };

  // eWeLink login
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) return;
    const result = await ewelinkAuth.login(loginForm.email, loginForm.password, loginForm.countryCode);
    if (result.success) {
      setLoginOpen(false);
      setLoginForm({ email: '', password: '', countryCode: '+1' });
    }
  };

  // Sync from eWeLink cloud
  const handleSync = () => {
    ewelinkSync.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    create.mutate({ name: form.name, type: form.type, section_id: form.section_id || undefined, brand: form.brand, model: form.model });
    setAddOpen(false);
    setEditingDeviceId(null);
    setForm({ name: '', type: 'relay', section_id: '', brand: 'Sonoff', model: '' });
  };

  const handleEdit = (device: any) => {
    setEditingDeviceId(device.id);
    setForm({
      name: device.name || '',
      type: device.type || 'relay',
      section_id: device.section_id || '',
      brand: device.brand || 'Sonoff',
      model: device.model || '',
    });
    setAddOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setAddOpen(open);
    if (!open) {
      setEditingDeviceId(null);
      setForm({ name: '', type: 'relay', section_id: '', brand: 'Sonoff', model: '' });
    }
  };

  const getSectionName = (id: string) => sections.find((s: any) => s.id === id)?.name || '—';

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={cn("flex-1 flex flex-col border-r", selected && "max-w-[60%]")}>
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> {t('domotics.title')}
              </h1>
              <p className="text-xs text-muted-foreground">{t('domotics.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              {/* eWeLink connection status */}
              {ewelinkAuth.isConfigured && (
                <Badge
                  variant={ewelinkAuth.isAuthenticated ? 'default' : 'secondary'}
                  className="text-[10px] cursor-pointer"
                  onClick={() => ewelinkAuth.isAuthenticated ? null : setLoginOpen(true)}
                >
                  {ewelinkAuth.isAuthenticated ? (
                    <><Cloud className="mr-1 h-3 w-3" /> eWeLink</>
                  ) : (
                    <><CloudOff className="mr-1 h-3 w-3" /> eWeLink</>
                  )}
                </Badge>
              )}
              {ewelinkAuth.isAuthenticated && (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={ewelinkSync.isPending}>
                  {ewelinkSync.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                  Sync
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)}>
                <FileText className="mr-1 h-3 w-3" /> Logs
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> {t('common.refresh')}</Button>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('domotics.add_device')}</Button>
            </div>
          </div>

          {/* eWeLink health banner */}
          {ewelinkHealth && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded text-xs",
              ewelinkHealth.status === 'connected' && "bg-green-500/10 text-green-600 dark:text-green-400",
              ewelinkHealth.status === 'error' && "bg-destructive/10 text-destructive",
              ewelinkHealth.status === 'not_configured' && "bg-muted text-muted-foreground",
            )}>
              {ewelinkHealth.status === 'connected' ? <CheckCircle2 className="h-3 w-3" /> : ewelinkHealth.status === 'error' ? <XCircle className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
              <span>{ewelinkHealth.message}</span>
              {ewelinkHealth.latencyMs > 0 && <span className="ml-auto font-mono">{ewelinkHealth.latencyMs}ms</span>}
              {!ewelinkAuth.isAuthenticated && ewelinkAuth.isConfigured && (
                <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-2" onClick={() => setLoginOpen(true)}>
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

          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('common.all')}</p><p className="text-lg font-bold">{devices.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Wifi className="h-4 w-4 text-green-500" /><div><p className="text-xs text-muted-foreground">{t('common.online')}</p><p className="text-lg font-bold">{onlineCount}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /><div><p className="text-xs text-muted-foreground">{t('domotics.errors')}</p><p className="text-lg font-bold">{errorCount}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Power className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('domotics.active')}</p><p className="text-lg font-bold">{devices.filter((d: any) => d.state === 'on').length}</p></div></div></Card>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('domotics.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder={t('domotics.all_sections')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('domotics.all_sections')}</SelectItem>
                {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder={t('domotics.all_types')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('domotics.all_types')}</SelectItem>
                {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Zap className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">{devices.length === 0 ? t('domotics.no_devices') : t('domotics.no_match')}</p>
              {devices.length === 0 && (
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('domotics.add_device')}</Button>
                  {ewelinkAuth.isAuthenticated && (
                    <Button variant="outline" size="sm" onClick={handleSync}><Download className="mr-1 h-3 w-3" /> Sincronizar eWeLink</Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>{t('domotics.section')}</TableHead>
                  <TableHead>{t('domotics.brand_model')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('domotics.state')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((device: any) => (
                  <TableRow key={device.id} className={cn("cursor-pointer", selectedDevice === device.id && "bg-muted/50")} onClick={() => setSelectedDevice(device.id)}>
                    <TableCell>{typeIcons[device.type] || <Zap className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-medium text-sm">{device.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{typeLabels[device.type] || device.type}</Badge></TableCell>
                    <TableCell className="text-xs">{getSectionName(device.section_id)}</TableCell>
                    <TableCell className="text-xs">{device.brand} {device.model}</TableCell>
                    <TableCell>
                      <Badge variant={device.status === 'online' ? 'default' : device.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{device.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {device.state === 'on' ? <Power className="h-3 w-3 text-green-500" /> : <PowerOff className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-[10px] capitalize">{device.state}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggle(device)}><Power className="mr-2 h-3 w-3" /> {t('domotics.toggle')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTestConnection(device)}><RefreshCw className="mr-2 h-3 w-3" /> {t('domotics.test_connection')}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) remove.mutate(device.id); }}><Settings className="mr-2 h-3 w-3" /> {t('common.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          {filtered.length} {t('domotics.devices_count')} • {onlineCount} {t('common.online').toLowerCase()}
          {ewelinkAuth.isAuthenticated && <span className="ml-2">• eWeLink: {ewelinkAuth.region.toUpperCase()}</span>}
        </div>
      </div>

      {selected && (
        <div className="w-[40%] overflow-auto p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {typeIcons[selected.type] || <Zap className="h-4 w-4" />}
              <div>
                <h2 className="font-bold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{getSectionName(selected.section_id)}</p>
              </div>
            </div>
            <Badge variant={selected.status === 'online' ? 'default' : 'destructive'} className="capitalize">{selected.status}</Badge>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('domotics.quick_actions')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('domotics.power_state')}</span>
                <Switch
                  checked={selected.state === 'on'}
                  onCheckedChange={() => handleToggle(selected)}
                  disabled={ewelinkControl.isPending}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleDirectAction(selected, 'on')} disabled={ewelinkControl.isPending}>
                  <Power className="mr-1 h-3 w-3" /> {t('domotics.activate')}
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleDirectAction(selected, 'off')} disabled={ewelinkControl.isPending}>
                  <PowerOff className="mr-1 h-3 w-3" /> {t('domotics.deactivate')}
                </Button>
              </div>
              {ewelinkControl.isPending && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Enviando comando a eWeLink...
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('domotics.device_info')}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('common.type')}</span><span className="capitalize">{typeLabels[selected.type] || selected.type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('domotics.brand_model')}</span><span>{selected.brand} {selected.model}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('domotics.last_action')}</span><span className="text-xs">{selected.last_action || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('domotics.last_sync')}</span><span className="text-xs font-mono">{selected.last_sync ? new Date(selected.last_sync).toLocaleString() : '—'}</span></div>
              {selected.config?.ewelink_id && (
                <div className="flex justify-between"><span className="text-muted-foreground">eWeLink ID</span><span className="text-xs font-mono">{selected.config.ewelink_id}</span></div>
              )}
              {selected.config?.firmware && (
                <div className="flex justify-between"><span className="text-muted-foreground">Firmware</span><span className="text-xs font-mono">{selected.config.firmware}</span></div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> {t('domotics.action_history')}</CardTitle></CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
              ) : actions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No actions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {actions.map((action: any) => (
                    <div key={action.id} className="flex items-start justify-between gap-2 text-sm border-b last:border-0 pb-1 last:pb-0">
                      <span className="text-muted-foreground">{action.description || action.action || '—'}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{action.created_at ? new Date(action.created_at).toLocaleString() : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleTestConnection(selected)}><RefreshCw className="mr-1 h-3 w-3" /> {t('domotics.test_connection')}</Button>
            <Button variant="outline" className="flex-1" onClick={() => handleEdit(selected)}><Settings className="mr-1 h-3 w-3" /> {t('common.edit')}</Button>
          </div>
        </div>
      )}

      {/* Add/Edit Device Dialog */}
      <Dialog open={addOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDeviceId ? t('common.edit') : t('domotics.add_device')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t('common.name')} *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Puerta Principal" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t('common.type')}</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t('domotics.section')}</Label>
                <Select value={form.section_id} onValueChange={v => setForm(p => ({ ...p, section_id: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Brand</Label><Input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Model</Label><Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.name.trim() || create.isPending}>{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* eWeLink Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar cuenta eWeLink</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ingresa tus credenciales de la app eWeLink para sincronizar dispositivos Sonoff.
            </p>
            <div className="space-y-1">
              <Label>Email de eWeLink *</Label>
              <Input type="email" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} placeholder="tu@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="..." />
            </div>
            <div className="space-y-1">
              <Label>Prefijo de país</Label>
              <Select value={loginForm.countryCode} onValueChange={v => setLoginForm(p => ({ ...p, countryCode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="+1">+1 (US/CA)</SelectItem>
                  <SelectItem value="+52">+52 (MX)</SelectItem>
                  <SelectItem value="+34">+34 (ES)</SelectItem>
                  <SelectItem value="+44">+44 (UK)</SelectItem>
                  <SelectItem value="+55">+55 (BR)</SelectItem>
                  <SelectItem value="+57">+57 (CO)</SelectItem>
                  <SelectItem value="+54">+54 (AR)</SelectItem>
                  <SelectItem value="+56">+56 (CL)</SelectItem>
                  <SelectItem value="+86">+86 (CN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-[10px] text-muted-foreground p-2 bg-muted rounded">
              Las credenciales se almacenan cifradas por tenant. Los tokens de eWeLink expiran cada ~30 días.
              Región configurada: <strong>{ewelinkAuth.region.toUpperCase()}</strong>
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={!loginForm.email || !loginForm.password || ewelinkAuth.isLoggingIn}>
              {ewelinkAuth.isLoggingIn ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Conectando...</> : <><LogIn className="mr-1 h-3 w-3" /> Conectar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Logs de eWeLink</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-80">
            {ewelinkLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin entradas de log.</p>
            ) : (
              <div className="space-y-1">
                {ewelinkLogs.map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] border-b last:border-0 pb-1 last:pb-0 py-1">
                    <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'outline'} className="text-[9px] shrink-0">
                      {log.level}
                    </Badge>
                    <span className="text-muted-foreground font-mono shrink-0">{log.action}</span>
                    <span className="flex-1">{log.message}</span>
                    <span className="text-muted-foreground font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
