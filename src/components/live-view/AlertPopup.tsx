import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Camera, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────
export interface LiveViewEvent {
  id: string;
  eventType: string;
  severity: string;
  cameraId: string;
  cameraName: string;
  siteName: string;
  snapshotUrl: string;
  timestamp: string;
}

interface AlertPopupProps {
  event: LiveViewEvent | null;
  onAcknowledge: (eventId: string) => void;
  onFocusCamera: (cameraId: string) => void;
  onDismiss: (eventId: string) => void;
}

// ── Constants ─────────────────────────────────────────────────
const AUTO_DISMISS_MS = 15_000;
const COUNTDOWN_INTERVAL_MS = 50;
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

// ── Helpers ───────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatEventType(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────
export function AlertPopup({ event, onAcknowledge, onFocusCamera, onDismiss }: AlertPopupProps) {
  const [progress, setProgress] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Play alert sound on mount
  useEffect(() => {
    if (!event) return;

    audioRef.current = new Audio('/sounds/alert.mp3');
    audioRef.current.play().catch(() => {});

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [event]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!event) return;

    setProgress(1);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / AUTO_DISMISS_MS);
      setProgress(remaining);

      if (remaining <= 0) {
        clearTimers();
        onDismiss(event.id);
      }
    }, COUNTDOWN_INTERVAL_MS);

    return clearTimers;
  }, [event, onDismiss, clearTimers]);

  if (!event) return null;

  const severityColor = SEVERITY_COLORS[event.severity] ?? SEVERITY_COLORS.info;

  const handleAcknowledge = () => {
    clearTimers();
    onAcknowledge(event.id);
  };

  const handleFocusCamera = () => {
    clearTimers();
    onFocusCamera(event.cameraId);
  };

  const handleDismiss = () => {
    clearTimers();
    onDismiss(event.id);
  };

  // SVG countdown ring values
  const circumference = 2 * Math.PI * 18;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-label="Alerta de evento"
    >
      <div
        className={cn(
          'relative w-full max-w-lg mx-4 rounded-xl border-2 border-red-500 bg-background shadow-2xl',
          'animate-in zoom-in-95 slide-in-from-bottom-4 duration-300',
          'ring-4 ring-red-500/30 animate-pulse-border',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold">Alerta de Evento</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-white text-xs', severityColor)}>
              {event.severity.toUpperCase()}
            </Badge>
            {/* Countdown ring */}
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground/20"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="text-red-500 transition-[stroke-dashoffset] duration-100"
              />
            </svg>
            <button
              onClick={handleDismiss}
              className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Snapshot */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={event.snapshotUrl}
            alt={`Captura de ${event.cameraName}`}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div
            className="hidden h-full w-full items-center justify-center text-muted-foreground"
            style={{ display: 'none' }}
          >
            <Camera className="mr-2 h-8 w-8" />
            <span className="text-sm">Sin imagen disponible</span>
          </div>
        </div>

        {/* Event details */}
        <div className="space-y-2 px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo:</span>{' '}
              <span className="font-medium">{formatEventType(event.eventType)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Severidad:</span>{' '}
              <span className="font-medium">{event.severity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Camara:</span>{' '}
              <span className="font-medium">{event.cameraName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sitio:</span>{' '}
              <span className="font-medium">{event.siteName}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Fecha/Hora:</span>{' '}
              <span className="font-medium">{formatTimestamp(event.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Descartar
          </Button>
          <Button variant="outline" size="sm" onClick={handleFocusCamera}>
            <Camera className="mr-1 h-4 w-4" />
            Ver Camara
          </Button>
          <Button size="sm" onClick={handleAcknowledge}>
            <CheckCircle className="mr-1 h-4 w-4" />
            Reconocer
          </Button>
        </div>
      </div>

      {/* Pulsing border animation via global style */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
