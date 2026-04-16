import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Play, Clock,
  ChevronLeft, ChevronRight, Users, Bot, Loader2,
} from 'lucide-react';

interface CallSession {
  id: string;
  direction: string;
  deviceName: string;
  visitorName: string;
  mode: string;
  status: string;
  duration: number;
  attendedBy: string;
  accessGranted: boolean;
  createdAt: string;
  recordingUrl?: string;
  conversationLog?: string;
}

interface CallStats {
  total: number;
  avgDuration: number;
  aiPercentage: number;
  humanPercentage: number;
  missedCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  missed: 'bg-red-500',
  failed: 'bg-gray-500',
  in_progress: 'bg-blue-500',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  missed: 'Perdida',
  failed: 'Fallida',
  in_progress: 'En curso',
};

const MODE_LABELS: Record<string, string> = {
  ai: 'IA',
  human: 'Humano',
  mixed: 'Mixto',
};

const MODE_ICONS: Record<string, typeof Bot> = {
  ai: Bot,
  human: Users,
  mixed: Users,
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CallLogPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState<CallSession | null>(null);
  const limit = 20;

  const queryParams: Record<string, string | number> = { page, limit };
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (modeFilter !== 'all') queryParams.mode = modeFilter;

  const { data, isLoading } = useQuery<{ data: CallSession[]; meta?: { total?: number } }>({
    queryKey: ['intercom', 'sessions', page, statusFilter, modeFilter],
    queryFn: () => apiClient.get('/intercom/sessions', queryParams),
  });

  const { data: stats } = useQuery<CallStats>({
    queryKey: ['intercom', 'stats'],
    queryFn: () => apiClient.get('/intercom/sessions/stats'),
  });

  const calls = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const statCards = [
    { label: 'Total llamadas', value: stats?.total ?? '--', icon: Phone },
    { label: 'Duraci\u00f3n promedio', value: stats ? formatDuration(stats.avgDuration) : '--', icon: Clock },
    { label: 'Atendidas por IA', value: stats ? `${stats.aiPercentage}%` : '--', icon: Bot },
    { label: 'Atendidas por humano', value: stats ? `${stats.humanPercentage}%` : '--', icon: Users },
    { label: 'Perdidas', value: stats?.missedCount ?? '--', icon: Phone },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Phone className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Registro de Llamadas</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const IconComp = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <IconComp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="missed">Perdida</SelectItem>
            <SelectItem value="failed">Fallida</SelectItem>
            <SelectItem value="in_progress">En curso</SelectItem>
          </SelectContent>
        </Select>

        <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los modos</SelectItem>
            <SelectItem value="ai">IA</SelectItem>
            <SelectItem value="human">Humano</SelectItem>
            <SelectItem value="mixed">Mixto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Phone className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin llamadas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Direcci&oacute;n</th>
                    <th className="px-4 py-3 text-left font-medium">Dispositivo</th>
                    <th className="px-4 py-3 text-left font-medium">Visitante</th>
                    <th className="px-4 py-3 text-left font-medium">Modo</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-left font-medium">Duraci&oacute;n</th>
                    <th className="px-4 py-3 text-left font-medium">Atendida por</th>
                    <th className="px-4 py-3 text-left font-medium">Acceso</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calls.map((call) => {
                    const DirIcon = call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
                    const ModeIcon = MODE_ICONS[call.mode] ?? Users;
                    return (
                      <tr
                        key={call.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedCall(call)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="gap-1">
                            <DirIcon className="h-3 w-3" />
                            {call.direction === 'incoming' ? 'Entrante' : 'Saliente'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{call.deviceName}</td>
                        <td className="px-4 py-3">{call.visitorName || '---'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="gap-1">
                            <ModeIcon className="h-3 w-3" />
                            {MODE_LABELS[call.mode] ?? call.mode}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${STATUS_COLORS[call.status] ?? 'bg-gray-500'} text-white`}>
                            {STATUS_LABELS[call.status] ?? call.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{formatDuration(call.duration)}</td>
                        <td className="px-4 py-3">{call.attendedBy || '---'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={call.accessGranted ? 'default' : 'outline'}>
                            {call.accessGranted ? 'Concedido' : 'Denegado'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          P&aacute;gina {page} de {totalPages} &middot; {total} registros
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />Anterior
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Call detail dialog */}
      <Dialog open={selectedCall !== null} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Llamada</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {new Date(selectedCall.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duraci&oacute;n</p>
                  <p className="font-medium">{formatDuration(selectedCall.duration)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dispositivo</p>
                  <p className="font-medium">{selectedCall.deviceName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Visitante</p>
                  <p className="font-medium">{selectedCall.visitorName || '---'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modo</p>
                  <p className="font-medium">{MODE_LABELS[selectedCall.mode] ?? selectedCall.mode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Atendida por</p>
                  <p className="font-medium">{selectedCall.attendedBy || '---'}</p>
                </div>
              </div>

              {selectedCall.recordingUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Grabaci&oacute;n</p>
                  <audio controls className="w-full" src={selectedCall.recordingUrl}>
                    <track kind="captions" />
                    Su navegador no soporta el elemento de audio.
                  </audio>
                </div>
              )}

              {selectedCall.conversationLog && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Transcripci&oacute;n</p>
                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedCall.conversationLog}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
