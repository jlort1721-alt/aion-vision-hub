import { memo, useCallback, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { apiClient } from "../../lib/api-client";

type PttState = "idle" | "connecting" | "talking" | "ended" | "error";

interface IntercomPushToTalkProps {
  deviceId: string;
  deviceName?: string;
}

function IntercomPushToTalkInner({
  deviceId,
  deviceName,
}: IntercomPushToTalkProps) {
  const [state, setState] = useState<PttState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const sessionIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCall = useCallback(async () => {
    setState("connecting");
    setErrorMsg("");

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = media;

      const res = (await apiClient.post("/intercom/sessions/initiate", {
        targetUri: `sip:${deviceId}@localhost`,
        mode: "human",
        deviceId,
      })) as { data?: { id?: string }; id?: string };

      sessionIdRef.current = res.data?.id ?? res.id ?? null;
      setState("talking");
    } catch (err: unknown) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setState("error");
    }
  }, [deviceId]);

  const endCall = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (sessionIdRef.current) {
      try {
        await apiClient.post(
          `/intercom/sessions/${sessionIdRef.current}/hangup`,
          {},
        );
      } catch {
        /* best-effort */
      }
      sessionIdRef.current = null;
    }
    setState("ended");
    setTimeout(() => setState("idle"), 2000);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 p-3">
      <p className="text-xs font-medium text-muted-foreground truncate max-w-full">
        {deviceName || "Citófono"}
      </p>

      {state === "idle" && (
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
          onClick={startCall}
        >
          <Phone className="w-4 h-4" />
          Llamar
        </button>
      )}

      {state === "connecting" && (
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
          Conectando...
        </div>
      )}

      {state === "talking" && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Mic className="w-4 h-4 animate-pulse" />
            En llamada
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            onClick={endCall}
          >
            <PhoneOff className="w-4 h-4" />
            Colgar
          </button>
        </div>
      )}

      {state === "ended" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MicOff className="w-4 h-4" />
          Llamada finalizada
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-red-400">{errorMsg}</p>
          <button
            className="text-xs text-blue-400 underline"
            onClick={() => setState("idle")}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

export const IntercomPushToTalk = memo(IntercomPushToTalkInner);
