import { useMemo } from "react";
import { useImouLive } from "./useImouLive";

type StreamProtocol = "mse" | "hls-proxy" | "snapshot" | "none";

interface CameraDevice {
  id: string;
  stream_key?: string;
  vendor?: string;
  imou_serial?: string;
  imou_channel?: number;
  status?: string;
}

interface UseCameraStreamParams {
  device: CameraDevice | null;
  quality?: "main" | "sub";
  enabled?: boolean;
}

interface UseCameraStreamReturn {
  src: string;
  protocol: StreamProtocol;
  isImou: boolean;
  imouStatus: string;
  imouError: string | undefined;
  rebindImou: () => void;
}

export function useCameraStream({
  device,
  quality = "sub",
  enabled = true,
}: UseCameraStreamParams): UseCameraStreamReturn {
  const isImou = !!device?.imou_serial;
  const streamId = quality === "main" ? 0 : 1;

  const {
    proxyUrl,
    status: imouStatus,
    error: imouError,
    rebind,
  } = useImouLive({
    serial: device?.imou_serial ?? "",
    channel: device?.imou_channel ?? 0,
    streamId,
    enabled: enabled && isImou,
  });

  const result = useMemo<UseCameraStreamReturn>(() => {
    if (!device || device.status === "offline" || !enabled) {
      return {
        src: "",
        protocol: "none",
        isImou,
        imouStatus,
        imouError,
        rebindImou: rebind,
      };
    }

    if (isImou && proxyUrl) {
      return {
        src: proxyUrl,
        protocol: "hls-proxy",
        isImou: true,
        imouStatus,
        imouError,
        rebindImou: rebind,
      };
    }

    if (device.stream_key) {
      return {
        src: device.stream_key,
        protocol: "mse",
        isImou: false,
        imouStatus,
        imouError,
        rebindImou: rebind,
      };
    }

    return {
      src: "",
      protocol: "snapshot",
      isImou: false,
      imouStatus,
      imouError,
      rebindImou: rebind,
    };
  }, [device, enabled, isImou, proxyUrl, imouStatus, imouError, rebind]);

  return result;
}
