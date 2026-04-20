import { useEffect, useRef, useState, useCallback } from "react";

interface LiveEvent {
  channel: string;
  payload: unknown;
  receivedAt: string;
}

interface UseLiveEventsOptions {
  channels?: string[];
  onEvent?: (event: LiveEvent) => void;
  enabled?: boolean;
  autoReconnect?: boolean;
}

interface UseLiveEventsReturn {
  events: LiveEvent[];
  connected: boolean;
  lastError: string | null;
  clearEvents: () => void;
}

function wsEndpoint(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

/**
 * Subscribe to real-time events from backend WebSocket (Redis pub/sub + pg_notify).
 * Channels: 'events', 'incidents', 'alerts', 'access_door_events', 'isapi_events'
 */
export function useLiveEvents(
  opts: UseLiveEventsOptions = {},
): UseLiveEventsReturn {
  const { channels = [], onEvent, enabled = true, autoReconnect = true } = opts;
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelsKey = channels.join(",");

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current) return;

    const ws = new WebSocket(wsEndpoint());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLastError(null);
      const subMsg = {
        action: "subscribe",
        channels: channelsKey ? channelsKey.split(",") : [],
      };
      ws.send(JSON.stringify(subMsg));
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "event" || data.channel) {
          const event: LiveEvent = {
            channel: data.channel ?? "unknown",
            payload: data.payload ?? data,
            receivedAt: new Date().toISOString(),
          };
          setEvents((prev) => [event, ...prev].slice(0, 200));
          onEvent?.(event);
        }
      } catch (err) {
        // non-JSON heartbeat or similar
      }
    };

    ws.onerror = () => {
      setLastError("WebSocket error");
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (autoReconnect && enabled) {
        reconnectTimerRef.current = setTimeout(() => connect(), 3000);
      }
    };
  }, [enabled, channelsKey, autoReconnect, onEvent]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, lastError, clearEvents };
}
