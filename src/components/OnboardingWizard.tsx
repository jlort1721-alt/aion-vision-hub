import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, Video, Bell, Zap, Bot, ChevronLeft, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'aion-onboarding-completed';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Shield className="h-12 w-12 text-primary" />,
    title: 'Bienvenido a AION',
    description: 'Plataforma integral de operaciones de seguridad.',
    detail:
      'AION centraliza videovigilancia, control de acceso, automatizacion e inteligencia artificial en una sola interfaz. Navegue facilmente entre modulos usando el menu lateral o el buscador global (Ctrl+K).',
  },
  {
    icon: <Video className="h-12 w-12 text-primary" />,
    title: 'Centro de Monitoreo',
    description: 'Vista en vivo y muro de video.',
    detail:
      'Acceda a Live View para ver camaras en tiempo real y al Video Wall para distribuir multiples fuentes en pantallas dedicadas. Use Playback para revisar grabaciones historicas.',
  },
  {
    icon: <Bell className="h-12 w-12 text-primary" />,
    title: 'Gestion de Eventos',
    description: 'Eventos, incidentes y automatizacion.',
    detail:
      'Los eventos se generan automaticamente desde camaras y sensores. Escale a incidentes cuando requieran seguimiento. Configure reglas de automatizacion para respuestas inmediatas.',
  },
  {
    icon: <Zap className="h-12 w-12 text-primary" />,
    title: 'Domoticos e IoT',
    description: 'Control de dispositivos inteligentes.',
    detail:
      'Gestione relays, sirenas y sensores eWeLink directamente desde AION. Active o desactive dispositivos, programe horarios y vincule acciones a eventos de seguridad.',
  },
  {
    icon: <Bot className="h-12 w-12 text-primary" />,
    title: 'Asistente IA',
    description: 'Chat inteligente con herramientas MCP.',
    detail:
      'El asistente de IA puede consultar datos de la plataforma, generar reportes, analizar patrones y ejecutar acciones mediante herramientas MCP. Acceda con Ctrl+Shift+A.',
  },
];

export default function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so the layout renders first
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="items-center text-center">
          <div className="flex items-center justify-center mb-4">
            {current.icon}
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-base">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted/50 border p-4 min-h-[80px] flex items-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.detail}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step
                  ? 'bg-primary'
                  : i < step
                    ? 'bg-primary/40'
                    : 'bg-muted-foreground/20'
              }`}
              aria-label={`Paso ${i + 1}`}
            />
          ))}
        </div>

        {/* "No mostrar de nuevo" checkbox on last step */}
        {isLast && (
          <label className="flex items-center gap-2 justify-center text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-input"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            No mostrar de nuevo
          </label>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Omitir
            </Button>
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? 'Comenzar' : 'Siguiente'}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
