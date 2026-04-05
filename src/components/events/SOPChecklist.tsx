import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── SOP Templates ────────────────────────────────────────────

interface SOPStep {
  id: number;
  action: string;
  maxTime: number;
}

interface SOPTemplate {
  name: string;
  steps: SOPStep[];
}

const SOP_TEMPLATES: Record<string, SOPTemplate> = {
  'intrusion_critical': {
    name: 'Alarma de Intrusion',
    steps: [
      { id: 1, action: 'Verificar visualmente en la camara mas cercana', maxTime: 30 },
      { id: 2, action: 'Si confirma intrusion, activar sirena de la sede', maxTime: 15 },
      { id: 3, action: 'Llamar al 123 (Policia Nacional)', maxTime: 60 },
      { id: 4, action: 'Notificar al administrador de la sede', maxTime: 120 },
      { id: 5, action: 'Capturar snapshots de las camaras relevantes', maxTime: 180 },
      { id: 6, action: 'Crear incidente en el sistema con prioridad CRITICA', maxTime: 300 },
    ],
  },
  'fire_critical': {
    name: 'Protocolo de Incendio',
    steps: [
      { id: 1, action: 'Verificar visualmente por camaras', maxTime: 30 },
      { id: 2, action: 'Activar sirena de evacuacion', maxTime: 15 },
      { id: 3, action: 'Llamar a Bomberos (119)', maxTime: 60 },
      { id: 4, action: 'Notificar administrador y coordinar evacuacion', maxTime: 120 },
      { id: 5, action: 'Crear incidente CRITICO en el sistema', maxTime: 180 },
    ],
  },
  'access_medium': {
    name: 'Acceso No Autorizado',
    steps: [
      { id: 1, action: 'Verificar camara del punto de acceso', maxTime: 30 },
      { id: 2, action: 'Identificar a la persona (buscar en sistema)', maxTime: 60 },
      { id: 3, action: 'Contactar al guardia de la sede', maxTime: 120 },
      { id: 4, action: 'Registrar evento con descripcion detallada', maxTime: 300 },
    ],
  },
  'device_offline_medium': {
    name: 'Dispositivo Offline',
    steps: [
      { id: 1, action: 'Verificar conectividad de la sede', maxTime: 60 },
      { id: 2, action: 'Intentar reinicio remoto del dispositivo', maxTime: 120 },
      { id: 3, action: 'Si no responde, contactar tecnico', maxTime: 300 },
      { id: 4, action: 'Documentar incidencia', maxTime: 600 },
    ],
  },
  'default': {
    name: 'Procedimiento General',
    steps: [
      { id: 1, action: 'Verificar el evento visualmente', maxTime: 60 },
      { id: 2, action: 'Evaluar si requiere accion inmediata', maxTime: 120 },
      { id: 3, action: 'Documentar el evento', maxTime: 300 },
    ],
  },
};

// ── Helper ───────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function getTemplateKey(eventType: string, severity: string): string {
  const key = `${eventType}_${severity}`;
  if (key in SOP_TEMPLATES) return key;
  // Try eventType-only match
  const partial = Object.keys(SOP_TEMPLATES).find((k) => k.startsWith(eventType));
  return partial || 'default';
}

// ── Props ────────────────────────────────────────────────────

interface SOPChecklistProps {
  eventType: string;
  severity: string;
  onComplete?: () => void;
}

// ── Component ────────────────────────────────────────────────

export default function SOPChecklist({ eventType, severity, onComplete }: SOPChecklistProps) {
  const templateKey = getTemplateKey(eventType, severity);
  const template = SOP_TEMPLATES[templateKey];

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [activeStep, setActiveStep] = useState<number>(template.steps[0]?.id ?? 0);
  const [elapsed, setElapsed] = useState<Record<number, number>>({});
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick the active step timer
  useEffect(() => {
    if (completed) return;

    timerRef.current = setInterval(() => {
      setElapsed((prev) => ({
        ...prev,
        [activeStep]: (prev[activeStep] ?? 0) + 1,
      }));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeStep, completed]);

  const handleCheck = useCallback(
    (stepId: number) => {
      if (checked.has(stepId)) return; // cannot un-check
      // Only allow checking the active step (enforce order)
      if (stepId !== activeStep) return;

      const next = new Set(checked);
      next.add(stepId);
      setChecked(next);

      // Find next unchecked step
      const remaining = (template.steps || []).filter((s) => !next.has(s.id));
      if (remaining.length === 0) {
        setCompleted(true);
        onComplete?.();
      } else {
        setActiveStep(remaining[0].id);
      }
    },
    [checked, activeStep, template.steps, onComplete],
  );

  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardIcon className="h-4 w-4 text-primary" />
          {template.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Siga los pasos en orden. El temporizador indica el tiempo maximo por paso.
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {(template.steps || []).map((step) => {
          const isChecked = checked.has(step.id);
          const isActive = step.id === activeStep && !completed;
          const timeSpent = elapsed[step.id] ?? 0;
          const isExpired = !isChecked && timeSpent > step.maxTime;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all',
                isChecked && 'border-success/30 bg-success/5',
                isActive && !isExpired && 'border-primary/40 bg-primary/5',
                isActive && isExpired && 'border-destructive/50 bg-destructive/10 animate-pulse',
                !isChecked && !isActive && 'border-border/30 opacity-50',
              )}
            >
              {/* Step number */}
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isChecked
                    ? 'bg-success text-success-foreground'
                    : isExpired
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {isChecked ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.id}
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm leading-snug',
                    isChecked && 'line-through text-muted-foreground',
                  )}
                >
                  {step.action}
                </p>
              </div>

              {/* Timer badge */}
              <div className="flex items-center gap-2 shrink-0">
                {isActive && !isChecked && (
                  <Badge
                    variant={isExpired ? 'destructive' : 'outline'}
                    className={cn(
                      'gap-1 text-[11px] tabular-nums',
                      isExpired && 'animate-pulse',
                    )}
                  >
                    {isExpired ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {formatTime(Math.max(step.maxTime - timeSpent, 0))}
                  </Badge>
                )}
                {isChecked && (
                  <Badge variant="outline" className="gap-1 text-[11px] border-success/40 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    {formatTime(elapsed[step.id] ?? 0)}
                  </Badge>
                )}
              </div>

              {/* Checkbox */}
              <Checkbox
                checked={isChecked}
                disabled={!isActive || isChecked}
                onCheckedChange={() => handleCheck(step.id)}
                className="mt-0.5 shrink-0"
              />
            </div>
          );
        })}

        {/* Completion banner */}
        {completed && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-semibold text-success">SOP Completado</p>
              <p className="text-xs text-muted-foreground">
                Todos los pasos fueron ejecutados correctamente.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple clipboard icon inline to avoid extra imports
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}
