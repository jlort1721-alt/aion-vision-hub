import { memo, useCallback, useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/use-websocket";
import { apiClient } from "../../lib/api-client";
import {
  AlertTriangle,
  Siren,
  DoorClosed,
  Phone,
  FileWarning,
  X,
} from "lucide-react";

interface AiCopilotBannerProps {
  cameraId: string;
  cameraLinkedDoorId?: string;
}

interface CopilotAlert {
  id: string;
  label: string;
  severity: string;
  ts: number;
}

const AUTO_DISMISS_MS = 60_000;

const ACTIONS = [
  {
    key: "siren",
    label: "Sirena",
    icon: Siren,
    color: "bg-red-600 hover:bg-red-700",
  },
  {
    key: "lock_door",
    label: "Bloquear",
    icon: DoorClosed,
    color: "bg-orange-600 hover:bg-orange-700",
  },
  {
    key: "call_supervisor",
    label: "Llamar",
    icon: Phone,
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    key: "create_incident",
    label: "Incidente",
    icon: FileWarning,
    color: "bg-purple-600 hover:bg-purple-700",
  },
];

function AiCopilotBannerInner({
  cameraId,
  cameraLinkedDoorId,
}: AiCopilotBannerProps) {
  const [alert, setAlert] = useState<CopilotAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe(
      "live-view-events",
      (payload: Record<string, unknown>) => {
        const camId =
          (payload.camera_id as string) || (payload.cameraId as string);
        if (camId !== cameraId) return;

        const severity =
          (payload.severity as string) || (payload.level as string) || "";
        if (severity !== "critical" && severity !== "high") return;

        const label =
          (payload.type as string) || (payload.label as string) || "Alerta";

        setAlert({
          id: (payload.id as string) || `${Date.now()}-${Math.random()}`,
          label,
          severity,
          ts: Date.now(),
        });
        setDismissed(false);
      },
    );

    return unsub;
  }, [cameraId, subscribe]);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert]);

  const executeAction = useCallback(
    async (actionKey: string) => {
      setActionPending(actionKey);
      try {
        switch (actionKey) {
          case "lock_door":
            if (cameraLinkedDoorId) {
              await apiClient.post("/intercom/door/open", {
                deviceId: cameraLinkedDoorId,
                reason: "AI Copilot — bloqueo de emergencia",
              });
            }
            break;
          case "create_incident":
            await apiClient.post("/incidents", {
              title: `IA: ${alert?.label} detectado`,
              severity: alert?.severity || "high",
              cameraId,
            });
            break;
          case "call_supervisor":
            await apiClient.post("/intercom/sessions/initiate", {
              mode: "human",
              targetUri: "sip:supervisor@localhost",
            });
            break;
          case "siren":
            await apiClient.post(`/domotics/${cameraLinkedDoorId}/action`, {
              action: "siren_on",
            });
            break;
        }
      } catch {
        /* best-effort */
      } finally {
        setActionPending(null);
      }
    },
    [cameraId, cameraLinkedDoorId, alert],
  );

  if (!alert || dismissed) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-2 py-1.5 bg-red-900/90 backdrop-blur-sm border-b border-red-700 animate-in slide-in-from-top">
      <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0 animate-pulse" />
      <span className="text-xs font-bold text-red-100 flex-1 truncate">
        {alert.label} detectado
      </span>

      <div className="flex gap-1 flex-shrink-0">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${action.color} disabled:opacity-40`}
              disabled={actionPending === action.key}
              onClick={() => executeAction(action.key)}
              title={action.label}
            >
              <Icon className="w-3 h-3" />
            </button>
          );
        })}
      </div>

      <button
        className="p-0.5 rounded hover:bg-red-800 text-red-300"
        onClick={() => setDismissed(true)}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export const AiCopilotBanner = memo(AiCopilotBannerInner);
