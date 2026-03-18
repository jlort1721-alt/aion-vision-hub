import { useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { addNotification } from '@/lib/notification-history';

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

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('settings').limit(1).single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
    staleTime: 60000,
  });

  const prefs: NotificationPrefs = (tenant?.settings as any)?.notifications ?? {
    critical_events: true, high_severity: true, device_offline: true,
  };

  useEffect(() => {
    const channel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['events-legacy'] });
          const evt = payload.new as any;

          const shouldNotify =
            (evt.severity === 'critical' && prefs.critical_events !== false) ||
            (evt.severity === 'high' && prefs.high_severity !== false) ||
            (evt.severity === 'medium' && prefs.medium_severity !== false) ||
            (evt.severity === 'low' && prefs.low_severity !== false) ||
            (evt.severity === 'info' && prefs.info_events !== false);

          const isCritical = evt.severity === 'critical' || evt.severity === 'high';

          // Store in notification history (always, regardless of prefs)
          addNotification({
            title: evt.title,
            body: `${evt.event_type?.replace(/_/g, ' ')} — ${evt.severity}`,
            severity: evt.severity,
          });

          // Only show toast if user preferences allow this severity
          if (shouldNotify) {
            toast({
              title: `${isCritical ? '[!] ' : ''}${evt.title}`,
              description: `${evt.event_type?.replace(/_/g, ' ')} — ${evt.severity}`,
              variant: isCritical ? 'destructive' : 'default',
            });
          }

          if (shouldNotify && isCritical && permission === 'granted') {
            showNotification(
              `${evt.severity.toUpperCase()}: ${evt.title}`,
              `${evt.event_type?.replace(/_/g, ' ')} — Requires immediate attention`,
              `event-${evt.id}`
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['events-legacy'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast, showNotification, permission, prefs]);
}
