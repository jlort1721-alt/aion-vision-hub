import React, { useState, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { PageShell } from '@/components/shared/PageShell';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Zap, MoreHorizontal, Power, RefreshCw, Settings, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useSections, useDomoticDevices, useDomoticMutations, useDomoticActions } from '@/hooks/use-module-data';
import { useEWeLinkAuth, useEWeLinkControl, useEWeLinkSync, useEWeLinkHealth, useEWeLinkLogs } from '@/hooks/use-ewelink';

import { TYPE_ICONS, TYPE_LABELS } from './domotics/types';
import { DomoticsHeader } from './domotics/components/DomoticsHeader';
import { DeviceSidebar } from './domotics/components/DeviceSidebar';

export default function DomoticsPage() {
  const { t } = useI18n();
  const { data: sections = [], isLoading: sectionsLoading } = useSections();
  const { data: devices = [], isLoading: devicesLoading, refetch } = useDomoticDevices();
  const { create, toggleState, remove } = useDomoticMutations();

  // eWeLink Hooks
  const ewelinkAuth = useEWeLinkAuth();
  const ewelinkControl = useEWeLinkControl();
  const ewelinkSync = useEWeLinkSync();
  const { data: ewelinkHealth } = useEWeLinkHealth();
  const { data: ewelinkLogs = [] } = useEWeLinkLogs(30);

  // State
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  const selectedDevice = useMemo(() => 
    selectedDeviceId ? devices.find((d: any) => d.id === selectedDeviceId) : null,
  [selectedDeviceId, devices]);

  const { data: actions = [], isLoading: actionsLoading } = useDomoticActions(selectedDeviceId ?? undefined);

  // Statistics
  const onlineCount = devices.filter((d: any) => d.status === 'online').length;
  const errorCount = devices.filter((d: any) => d.status === 'error' || d.status === 'offline').length;
  const activeCount = devices.filter((d: any) => d.state === 'on').length;

  // Actions
  const handleTestConnection = async (device: any) => {
    if (!device.config?.ewelink_id) {
      toast.info(`Test de conexión para "${device.name}" — sin eWeLink ID asociado`);
      return;
    }
    if (!ewelinkAuth.isAuthenticated) {
      toast.warning('Inicia sesión en eWeLink para probar la conexión real');
      return;
    }
    const { ewelink } = await import('@/services/integrations/ewelink');
    const state = await ewelink.getDeviceState(device.config.ewelink_id);
    if (state.success) {
      toast.success(`Conexión exitosa con "${device.name}" — dispositivo ${device.status}`);
    } else {
      toast.error(`Fallo de conexión: ${state.error}`);
    }
  };

  const handleToggle = (device: any) => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({ deviceId: device.config.ewelink_id, action: 'toggle' });
    }
    toggleState.mutate({ id: device.id, currentState: device.state });
  };

  const handleDirectAction = (device: any, action: 'on' | 'off') => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({ deviceId: device.config.ewelink_id, action });
    }
    toggleState.mutate({ id: device.id, currentState: action === 'on' ? 'off' : 'on' });
  };

  // DataTable Columns
  const getSectionName = (id: string) => sections.find((s: any) => s.id === id)?.name || '—';

  const columns = useMemo(() => [
    {
      key: 'type_icon',
      header: '',
      width: 'w-10 text-center',
      cell: (row: any) => {
        const Icon = require('lucide-react')[TYPE_ICONS[row.type as keyof typeof TYPE_ICONS]] || Zap;
        return <Icon className="h-4 w-4 text-muted-foreground mx-auto" />;
      }
    },
    { key: 'name', header: t('common.name'), sortable: true, cell: (row: any) => <span className="font-medium text-sm">{row.name}</span> },
    { key: 'type', header: t('common.type'), sortable: true, cell: (row: any) => <Badge variant="outline" className="text-[10px] uppercase font-normal">{TYPE_LABELS[row.type] || row.type}</Badge> },
    { key: 'section', header: t('domotics.section'), cell: (row: any) => <span className="text-xs text-muted-foreground">{getSectionName(row.section_id)}</span> },
    { key: 'brand', header: t('domotics.brand_model'), cell: (row: any) => <span className="text-xs">{row.brand} {row.model}</span> },
    { key: 'status', header: t('common.status'), sortable: true, cell: (row: any) => <StatusBadge status={row.status} variant="device" pulse={row.status === 'online'} /> },
    { 
      key: 'state', 
      header: t('domotics.state'), 
      sortable: 'state',
      cell: (row: any) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.state} variant="generic" />
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      width: 'w-12 text-right',
      cell: (row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggle(row); }}>
              <Power className="mr-2 h-3 w-3" /> {t('domotics.toggle')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTestConnection(row); }}>
              <RefreshCw className="mr-2 h-3 w-3" /> {t('domotics.test_connection')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(row.id); }}>
              <Settings className="mr-2 h-3 w-3" /> {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ], [t, sections, ewelinkAuth.isAuthenticated, remove]);

  const searchFilterLine = (row: any, searchStr: string) => {
    if (sectionFilter !== 'all' && row.section_id !== sectionFilter) return false;
    if (typeFilter !== 'all' && row.type !== typeFilter) return false;
    if (!searchStr) return true;
    return row.name.toLowerCase().includes(searchStr.toLowerCase()) || 
           (row.brand && row.brand.toLowerCase().includes(searchStr.toLowerCase()));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <PageShell
        title={t('domotics.title')}
        description={t('domotics.subtitle')}
        icon={<Zap size={20} />}
        actions={
          <div className="flex items-center gap-3">
             <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-40 h-8 text-xs bg-background"><SelectValue placeholder={t('domotics.all_sections')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('domotics.all_sections')}</SelectItem>
                {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs bg-background"><SelectValue placeholder={t('domotics.all_types')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('domotics.all_types')}</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="p-4 flex gap-4 h-full overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <DomoticsHeader 
              devicesCount={devices.length}
              onlineCount={onlineCount}
              errorCount={errorCount}
              activeCount={activeCount}
              ewelinkAuth={ewelinkAuth}
              ewelinkHealth={ewelinkHealth}
              isSyncing={ewelinkSync.isPending}
              onSync={() => ewelinkSync.mutate(undefined, { onSuccess: () => refetch() })}
              onRefresh={() => refetch()}
              onAddDevice={() => { setEditingDeviceId(null); setAddOpen(true); }}
              onOpenLogin={() => setLoginOpen(true)}
              onOpenLogs={() => setLogsOpen(true)}
            />
            
            <div className="mt-4 flex-1 bg-background rounded-lg border shadow-sm flex flex-col overflow-hidden">
              <DataTable
                columns={columns}
                data={devices}
                getRowId={(row) => row.id}
                isLoading={sectionsLoading || devicesLoading}
                searchPlaceholder={t('domotics.search')}
                searchFilter={searchFilterLine}
                onRowClick={(row) => setSelectedDeviceId(row.id === selectedDeviceId ? null : row.id)}
                className="flex-1 p-0 border-0"
              />
            </div>
          </div>
          
          {selectedDevice && (
            <DeviceSidebar 
              device={selectedDevice}
              sectionName={getSectionName(selectedDevice.section_id)}
              actions={actions}
              actionsLoading={actionsLoading}
              ewelinkControlPending={ewelinkControl.isPending}
              onToggle={handleToggle}
              onDirectAction={handleDirectAction}
              onTestConnection={handleTestConnection}
              onEdit={() => { setEditingDeviceId(selectedDevice.id); setAddOpen(true); }}
            />
          )}
        </div>
      </PageShell>
    </div>
  );
}
