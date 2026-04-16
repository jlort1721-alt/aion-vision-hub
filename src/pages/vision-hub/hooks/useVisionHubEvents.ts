import { useEffect, useState } from "react";

export interface VHFailoverEvent {
  device_id: string;
  prev: string | null;
  next: string;
  ts: number;
}

export function useVisionHubEvents(max = 30): VHFailoverEvent[] {
  const [events, setEvents] = useState<VHFailoverEvent[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/v1/vision-hub/events/stream", {
      withCredentials: true,
    });

    es.addEventListener("route_change", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as VHFailoverEvent;
        setEvents((prev) => [data, ...prev].slice(0, max));
      } catch {
        /* malformed payload; ignore */
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => es.close();
  }, [max]);

  return events;
}
