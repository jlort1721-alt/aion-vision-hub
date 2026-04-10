import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Play, Plus, Trash2, Zap, Moon, AlertTriangle, Sun, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Scene {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

interface SceneExecution {
  id: string;
  sceneId: string;
  sceneName: string;
  executedAt: string;
  status: string;
}

const SCENE_ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  moon: Moon,
  zap: Zap,
  alert: AlertTriangle,
};

const ICON_OPTIONS = [
  { value: 'sun', label: 'Sol' },
  { value: 'moon', label: 'Luna' },
  { value: 'zap', label: 'Rayo' },
  { value: 'alert', label: 'Alerta' },
];

export default function ScenesPanel() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState('zap');

  const { data: scenes = [], isLoading } = useQuery<Scene[]>({
    queryKey: ['scenes'],
    queryFn: () => apiClient.get('/scenes'),
  });

  const { data: executions = [] } = useQuery<SceneExecution[]>({
    queryKey: ['scenes', 'executions'],
    queryFn: () => apiClient.get('/scenes/executions', { limit: 10 }),
  });

  const executeMutation = useMutation({
    mutationFn: (sceneId: string) => apiClient.post(`/scenes/${sceneId}/execute`),
    onSuccess: () => {
      toast.success('Escena ejecutada correctamente');
      queryClient.invalidateQueries({ queryKey: ['scenes'] });
      queryClient.invalidateQueries({ queryKey: ['scenes', 'executions'] });
    },
    onError: () => {
      toast.error('Error al ejecutar la escena');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; icon: string }) =>
      apiClient.post('/scenes', data),
    onSuccess: () => {
      toast.success('Escena creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['scenes'] });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setNewIcon('zap');
    },
    onError: () => {
      toast.error('Error al crear la escena');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sceneId: string) => apiClient.delete(`/scenes/${sceneId}`),
    onSuccess: () => {
      toast.success('Escena eliminada');
      queryClient.invalidateQueries({ queryKey: ['scenes'] });
    },
    onError: () => {
      toast.error('Error al eliminar la escena');
    },
  });

  const isEmergencyScene = (scene: Scene) =>
    scene.isActive && scene.name.toLowerCase().includes('evacuaci');

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    createMutation.mutate({ name: newName, description: newDescription, icon: newIcon });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Escenas</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nueva Escena</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Escena</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nombre de la escena"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Textarea
                placeholder="Descripci&oacute;n (opcional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <Select value={newIcon} onValueChange={setNewIcon}>
                <SelectTrigger><SelectValue placeholder="Icono" /></SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((scene) => {
            const IconComp = SCENE_ICONS[scene.icon] ?? Zap;
            return (
              <Card
                key={scene.id}
                className={isEmergencyScene(scene) ? 'border-red-500 border-2' : ''}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <IconComp className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{scene.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(scene.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{scene.description}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isEmergencyScene(scene) ? 'destructive' : 'default'}
                    disabled={executeMutation.isPending}
                    onClick={() => executeMutation.mutate(scene.id)}
                  >
                    <Play className="mr-2 h-4 w-4" />Ejecutar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />Historial de Ejecuciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ejecuciones recientes</p>
          ) : (
            <ul className="space-y-2">
              {executions.map((exec) => (
                <li key={exec.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{exec.sceneName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={exec.status === 'success' ? 'default' : 'destructive'}>
                      {exec.status === 'success' ? 'Exitoso' : 'Fallido'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(exec.executedAt).toLocaleString('es-CO')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
