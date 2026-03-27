import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useDevices, useSites, useEventsLegacy } from '@/hooks/use-supabase-data';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  MonitorSpeaker, MapPin, Bell, LayoutDashboard, Video, Play,
  AlertTriangle, Bot, Puzzle, FileBarChart, ScrollText, Activity, Settings,
  Users, Car, DoorOpen, Shield, Calendar, ClipboardList, Siren,
  Search, Hash, User, Wifi, WifiOff,
} from 'lucide-react';

const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="mr-2 h-4 w-4" />, keywords: 'home panel principal' },
  { label: 'Live View', path: '/live-view', icon: <Video className="mr-2 h-4 w-4" />, keywords: 'cameras video stream vista vivo' },
  { label: 'Playback', path: '/playback', icon: <Play className="mr-2 h-4 w-4" />, keywords: 'recording replay grabacion reproduccion' },
  { label: 'Events', path: '/events', icon: <Bell className="mr-2 h-4 w-4" />, keywords: 'alerts eventos alarmas motion' },
  { label: 'Incidents', path: '/incidents', icon: <AlertTriangle className="mr-2 h-4 w-4" />, keywords: 'incidents incidentes tickets' },
  { label: 'Alerts', path: '/alerts', icon: <Siren className="mr-2 h-4 w-4" />, keywords: 'alertas rules reglas' },
  { label: 'Devices', path: '/devices', icon: <MonitorSpeaker className="mr-2 h-4 w-4" />, keywords: 'cameras dispositivos camaras nvr dvr' },
  { label: 'Sites', path: '/sites', icon: <MapPin className="mr-2 h-4 w-4" />, keywords: 'locations sedes sitios' },
  { label: 'Access Control', path: '/access-control', icon: <DoorOpen className="mr-2 h-4 w-4" />, keywords: 'access acceso puertas gates' },
  { label: 'Visitors', path: '/visitors', icon: <Users className="mr-2 h-4 w-4" />, keywords: 'visitantes passes pases' },
  { label: 'Shifts', path: '/shifts', icon: <Calendar className="mr-2 h-4 w-4" />, keywords: 'turnos schedule horarios' },
  { label: 'Patrols', path: '/patrols', icon: <Shield className="mr-2 h-4 w-4" />, keywords: 'recorridos rondas checkpoints' },
  { label: 'Automation', path: '/automation', icon: <ClipboardList className="mr-2 h-4 w-4" />, keywords: 'rules automatizacion reglas' },
  { label: 'AI Assistant', path: '/ai-assistant', icon: <Bot className="mr-2 h-4 w-4" />, keywords: 'chat ai asistente inteligencia' },
  { label: 'Integrations', path: '/integrations', icon: <Puzzle className="mr-2 h-4 w-4" />, keywords: 'api webhooks whatsapp' },
  { label: 'Reports', path: '/reports', icon: <FileBarChart className="mr-2 h-4 w-4" />, keywords: 'reportes informes pdf csv' },
  { label: 'Audit Log', path: '/audit', icon: <ScrollText className="mr-2 h-4 w-4" />, keywords: 'audit auditoria logs registros' },
  { label: 'System Health', path: '/system', icon: <Activity className="mr-2 h-4 w-4" />, keywords: 'health salud sistema monitoring' },
  { label: 'Settings', path: '/settings', icon: <Settings className="mr-2 h-4 w-4" />, keywords: 'config configuracion preferences' },
  { label: 'Admin', path: '/admin', icon: <Users className="mr-2 h-4 w-4" />, keywords: 'users roles tenants administracion' },
  { label: 'Domotics', path: '/domotics', icon: <Puzzle className="mr-2 h-4 w-4" />, keywords: 'smart home relay sonoff ewelink' },
  { label: 'Intercom', path: '/intercom', icon: <MonitorSpeaker className="mr-2 h-4 w-4" />, keywords: 'sip citofonia telefono intercom' },
  { label: 'WhatsApp', path: '/whatsapp', icon: <Bell className="mr-2 h-4 w-4" />, keywords: 'whatsapp messages mensajes' },
  { label: 'Network', path: '/network', icon: <Wifi className="mr-2 h-4 w-4" />, keywords: 'network red scan diagnostics' },
  { label: 'Documents', path: '/documents', icon: <FileBarChart className="mr-2 h-4 w-4" />, keywords: 'docs archivos files sops' },
  { label: 'Minuta', path: '/minuta', icon: <ClipboardList className="mr-2 h-4 w-4" />, keywords: 'minuta turno shift report' },
];

