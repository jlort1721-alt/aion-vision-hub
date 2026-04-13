import { useEffect, useRef, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";

export function LiveVideo({
  deviceId,
  channel,
}: {
  deviceId: string;
  channel: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<"connecting" | "playing" | "error">(
    "connecting",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          bundlePolicy: "max-bundle",
        });
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.ontrack = (ev) => {
          if (videoRef.current) videoRef.current.srcObject = ev.streams[0];
          setStatus("playing");
        };
        pc.oniceconnectionstatechange = () => {
          if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            setStatus("error");
            setErrorMsg("Conexion WebRTC caida");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const name = `aion_${deviceId}`;
        const url = `/stream/api/webrtc?src=${encodeURIComponent(name)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/sdp" },
          body: offer.sdp,
        });
        if (!res.ok) {
          setStatus("error");
          setErrorMsg(`go2rtc ${res.status}: ${name}`);
          return;
        }
        const answerSDP = await res.text();
        if (cancelled) {
          pc.close();
          return;
        }
        await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
        pcRef.current = pc;
      } catch (err) {
        setStatus("error");
        setErrorMsg(String((err as Error).message));
      }
    })();
    return () => {
      cancelled = true;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [deviceId, channel]);

  return (
    <div className="relative w-full aspect-video bg-black rounded overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Conectando...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 text-sm text-center px-4">
          <VideoOff className="w-8 h-8 mb-2" />
          <div className="font-mono">{errorMsg}</div>
          <div className="text-xs text-slate-500 mt-2">
            El orchestrator elegira una ruta alterna si esta disponible.
          </div>
        </div>
      )}
      <div className="absolute top-2 left-2 text-xs font-mono bg-black/60 text-white px-2 py-0.5 rounded">
        CH {channel}
      </div>
    </div>
  );
}
