import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function LogbookEntry() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('novedad');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('El titulo es requerido');
      return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/operational-data/consignas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          type: category,
        }),
      });
      toast.success('Registro guardado en la minuta');
      setTitle('');
      setDescription('');
      setCategory('novedad');
      setOpen(false);
    } catch {
      toast.error('Error al guardar el registro');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Nueva entrada de minuta"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Nueva Entrada de Minuta
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="log-title">Titulo</Label>
              <Input
                id="log-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Vehiculo no autorizado en parqueadero"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="log-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novedad">Novedad</SelectItem>
                  <SelectItem value="ingreso">Ingreso / Salida</SelectItem>
                  <SelectItem value="ronda">Ronda</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="emergencia">Emergencia</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-desc">Descripcion</Label>
              <Textarea
                id="log-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalle lo ocurrido..."
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar Registro'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
