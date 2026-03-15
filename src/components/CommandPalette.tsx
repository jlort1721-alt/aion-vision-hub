import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { useDevices, useSites, useEventsLegacy } from '@/hooks/use-supabase-data';
import {
  MonitorSpeaker, MapPin, Bell, LayoutDashboard, Video, Play,
  AlertTriangle, Bot, Puzzle, FileBarChart, ScrollText, Activity, Settings,
} from 'lucide-react';

const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="mr-2 h-4 w-4" /> },
  { label: 'Live View', path: '/live-view', icon: <Video className="mr-2 h-4 w-4" /> },
  { label: 'Playback', path: '/playback', icon: <Play className="mr-2 h-4 w-4" /> },
  { label: 'Events', path: '/events', icon: <Bell className="mr-2 h-4 w-4" /> },
  { label: 'Incidents', path: '/incidents', icon: <AlertTriangle className="mr-2 h-4 w-4" /> },
  { label: 'Devices', path: '/devices', icon: <MonitorSpeaker className="mr-2 h-4 w-4" /> },
  { label: 'Sites', path: '/sites', icon: <MapPin className="mr-2 h-4 w-4" /> },
  { label: 'AI Assistant', path: '/ai-assistant', icon: <Bot className="mr-2 h-4 w-4" /> },
  { label: 'Integrations', path: '/integrations', icon: <Puzzle className="mr-2 h-4 w-4" /> },
  { label: 'Reports', path: '/reports', icon: <FileBarChart className="mr-2 h-4 w-4" /> },
  { label: 'Audit Log', path: '/audit', icon: <ScrollText className="mr-2 h-4 w-4" /> },
  { label: 'System Health', path: '/system', icon: <Activity className="mr-2 h-4 w-4" /> },
  { label: 'Settings', path: '/settings', icon: <Settings className="mr-2 h-4 w-4" /> },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: devices = [] } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: events = [] } = useEventsLegacy();

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
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search devices, events, sites, pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PAGES.map(p => (
            <CommandItem key={p.path} onSelect={() => go(p.path)}>
              {p.icon}{p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {devices.length > 0 && (
          <CommandGroup heading="Devices">
            {devices.slice(0, 8).map(d => (
              <CommandItem key={d.id} onSelect={() => go('/devices')}>
                <MonitorSpeaker className="mr-2 h-4 w-4" />
                <span>{d.name}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{d.ip_address}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {sites.length > 0 && (
          <CommandGroup heading="Sites">
            {sites.map(s => (
              <CommandItem key={s.id} onSelect={() => go('/sites')}>
                <MapPin className="mr-2 h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {events.length > 0 && (
          <CommandGroup heading="Recent Events">
            {events.slice(0, 5).map(e => (
              <CommandItem key={e.id} onSelect={() => go('/events')}>
                <Bell className="mr-2 h-4 w-4" />
                <span className="truncate">{e.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{e.severity}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
