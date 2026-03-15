import React from 'react';
import { format } from 'date-fns';
import { Search, CalendarIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { EventFilters } from '@/hooks/use-supabase-data';

interface Props {
  filters: EventFilters;
  onChange: (f: Partial<EventFilters>) => void;
  onReset: () => void;
  devices: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  newCount: number;
}

export default function EventFiltersBar({ filters, onChange, onReset, devices, sites, newCount }: Props) {
  const activeCount = [
    filters.severity && filters.severity !== 'all',
    filters.status && filters.status !== 'all',
    filters.device_id && filters.device_id !== 'all',
    filters.site_id && filters.site_id !== 'all',
    filters.date_from,
    filters.date_to,
    filters.search,
  ].filter(Boolean).length;

  return (
    <div className="px-4 py-3 border-b space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Events & Alarms</h1>
          <Badge variant="destructive" className="text-xs">{newCount} new</Badge>
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-xs gap-1">
            <X className="h-3 w-3" /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={filters.search || ''}
            onChange={e => onChange({ search: e.target.value, page: 1 })}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Select value={filters.severity || 'all'} onValueChange={v => onChange({ severity: v, page: 1 })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status || 'all'} onValueChange={v => onChange({ status: v, page: 1 })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.site_id || 'all'} onValueChange={v => onChange({ site_id: v, page: 1 })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Site" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name?.split('—')[0]?.trim()}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.device_id || 'all'} onValueChange={v => onChange({ device_id: v, page: 1 })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Device" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", filters.date_from && "border-primary")}>
              <CalendarIcon className="h-3 w-3" />
              {filters.date_from ? format(new Date(filters.date_from), 'MMM d') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.date_from ? new Date(filters.date_from) : undefined}
              onSelect={d => onChange({ date_from: d ? d.toISOString() : undefined, page: 1 })}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", filters.date_to && "border-primary")}>
              <CalendarIcon className="h-3 w-3" />
              {filters.date_to ? format(new Date(filters.date_to), 'MMM d') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.date_to ? new Date(filters.date_to) : undefined}
              onSelect={d => onChange({ date_to: d ? new Date(d.getTime() + 86400000 - 1).toISOString() : undefined, page: 1 })}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