interface PaginatedResponse<T> {
  data: T[];
  meta?: { total?: number };
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: devices = [] } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: events = [] } = useEventsLegacy();

  // Fetch incidents for global search
  const { data: incidentsData } = useQuery({
    queryKey: ['incidents-search'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/incidents', { limit: '50' });
      return response.data ?? [];
    },
    enabled: isAuthenticated && open,
    staleTime: 30000,
  });
  const incidents = useMemo(() => incidentsData ?? [], [incidentsData]);

  // Fetch visitors for global search
  const { data: visitorsData } = useQuery({
    queryKey: ['visitors-search'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/visitors', { limit: '50' });
      return response.data ?? [];
    },
    enabled: isAuthenticated && open,
    staleTime: 30000,
  });
  const visitors = useMemo(() => visitorsData ?? [], [visitorsData]);

  // Fetch access people for global search
  const { data: accessPeopleData } = useQuery({
    queryKey: ['access-people-search'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/access/people', { limit: '50' });
      return response.data ?? [];
    },
    enabled: isAuthenticated && open,
    staleTime: 30000,
  });
  const accessPeople = useMemo(() => accessPeopleData ?? [], [accessPeopleData]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setSearch('');
  };

  // Filter pages by search including keywords
  const filteredPages = useMemo(() => {
    if (!search) return PAGES;
    const q = search.toLowerCase();
    return PAGES.filter(
      p => p.label.toLowerCase().includes(q) || p.keywords.toLowerCase().includes(q)
    );
  }, [search]);

  // Filter devices
  const filteredDevices = useMemo(() => {
    if (!search) return devices.slice(0, 8);
    const q = search.toLowerCase();
    return devices
      .filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.ip_address?.toLowerCase().includes(q) ||
        d.brand?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [devices, search]);

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    if (!search) return incidents.slice(0, 5);
    const q = search.toLowerCase();
    return incidents
      .filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [incidents, search]);

  // Filter visitors
  const filteredVisitors = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return visitors
      .filter(v =>
        v.name?.toLowerCase().includes(q) ||
        v.document_number?.toLowerCase().includes(q) ||
        v.company?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [visitors, search]);

  // Filter access people (residents, employees)
  const filteredPeople = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return accessPeople
      .filter(p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.document_number?.toLowerCase().includes(q) ||
        p.apartment?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [accessPeople, search]);

  const hasResults =
    filteredPages.length > 0 ||
    filteredDevices.length > 0 ||
    filteredIncidents.length > 0 ||
    filteredVisitors.length > 0 ||
    filteredPeople.length > 0 ||
    (events.length > 0 && !search);

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <CommandInput
        placeholder="Search pages, devices, events, incidents, visitors, people..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[420px]">
        {!hasResults && <CommandEmpty>No results found.</CommandEmpty>}

        {filteredPages.length > 0 && (
          <CommandGroup heading="Pages">
            {filteredPages.map(p => (
              <CommandItem key={p.path} onSelect={() => go(p.path)} value={`page-${p.label}-${p.keywords}`}>
                {p.icon}{p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredDevices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Devices (${devices.length})`}>
              {filteredDevices.map(d => (
                <CommandItem key={d.id} onSelect={() => go('/devices')} value={`device-${d.name}-${d.ip_address}`}>
                  {d.status === 'online'
                    ? <Wifi className="mr-2 h-4 w-4 text-success" />
                    : <WifiOff className="mr-2 h-4 w-4 text-destructive" />
                  }
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-2">{d.ip_address}</span>
                  {d.brand && (
                    <Badge variant="outline" className="ml-2 text-[10px]">{d.brand}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredIncidents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Incidents (${incidents.length})`}>
              {filteredIncidents.map(i => (
                <CommandItem key={i.id} onSelect={() => go('/incidents')} value={`incident-${i.title}`}>
                  <AlertTriangle className={`mr-2 h-4 w-4 ${
                    i.priority === 'critical' ? 'text-destructive' :
                    i.priority === 'high' ? 'text-orange-500' :
                    'text-warning'
                  }`} />
                  <span className="flex-1 truncate">{i.title}</span>
                  <Badge variant={i.status === 'open' ? 'destructive' : 'secondary'} className="text-[10px] ml-2">
                    {i.status}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {events.length > 0 && !search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Events">
              {events.slice(0, 5).map(e => (
                <CommandItem key={e.id} onSelect={() => go('/events')} value={`event-${e.title}`}>
                  <Bell className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{e.title}</span>
                  <Badge variant="outline" className={`text-[10px] ml-2 ${
                    e.severity === 'critical' ? 'border-destructive text-destructive' :
                    e.severity === 'high' ? 'border-orange-500 text-orange-500' :
                    ''
                  }`}>
                    {e.severity}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredVisitors.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Visitors">
              {filteredVisitors.map(v => (
                <CommandItem key={v.id} onSelect={() => go('/visitors')} value={`visitor-${v.name}-${v.document_number}`}>
                  <User className="mr-2 h-4 w-4 text-primary" />
                  <span className="flex-1 truncate">{v.name}</span>
                  {v.company && <span className="text-xs text-muted-foreground ml-2">{v.company}</span>}
                  {v.status && (
                    <Badge variant={v.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px] ml-2">
                      {v.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredPeople.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Residents / Access People">
              {filteredPeople.map(p => (
                <CommandItem key={p.id} onSelect={() => go('/access-control')} value={`person-${p.full_name}-${p.document_number}`}>
                  <Users className="mr-2 h-4 w-4 text-purple-500" />
                  <span className="flex-1 truncate">{p.full_name}</span>
                  {p.apartment && <span className="text-xs text-muted-foreground ml-2">Apt. {p.apartment}</span>}
                  {p.type && (
                    <Badge variant="outline" className="text-[10px] ml-2">{p.type}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sites.length > 0 && (search ? sites.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())).length > 0 : true) && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Sites (${sites.length})`}>
              {(search
                ? sites.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()))
                : sites
              ).slice(0, 8).map(s => (
                <CommandItem key={s.id} onSelect={() => go('/sites')} value={`site-${s.name}`}>
                  <MapPin className="mr-2 h-4 w-4" />
                  <span className="flex-1">{s.name}</span>
                  {s.status && (
                    <Badge variant={s.status === 'healthy' ? 'secondary' : 'destructive'} className="text-[10px] ml-2">
                      {s.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
