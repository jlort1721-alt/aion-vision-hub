// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Enhanced Notification Panel
// Popover with tabs: Todas, Sin leer, Criticas
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell, AlertTriangle, CheckCheck, Volume2, VolumeX, Shield,
  Info, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

interface NotificationEvent {
  id: string;
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  created_at?: string;
  read?: boolean;
}

interface PaginatedEnvelope {
  meta?: { total?: number };
  items?: NotificationEvent[];
  data?: NotificationEvent[];
}

// ── Time Ago Helper ───────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

// ── Severity Icon ─────────────────────────────────────────

function SeverityIcon({ severity }: { severity?: string }) {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'high':
      return <Shield className="h-4 w-4 text-warning" />;
    case 'medium':
      return <Info className="h-4 w-4 text-info" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

// ── Notification Row ──────────────────────────────────────

function NotificationRow({
  event,
  onClick,
}: {
  event: NotificationEvent;
  onClick: () => void;
}) {
  const isUnread = !event.read && event.status === 'new';
  return (
    <button
      className={cn(
        'flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors border-b last:border-b-0',
        isUnread
          ? 'bg-primary/5 hover:bg-primary/10'
          : 'hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <span className="mt-0.5 shrink-0">
        <SeverityIcon severity={event.severity} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm truncate', isUnread ? 'font-semibold' : 'font-medium')}>
            {event.title || event.description || 'Evento'}
          </p>
          {isUnread && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        {event.created_at && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {timeAgo(event.created_at)}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────

export default function NotificationPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('todas');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('aion-notif-sound') !== 'off';
  });
  const prevCountRef = useRef(0);

  // ── Fetch notifications ───────────────────────────────
  const { data: allNotifications = [], isLoading } = useQuery({
    queryKey: ['notification-panel'],
    queryFn: async () => {
      const resp = await apiClient.get<PaginatedEnvelope>('/events', {
        limit: '20',
        severity: 'critical,high,medium,low',
      });
      const items = Array.isArray(resp) ? resp : (resp?.items ?? resp?.data ?? []);
      return items as NotificationEvent[];
    },
    refetchInterval: 15_000,
  });

  const totalUnread = allNotifications.filter(
    (e) => !e.read && e.status === 'new'
  ).length;

  // ── Sound on new notification ─────────────────────────
  useEffect(() => {
    if (soundEnabled && totalUnread > prevCountRef.current && prevCountRef.current > 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        // Audio not available
      }
    }
    prevCountRef.current = totalUnread;
  }, [totalUnread, soundEnabled]);

  // ── Toggle sound ──────────────────────────────────────
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('aion-notif-sound', next ? 'on' : 'off');
      return next;
    });
  }, []);

  // ── Mark all as read ──────────────────────────────────
  const markAllMutation = useMutation({
    mutationFn: () =>
      apiClient.post<void>('/events/mark-all-read', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-panel'] });
      queryClient.invalidateQueries({ queryKey: ['header-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-event-count'] });
    },
  });

  // ── Filtered lists ────────────────────────────────────
  const unread = allNotifications.filter((e) => !e.read && e.status === 'new');
  const critical = allNotifications.filter(
    (e) => e.severity === 'critical' || e.severity === 'high'
  );

  const displayList =
    tab === 'sinleer' ? unread : tab === 'criticas' ? critical : allNotifications;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0"
        {...(totalUnread > 0 ? { role: 'alert' as const } : {})}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {totalUnread} nuevas
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar notificaciones' : 'Activar sonido'}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            {totalUnread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como leidas
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="px-4 pt-2">
            <TabsList className="w-full h-8">
              <TabsTrigger value="todas" className="text-xs flex-1">
                Todas
              </TabsTrigger>
              <TabsTrigger value="sinleer" className="text-xs flex-1">
                Sin leer ({unread.length})
              </TabsTrigger>
              <TabsTrigger value="criticas" className="text-xs flex-1">
                Criticas ({critical.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={tab} className="mt-0">
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : displayList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {tab === 'sinleer'
                    ? 'No hay notificaciones sin leer'
                    : tab === 'criticas'
                    ? 'No hay notificaciones criticas'
                    : 'No hay notificaciones'}
                </p>
              ) : (
                displayList.map((evt) => (
                  <NotificationRow
                    key={evt.id}
                    event={evt}
                    onClick={() => navigate('/events')}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate('/audit')}
          >
            Ver todas &rarr;
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
