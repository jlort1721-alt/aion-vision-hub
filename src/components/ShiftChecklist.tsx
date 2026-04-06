import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

const CHECKLIST_ITEMS = [
  { id: 'cameras', label: 'Verificar camaras operativas' },
  { id: 'doors', label: 'Puertas y accesos asegurados' },
  { id: 'radios', label: 'Radios y comunicaciones OK' },
  { id: 'patrol', label: 'Ronda inicial completada' },
  { id: 'logbook', label: 'Minuta de turno anterior revisada' },
  { id: 'keys', label: 'Llaves y control de acceso verificados' },
  { id: 'emergency', label: 'Equipos de emergencia revisados' },
  { id: 'report', label: 'Reporte de novedades previas leido' },
];

export default function ShiftChecklist() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = CHECKLIST_ITEMS.every(item => checked[item.id]);
  const checkedCount = CHECKLIST_ITEMS.filter(item => checked[item.id]).length;

  const handleComplete = () => {
    if (!allChecked) {
      toast.error('Complete todos los items antes de confirmar');
      return;
    }
    toast.success('Checklist de turno completado');
    setOpen(false);
    setChecked({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ClipboardCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Checklist Turno</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Inicio de Turno
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {CHECKLIST_ITEMS.map(item => (
            <label
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={!!checked[item.id]}
                onCheckedChange={() => toggle(item.id)}
              />
              <span className={`text-sm ${checked[item.id] ? 'line-through text-muted-foreground' : ''}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {checkedCount}/{CHECKLIST_ITEMS.length} completados
          </span>
          <Button onClick={handleComplete} disabled={!allChecked}>
            Confirmar Turno
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
