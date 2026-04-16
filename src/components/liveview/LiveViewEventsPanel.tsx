import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AlertTriangle, Bell, Eye, Clock } from 'lucide-react';
import { formatTime } from '@/lib/date-utils';
import { useNavigate } from 'react-router-dom';

interface LiveViewEventsPanelProps {
  onClose: () => void;
}

const severityColors: Record<string, string> = {
  critical: 'text-destructive',
  high: 'text-orange-500',
  medium: 'text-warning',
  low: 'text-primary',
  info: 'text-muted-foreground',
};

interface EventItem {
  id: string;
  title: string;
  event_type: string;
  severity: string;
  created_at: string;
}

interface EventsEnvelope {
  items?: EventItem[];
  data?: EventItem[];
  meta?: { total?: number };
}

export default function LiveViewEventsPanel({ onClose }: LiveViewEventsPanelProps) {
  const { data: events = [] } = useQuery({
    queryKey: ['events-liveview'],
    queryFn: async () => {
      const resp = await apiClient.get<EventsEnvelope | EventItem[]>('/events', { limit: '30' });
      if (Array.isArray(resp)) return resp;
      return resp?.items ?? resp?.data ?? [];
    },
    refetchInterval: 30_000,
  });
  const navigate = useNavigate();

  const recent = events.slice(0, 30);
  const criticalCount = recent.filter((e: EventItem) => e.severity === 'critical' || e.severity === 'high').length;

  return (
    <div className="w-64 border-l bg-card flex flex-col shrink-0">
      <div className="p-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Events</p>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[8px] h-4 px-1">{criticalCount}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onClose}>Hide</Button>
      </div>

      <ScrollArea className="flex-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Bell className="h-8 w-8 mb-1 opacity-20" />
            <p className="text-[10px]">No recent events</p>
          </div>
        ) : (
          <div className="p-1 space-y-0.5">
            {recent.map((event: EventItem) => (
              <button
                key={event.id}
                className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/events`)}
              >
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${severityColors[event.severity] || 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate">{event.title}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{event.event_type}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                      <span className="text-[8px] text-muted-foreground font-mono">
                        {formatTime(event.created_at)}
                      </span>
                      <Badge
                        variant={event.severity === 'critical' ? 'destructive' : 'outline'}
                        className="text-[7px] h-3 px-1 ml-auto"
                      >
                        {event.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-2 border-t">
        <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => navigate('/events')}>
          <Eye className="mr-1 h-3 w-3" /> View All Events
        </Button>
      </div>
    </div>
  );
}
