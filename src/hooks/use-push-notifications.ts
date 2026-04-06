import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user, profile } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications not supported in this browser');
      return false;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      toast.success('Push notifications enabled');
      return true;
    }
    toast.error('Notification permission denied');
    return false;
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !profile) return;
    const granted = permission === 'granted' || await requestPermission();
    if (!granted) return;

    // Store subscription reference in DB
    try {
      await apiClient.post('/push/subscribe', {
        endpoint: `browser-${navigator.userAgent.slice(0, 50)}`,
        keys: { type: 'browser-native', ua: navigator.userAgent.slice(0, 100) },
      });
      setIsSubscribed(true);
      toast.success('Subscribed to critical event notifications');
    } catch (e) {
      if (import.meta.env.DEV) console.error('Push subscribe error:', e);
    }
  }, [user, profile, permission, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    await apiClient.post('/push/unsubscribe', {});
    setIsSubscribed(false);
    toast.success('Unsubscribed from notifications');
  }, [user]);

  // Show browser notification for critical events
  const showNotification = useCallback((title: string, body: string, tag?: string) => {
    if (permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: tag || 'aion-event',
        requireInteraction: true,
      });
    } catch {
      // Fallback to toast if Notification fails
      toast.error(`${title}: ${body}`);
    }
  }, [permission]);

  return { permission, isSubscribed, requestPermission, subscribe, unsubscribe, showNotification };
}
