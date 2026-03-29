import { useEffect, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { addNotification } from '@/lib/notification-history';
import { useWebSocket } from '@/hooks/use-websocket';

interface NotificationPrefs {
  critical_events?: boolean;
  high_severity?: boolean;
  medium_severity?: boolean;
  low_severity?: boolean;
  info_events?: boolean;
  device_offline?: boolean;
  health_changes?: boolean;
  incident_updates?: boolean;
}

export function useRealtimeEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { showNotification, permission } = usePushNotifications();
  const { profile } = useAuth();
  const { subscribe } = useWebSocket();

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Record<string, unknown> }>('/tenants/current');
      return response.data;
    },
    enabled: !!profile,
    staleTime: 60000,
  });

  const prefs: NotificationPrefs = useMemo(() => ((tenant?.settings as Record<string, unknown> | undefined)?.notifications as NotificationPrefs | undefined) ?? {
    critical_events: true, high_severity: true, device_offline: true,
  }, [tenant?.settings]);

  useEffect(() => {
    const unsubscribe = subscribe('events', (msg) => {
      const payload = msg.payload as { type?: string; event?: Record<string, unknown> };

      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-legacy'] });
      queryClient.invalidateQueries({ queryKey: ['events-liveview'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-event-count'] });

      if (payload.type === 'event.new' && payload.event) {
        const evt = payload.event;
        const severity = evt.severity as string;

        const shouldNotify =
          (severity === 'critical' && prefs.critical_events !== false) ||
          (severity === 'high' && prefs.high_severity !== false) ||
          (severity === 'medium' && prefs.medium_severity !== false) ||
          (severity === 'low' && prefs.low_severity !== false) ||
          (severity === 'info' && prefs.info_events !== false);

        const isCritical = severity === 'critical' || severity === 'high';

        // Store in notification history (always, regardless of prefs)
        addNotification({
          title: (evt.title as string) ?? 'New Event',
          body: `${(evt.event_type as string)?.replace(/_/g, ' ')} — ${severity}`,
          severity,
        });

        // Only show toast if user preferences allow this severity
        if (shouldNotify) {
          toast({
            title: `${isCritical ? '[!] ' : ''}${evt.title}`,
            description: `${(evt.event_type as string)?.replace(/_/g, ' ')} — ${severity}`,
            variant: isCritical ? 'destructive' : 'default',
          });
        }

        if (shouldNotify && isCritical && permission === 'granted') {
          showNotification(
            `${severity.toUpperCase()}: ${evt.title}`,
            `${(evt.event_type as string)?.replace(/_/g, ' ')} — Requires immediate attention`,
            `event-${evt.id}`
          );
        }
      }

      if (payload.type === 'event.updated') {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['events-legacy'] });
      }
    });

    return unsubscribe;
  }, [queryClient, toast, showNotification, permission, prefs, subscribe]);
}
