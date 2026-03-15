import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDevices, useSites } from '@/hooks/use-supabase-data';
import { useI18n } from '@/contexts/I18nContext';
import DeviceFormDialog from '@/components/devices/DeviceFormDialog';
import DeleteDeviceDialog from '@/components/devices/DeleteDeviceDialog';
import {
  Plus, Search, Upload, Wifi, WifiOff, AlertCircle, MoreHorizontal,
  RefreshCw, Settings, Eye, Pencil, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function DevicesPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<any>(null);
  const [deleteDevice, setDeleteDevice] = useState<any>(null);

  const { data: devices = [], isLoading } = useDevices();
  const { data: sites = [] } = useSites();

  const filtered = devices.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.ip_address.includes(search)) return false;
    if (brandFilter !== 'all' && d.brand !== brandFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const selected = selectedDevice ? devices.find(d => d.id === selectedDevice) : null;
  const openEdit = (device: any) => { setEditDevice(device); setFormOpen(true); };
  const openAdd = () => { setEditDevice(null); setFormOpen(true); };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={cn("flex-1 flex flex-col border-r", selected && "max-w-[60%]")}>
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">{t('devices.title')}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Upload className="mr-1 h-3 w-3" /> {t('common.import')}</Button>
              <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-3 w-3" /> {t('devices.add_device')}</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('devices.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('devices.all_brands')}</SelectItem>
                <SelectItem value="hikvision">Hikvision</SelectItem>
                <SelectItem value="dahua">Dahua</SelectItem>
                <SelectItem value="generic_onvif">ONVIF</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('devices.all_status')}</SelectItem>
                <SelectItem value="online">{t('common.online')}</SelectItem>
                <SelectItem value="offline">{t('common.offline')}</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Settings className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">{t('devices.no_devices')}</p>
              <Button variant="link" size="sm" onClick={openAdd}>{t('devices.add_first')}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('devices.brand')} / {t('devices.model')}</TableHead>
                  <TableHead>{t('devices.ip_address')}</TableHead>
                  <TableHead>{t('events.site')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(device => {
                  const site = sites.find(s => s.id === device.site_id);
                  return (
                    <TableRow key={device.id} className={cn("cursor-pointer", selectedDevice === device.id && "bg-muted/50")} onClick={() => setSelectedDevice(device.id)}>
                      <TableCell>
                        {device.status === 'online' ? <Wifi className="h-3.5 w-3.5 text-success" /> :
                         device.status === 'offline' ? <WifiOff className="h-3.5 w-3.5 text-destructive" /> :
                         <AlertCircle className="h-3.5 w-3.5 text-warning" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{device.name}</TableCell>
                      <TableCell><div className="text-xs"><span className="capitalize">{device.brand}</span><span className="text-muted-foreground ml-1">{device.model}</span></div></TableCell>
                      <TableCell className="font-mono text-xs">{device.ip_address}</TableCell>
                      <TableCell className="text-xs">{site?.name?.split('—')[0]?.trim()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{device.type}</Badge></TableCell>
                      <TableCell><Badge variant={device.status === 'online' ? 'default' : device.status === 'offline' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{device.status}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedDevice(device.id)}><Eye className="mr-2 h-3 w-3" /> {t('devices.view_details')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(device)}><Pencil className="mr-2 h-3 w-3" /> {t('common.edit')}</DropdownMenuItem>
                            <DropdownMenuItem><RefreshCw className="mr-2 h-3 w-3" /> {t('devices.test_connection')}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDevice(device)}><Trash2 className="mr-2 h-3 w-3" /> {t('common.delete')}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          {filtered.length} {t('devices.title').toLowerCase()} • {filtered.filter(d => d.status === 'online').length} {t('common.online').toLowerCase()}
        </div>
      </div>

      {selected && (
        <div className="w-[40%] overflow-auto p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div><h2 className="font-bold">{selected.name}</h2><p className="text-sm text-muted-foreground capitalize">{selected.brand} {selected.model}</p></div>
            <div className="flex items-center gap-2">
              <Badge variant={selected.status === 'online' ? 'default' : 'destructive'} className="capitalize">{selected.status}</Badge>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(selected)}><Pencil className="h-3 w-3" /></Button>
            </div>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('devices.connection')}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">IP</span><span className="font-mono">{selected.ip_address}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Port</span><span>{selected.port}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">RTSP</span><span>{selected.rtsp_port}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ONVIF</span><span>{selected.onvif_port}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.firmware')}</span><span className="font-mono text-xs">{selected.firmware_version}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('devices.channels')}</span><span>{selected.channels}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('devices.capabilities')}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(selected.capabilities as Record<string, any>).map(([key, val]) => {
                  if (typeof val === 'boolean' && val) return <Badge key={key} variant="outline" className="text-[10px] capitalize">{key.replace(/_/g, ' ')}</Badge>;
                  return null;
                })}
              </div>
            </CardContent>
          </Card>
          {selected.tags && selected.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('devices.tags')}</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-1">{selected.tags.map((tag: string) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}</div></CardContent>
            </Card>
          )}
          {selected.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('devices.notes')}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{selected.notes}</CardContent>
            </Card>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1"><RefreshCw className="mr-1 h-3 w-3" /> {t('common.test')}</Button>
            <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}><Pencil className="mr-1 h-3 w-3" /> {t('common.edit')}</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setDeleteDevice(selected)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      )}

      <DeviceFormDialog open={formOpen} onOpenChange={setFormOpen} device={editDevice} />
      <DeleteDeviceDialog open={!!deleteDevice} onOpenChange={() => setDeleteDevice(null)} device={deleteDevice} onDeleted={() => setSelectedDevice(null)} />
    </div>
  );
}
