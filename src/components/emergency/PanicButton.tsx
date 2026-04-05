import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
}

export default function PanicButton() {
  const { hasAnyRole, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(false);

  // Only visible for operator, supervisor, super_admin
  const canSee = isAuthenticated && hasAnyRole(['operator', 'supervisor', 'super_admin']);

  // Fetch sites for the dropdown
  const { data: sites = [] } = useQuery({
    queryKey: ['panic-sites'],
    queryFn: async () => {
      const resp = await apiClient.get<Site[] | { items?: Site[]; data?: Site[] }>('/sites');
      if (Array.isArray(resp)) return resp;
      return resp?.items ?? resp?.data ?? [];
    },
    enabled: canSee,
    staleTime: 60_000,
  });

  if (!canSee) return null;

  const handleActivate = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      await apiClient.post('/emergency/panic', { site_id: siteId });
      toast.success('Protocolo de panico activado');
      setOpen(false);
      setSiteId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al activar protocolo de panico';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-background animate-pulse"
        aria-label="Boton de panico"
      >
        <ShieldAlert className="h-6 w-6" />
      </button>

      {/* Confirmation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border-destructive/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              ACTIVAR PANICO
            </DialogTitle>
            <DialogDescription className="text-sm">
              Esto activara TODAS las sirenas, notificara al supervisor y llamara al 123. Esta seguro?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Seleccionar sede <Badge variant="destructive" className="ml-1 text-[10px]">Requerido</Badge>
            </label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una sede..." />
              </SelectTrigger>
              <SelectContent>
                {(sites as Site[]).map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setOpen(false); setSiteId(''); }}
              disabled={loading}
            >
              CANCELAR
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="font-bold"
              onClick={handleActivate}
              disabled={!siteId || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activando...
                </>
              ) : (
                'ACTIVAR PANICO'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
