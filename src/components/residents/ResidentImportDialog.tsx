import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportRow {
  full_name: string;
  unit_number: string;
  phone?: string;
  email?: string;
  id_number?: string;
  vehicle_plate?: string;
  notes?: string;
  status?: string;
  site_id?: string;
}

export default function ResidentImportDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: Array<{ row: number; reason: string }>;
  } | null>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (records: ImportRow[]) =>
      apiClient.post('/operational-data/residents/bulk-import', { records }),
    onSuccess: (data: any) => {
      setResult(data.data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      toast.success(`${data.data.imported} residentes importados`);
    },
    onError: () => toast.error('Error al importar residentes'),
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
          toast.error('Archivo vacío o sin datos');
          return;
        }

        const headers = lines[0]
          .split(',')
          .map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
        const parsed: ImportRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i]
            .split(',')
            .map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((h, j) => {
            if (values[j]) row[h] = values[j];
          });

          if (row.full_name || row.nombre) {
            parsed.push({
              full_name: row.full_name || row.nombre || '',
              unit_number: row.unit_number || row.unidad || row.apartamento || '',
              phone: row.phone || row.telefono || '',
              email: row.email || row.correo || '',
              id_number: row.id_number || row.cedula || row.documento || '',
              vehicle_plate: row.vehicle_plate || row.placa || '',
              notes: row.notes || row.notas || '',
              status: row.status || 'active',
            });
          }
        }

        setRows(parsed);
        setStep('preview');
      };
      reader.readAsText(file);
    },
    [],
  );

  const reset = () => {
    setRows([]);
    setFileName('');
    setStep('upload');
    setResult(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Residentes
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecciona un archivo CSV con los residentes
            </p>
            <p className="text-xs text-muted-foreground">
              Columnas: nombre, unidad, teléfono, email, cédula, placa, notas
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button variant="outline" asChild>
                <span>Seleccionar Archivo</span>
              </Button>
            </label>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <strong>{fileName}</strong> — {rows.length} registros encontrados
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cambiar archivo
              </Button>
            </div>
            <div className="border rounded-md max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-left">Unidad</th>
                    <th className="p-2 text-left">Teléfono</th>
                    <th className="p-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{r.full_name}</td>
                      <td className="p-2">{r.unit_number}</td>
                      <td className="p-2">{r.phone || '—'}</td>
                      <td className="p-2">
                        {r.full_name && r.unit_number ? (
                          <Badge variant="outline" className="text-green-600">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Incompleto</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="p-2 text-xs text-muted-foreground text-center">
                  ... y {rows.length - 50} más
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
              <Button
                onClick={() => importMutation.mutate(rows)}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending
                  ? 'Importando...'
                  : `Importar ${rows.length} residentes`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{result.imported}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              <div>
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
              <div>
                <XCircle className="h-8 w-8 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{result.errors.length}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium mb-2">Detalle de errores:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Fila {e.row}: {e.reason}
                  </p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
