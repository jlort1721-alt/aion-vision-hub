import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

const severityConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  critical: { icon: <span className="h-4 w-4 text-destructive">●</span>, color: 'text-destructive' },
  high: { icon: <span className="h-4 w-4 text-warning">●</span>, color: 'text-warning' },
  medium: { icon: <span className="h-4 w-4 text-info">●</span>, color: 'text-info' },
  low: { icon: <span className="h-4 w-4 text-muted-foreground">●</span>, color: 'text-muted-foreground' },
  info: { icon: <span className="h-4 w-4 text-muted-foreground">●</span>, color: 'text-muted-foreground' },
};

interface Props {
  event: any;
  devices: any[];
  sites: any[];
  actionLoading: string | null;
  onAction: (eventId: string, action: string) => void;
}

export default function EventDetailPanel({ event, devices, sites, actionLoading, onAction }: Props) {
  const sev = severityConfig[event.severity] || severityConfig.info;

  return (
    <div className="w-[40%] overflow-auto p-4 space-y-4 border-l">
      <div>
        <div className="flex items-center gap-2">
          <span className={sev.color}>{sev.icon}</span>
          <Badge variant="outline" className="text-[10px] capitalize">{event.severity}</Badge>
        </div>
        <h2 className="font-bold mt-2">{event.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
      </div>

      {event.ai_summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Bot className="h-3 w-3" /> AI Summary</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{event.ai_summary}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{event.event_type.replace(/_/g, ' ')}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Device</span><span>{devices.find(d => d.id === event.device_id)?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Site</span><span>{sites.find(s => s.id === event.site_id)?.name?.split('—')[0]?.trim()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(event.created_at).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className="capitalize text-[10px]">{event.status}</Badge></div>
        </CardContent>
      </Card>

      {event.metadata && Object.keys(event.metadata as object).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto font-mono">{JSON.stringify(event.metadata, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => onAction(event.id, 'acknowledge')} disabled={event.status !== 'new' || !!actionLoading}>
          {actionLoading === 'acknowledge' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} Acknowledge
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onAction(event.id, 'ai-summary')} disabled={!!actionLoading}>
          {actionLoading === 'ai-summary' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bot className="mr-1 h-3 w-3" />} AI Explain
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onAction(event.id, 'resolve')} disabled={!!actionLoading}>
          Resolve
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onAction(event.id, 'create-incident')} disabled={!!actionLoading}>
          <AlertTriangle className="mr-1 h-3 w-3" /> Create Incident
        </Button>
      </div>
    </div>
  );
}
