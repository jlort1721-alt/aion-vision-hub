import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addNotification } from '@/lib/notification-history';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WSMessage {
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type MessageHandler = (message: WSMessage) => void;

const API_URL = import.meta.env.VITE_API_URL || '';

export function useWebSocket() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const subscribe = useCallback((channel: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(channel)) {
      handlersRef.current.set(channel, new Set());
    }
    handlersRef.current.get(channel)!.add(handler);

    // Tell server about subscription
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }

    return () => {
      handlersRef.current.get(channel)?.delete(handler);
      if (handlersRef.current.get(channel)?.size === 0) {
        handlersRef.current.delete(channel);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
        }
      }
    };
  }, []);

  const connect = useCallback(() => {
    if (!session?.access_token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (!API_URL) {
      console.warn('[useWebSocket] VITE_API_URL is not set — skipping WebSocket connection.');
      return;
    }

    const wsUrl = API_URL.replace(/^http/, 'ws');
    // Auth via first message instead of query param to avoid token in server logs
    const ws = new WebSocket(`${wsUrl}/ws`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      // Send auth token as first message (protocol-level auth)
      ws.send(JSON.stringify({ type: 'auth', token: session.access_token }));
      setStatus('connected');
      reconnectAttempts.current = 0;

      // Re-subscribe to all channels
      for (const channel of handlersRef.current.keys()) {
        ws.send(JSON.stringify({ type: 'subscribe', channel }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        // Handle system messages (ping/pong)
        if (msg.channel === 'system') {
          const payload = msg.payload as { type?: string };
          if (payload.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          return;
        }

        // Dispatch to channel handlers
        const handlers = handlersRef.current.get(msg.channel);
        if (handlers) {
          for (const handler of handlers) {
            try { handler(msg); } catch { /* handler error */ }
          }
        }

        // Built-in event handling — invalidate queries + show toasts
        if (msg.channel === 'events') {
          const eventPayload = msg.payload as { type?: string; event?: Record<string, unknown> };
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['events-legacy'] });

          if (eventPayload.type === 'event.new' && eventPayload.event) {
            const evt = eventPayload.event;
            const severity = evt.severity as string;
            const isCritical = severity === 'critical' || severity === 'high';

            addNotification({
              title: (evt.title as string) ?? 'New Event',
              body: `${(evt.type as string)?.replace(/_/g, ' ')} - ${severity}`,
              severity,
            });

            toast({
              title: `${isCritical ? '[!] ' : ''}${evt.title}`,
              description: `${(evt.type as string)?.replace(/_/g, ' ')} - ${severity}`,
              variant: isCritical ? 'destructive' : 'default',
            });
          }
        }

        if (msg.channel === 'alerts') {
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
        }

        if (msg.channel === 'incidents') {
          queryClient.invalidateQueries({ queryKey: ['incidents'] });
        }

        if (msg.channel === 'devices') {
          queryClient.invalidateQueries({ queryKey: ['devices'] });
        }

      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimeout.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [session?.access_token, queryClient, toast]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { status, subscribe };
}
