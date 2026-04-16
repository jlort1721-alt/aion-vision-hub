import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Volume2, AlertTriangle, Clock, Send, Megaphone, Loader2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PagingZone {
  id: string;
  name: string;
  siteName: string;
  isOnline: boolean;
}

interface BroadcastRecord {
  id: string;
  message: string;
  createdAt: string;
  status: string;
  zones: string[];
}

interface PagingTemplate {
  id: string;
  name: string;
  message: string;
  category: string;
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  failed: 'Fallido',
  pending: 'Pendiente',
};

const STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  sent: 'default',
  delivered: 'default',
  failed: 'destructive',
  pending: 'secondary',
};

export default function CentralVoicePage() {
  const [message, setMessage] = useState('');
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: zones = [] } = useQuery<PagingZone[]>({
    queryKey: ['paging', 'zones'],
    queryFn: () => apiClient.get('/paging/zones'),
  });

  const { data: history = [] } = useQuery<BroadcastRecord[]>({
    queryKey: ['paging', 'history'],
    queryFn: () => apiClient.get('/paging/history'),
  });

  const { data: templates = [] } = useQuery<PagingTemplate[]>({
    queryKey: ['paging', 'templates'],
    queryFn: () => apiClient.get('/paging/templates'),
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: { message: string; zoneIds: string[] }) =>
      apiClient.post('/paging/broadcast', data),
    onSuccess: () => {
      toast.success('Mensaje transmitido correctamente');
      setMessage('');
      setSelectedSites([]);
      queryClient.invalidateQueries({ queryKey: ['paging', 'history'] });
    },
    onError: () => {
      toast.error('Error al transmitir el mensaje');
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: () => apiClient.post('/paging/emergency-broadcast', { zoneIds: selectedSites }),
    onSuccess: () => {
      toast.success('Transmisi\u00f3n de emergencia enviada');
      setEmergencyOpen(false);
      queryClient.invalidateQueries({ queryKey: ['paging', 'history'] });
    },
    onError: () => {
      toast.error('Error en la transmisi\u00f3n de emergencia');
    },
  });

  const toggleSite = (zoneId: string) => {
    setSelectedSites((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const toggleAll = () => {
    if (selectedSites.length === zones.length) {
      setSelectedSites([]);
    } else {
      setSelectedSites(zones.map((z) => z.id));
    }
  };

  const handleBroadcast = () => {
    if (!message.trim()) {
      toast.error('El mensaje no puede estar vac\u00edo');
      return;
    }
    if (selectedSites.length === 0) {
      toast.error('Selecciona al menos un destino');
      return;
    }
    broadcastMutation.mutate({ message, zoneIds: selectedSites });
  };

  const handleTemplateSend = (template: PagingTemplate) => {
    if (selectedSites.length === 0) {
      toast.error('Selecciona al menos un destino');
      return;
    }
    broadcastMutation.mutate({ message: template.message, zoneIds: selectedSites });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Central de Voz</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Destinations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Volume2 className="h-4 w-4" />Destinos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={zones.length > 0 && selectedSites.length === zones.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Seleccionar todos
              </label>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {zones.map((zone) => (
                <div key={zone.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSites.includes(zone.id)}
                    onCheckedChange={() => toggleSite(zone.id)}
                    id={`zone-${zone.id}`}
                  />
                  <label htmlFor={`zone-${zone.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${zone.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                    />
                    {zone.name}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSites.length} de {zones.length} seleccionados
            </p>
          </CardContent>
        </Card>

        {/* Center: Message / Templates */}
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">Mensaje de Texto</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1">Plantillas R&aacute;pidas</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 pt-4">
                <Textarea
                  placeholder="Escriba el mensaje a transmitir..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                />
                <Button
                  onClick={handleBroadcast}
                  disabled={broadcastMutation.isPending}
                  className="w-full"
                >
                  {broadcastMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Transmitir
                </Button>
              </TabsContent>

              <TabsContent value="templates" className="pt-4">
                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin plantillas disponibles</p>
                  ) : (
                    templates.map((tpl) => (
                      <Card
                        key={tpl.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleTemplateSend(tpl)}
                      >
                        <CardContent className="p-3">
                          <p className="text-sm font-medium">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {tpl.message}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right: History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />Historial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin transmisiones recientes</p>
              ) : (
                history.map((record) => (
                  <div key={record.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString('es-CO')}
                      </span>
                      <Badge variant={STATUS_VARIANTS[record.status] ?? 'secondary'}>
                        {STATUS_LABELS[record.status] ?? record.status}
                      </Badge>
                    </div>
                    <p className="text-sm line-clamp-2">{record.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.zones.length} zona(s)
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          variant="destructive"
          size="lg"
          className="shadow-lg"
          onClick={() => setEmergencyOpen(true)}
        >
          <AlertTriangle className="mr-2 h-5 w-5" />
          EMERGENCIA
        </Button>
      </div>

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Transmisi&oacute;n de Emergencia
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acci&oacute;n enviar&aacute; una alerta de emergencia a{' '}
            {selectedSites.length > 0 ? `${selectedSites.length} zona(s) seleccionada(s)` : 'todas las zonas'}.
            &iquest;Est&aacute; seguro de continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => emergencyMutation.mutate()}
              disabled={emergencyMutation.isPending}
            >
              {emergencyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar Emergencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
