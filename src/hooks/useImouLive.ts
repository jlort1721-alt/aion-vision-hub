import { useCallback, useEffect, useRef, useState } from "react";

type ImouLiveStatus = "idle" | "binding" | "ready" | "error";

interface UseImouLiveParams {
  serial: string;
  channel: number;
  streamId?: 0 | 1;
  enabled?: boolean;
}

interface UseImouLiveReturn {
  proxyUrl: string | null;
  status: ImouLiveStatus;
  error: string | undefined;
  rebind: () => void;
}

interface BindResponse {
  liveToken: string;
  hlsUrl: string;
  proxyUrl: string;
  expiresAt: number;
  error?: string;
}

export function useImouLive({
  serial,
  channel,
  streamId = 0,
  enabled = true,
}: UseImouLiveParams): UseImouLiveReturn {
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ImouLiveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const tokenRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const bind = useCallback(async () => {
    if (!serial || !enabled) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus("binding");
    setError(undefined);

    try {
      const res = await fetch("/imou-live/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, channel, streamId }),
        signal: ac.signal,
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`bind ${res.status}: ${text}`);
      }

      const data: BindResponse = await res.json();
      if (data.error) throw new Error(data.error);

      tokenRef.current = data.liveToken;
      setProxyUrl(data.proxyUrl);
      setStatus("ready");
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("error");
    }
  }, [serial, channel, streamId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    bind();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      const token = tokenRef.current;
      if (token) {
        fetch(`/imou-live/unbind/${token}`, { method: "DELETE" }).catch(
          () => {},
        );
        tokenRef.current = null;
      }
      setProxyUrl(null);
      setStatus("idle");
    };
  }, [bind]);

  return { proxyUrl, status, error, rebind: bind };
}
