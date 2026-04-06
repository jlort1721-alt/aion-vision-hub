import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSites } from '@/hooks/use-api-data';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Wifi, Cloud } from 'lucide-react';

interface DeviceFormData {
  name: string;
  type: string;
  brand: string;
  model: string;
  ip_address: string;
  port: number;
  rtsp_port: number;
  onvif_port: number;
  username: string;
  password: string;
  serial_number: string;
  firmware_version: string;
  site_id: string;
  channels: number;
  notes: string;
  connection_type: string;
  cloud_serial: string;
  cloud_code: string;
  tags: string;
}

const EMPTY: DeviceFormData = {
  name: '', type: 'camera', brand: 'hikvision', model: '', ip_address: '',
  port: 80, rtsp_port: 554, onvif_port: 80, username: 'admin', password: '',
  serial_number: '', firmware_version: '', site_id: '', channels: 1, notes: '',
  connection_type: 'ip', cloud_serial: '', cloud_code: '', tags: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: any;
}

export default function DeviceFormDialog({ open, onOpenChange, device }: Props) {
  const [form, setForm] = useState<DeviceFormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState('ip');
  const { toast } = useToast();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isEdit = !!device;

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name || '',
        type: device.type || 'camera',
        brand: device.brand || 'hikvision',
        model: device.model || '',
        ip_address: device.ip_address || '',
        port: device.port || 80,
        rtsp_port: device.rtsp_port || 554,
        onvif_port: device.onvif_port || 80,
        username: device.username || 'admin',
        password: '',
        serial_number: device.serial_number || '',
        firmware_version: device.firmware_version || '',
        site_id: device.site_id || '',
        channels: device.channels || 1,
        notes: device.notes || '',
        connection_type: device.connection_type || 'ip',
        cloud_serial: device.cloud_serial || '',
        cloud_code: device.cloud_code || '',
        tags: Array.isArray(device.tags) ? device.tags.join(', ') : '',
      });
      setTab(device.connection_type === 'cloud' ? 'cloud' : 'ip');
    } else {
      setForm({ ...EMPTY, site_id: sites[0]?.id || '' });
      setTab('ip');
    }
  }, [device, open, sites]);

  const set = (key: keyof DeviceFormData, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = (): string | null => {
    if (!form.name.trim()) return 'El nombre es obligatorio';
    if (form.name.length > 100) return 'El nombre debe tener menos de 100 caracteres';
    if (!form.site_id) return 'Debe seleccionar un sitio';
    if (tab === 'ip') {
      if (!form.ip_address.trim()) return 'La dirección IP es obligatoria';
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(form.ip_address) && !form.ip_address.includes(':'))
        return 'Formato de IP inválido';
    }
    if (tab === 'cloud') {
      if (!form.cloud_serial.trim()) return 'El número de serie es obligatorio para conexión cloud';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast({ title: 'Error de validación', description: err, variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const tagsArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const payload: Record<string, any> = {
        name: form.name.trim(),
        type: form.type,
        brand: form.brand,
        model: form.model.trim(),
        ip_address: form.ip_address.trim() || null,
        port: form.port,
        rtsp_port: form.rtsp_port,
        onvif_port: form.onvif_port,
        username: form.username.trim() || null,
        serial_number: form.serial_number.trim() || null,
        firmware_version: form.firmware_version.trim() || null,
        site_id: form.site_id,
        channels: form.channels,
        notes: form.notes.trim() || null,
        connection_type: tab === 'cloud' ? 'cloud' : 'ip',
        tags: tagsArray,
        tenant_id: profile?.tenant_id || '',
      };

      // Only send password if it's non-empty (new or changed)
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      // Cloud-specific: store serial and verification code in existing columns
      if (tab === 'cloud') {
        payload.serial_number = form.cloud_serial.trim();
        // Store verification code in notes if provided
        if (form.cloud_code.trim()) {
          const codeNote = `[Código verificación: ${form.cloud_code.trim()}]`;
          payload.notes = payload.notes ? `${codeNote} ${payload.notes}` : codeNote;
        }
      }

      if (isEdit) {
        await apiClient.patch(`/devices/${device.id}`, payload);
        toast({ title: 'Dispositivo actualizado' });
      } else {
        payload.status = 'pending_configuration';
        payload.capabilities = { video: true, audio: form.type !== 'sensor', ptz: false };
        await apiClient.post('/devices', payload);
        toast({ title: 'Dispositivo agregado' });
      }
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Dispositivo' : 'Agregar Dispositivo'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="CAM-LOBBY-01" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Sitio *</Label>
              <Select value={form.site_id} onValueChange={v => set('site_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sitio" /></SelectTrigger>
                <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Cámara IP</SelectItem>
                  <SelectItem value="nvr">NVR</SelectItem>
                  <SelectItem value="dvr">DVR</SelectItem>
                  <SelectItem value="encoder">Encoder</SelectItem>
                  <SelectItem value="access_panel">Panel de Acceso</SelectItem>
                  <SelectItem value="intercom">Citófono</SelectItem>
                  <SelectItem value="sensor">Sensor</SelectItem>
                  <SelectItem value="relay">Relé / Controlador</SelectItem>
                  <SelectItem value="switch">Switch de Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Select value={form.brand} onValueChange={v => set('brand', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hikvision">Hikvision</SelectItem>
                  <SelectItem value="dahua">Dahua</SelectItem>
                  <SelectItem value="generic_onvif">ONVIF Genérico</SelectItem>
                  <SelectItem value="fanvil">Fanvil</SelectItem>
                  <SelectItem value="grandstream">Grandstream</SelectItem>
                  <SelectItem value="axis">Axis</SelectItem>
                  <SelectItem value="uniview">Uniview</SelectItem>
                  <SelectItem value="vivotek">Vivotek</SelectItem>
                  <SelectItem value="samsung">Samsung / Hanwha</SelectItem>
                  <SelectItem value="bosch">Bosch</SelectItem>
                  <SelectItem value="zkteco">ZKTeco</SelectItem>
                  <SelectItem value="sonoff">Sonoff / eWeLink</SelectItem>
                  <SelectItem value="other">Otra Marca</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="DS-2CD2386G2-I" maxLength={100} />
            </div>
          </div>

          {/* Connection Type Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="ip" className="gap-1.5"><Wifi className="h-3.5 w-3.5" /> Conexión por IP</TabsTrigger>
              <TabsTrigger value="cloud" className="gap-1.5"><Cloud className="h-3.5 w-3.5" /> Conexión Cloud / P2P</TabsTrigger>
            </TabsList>

            <TabsContent value="ip" className="space-y-3 mt-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Dirección IP *</Label>
                  <Input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="192.168.1.100" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Puerto HTTP</Label>
                  <Input type="number" value={form.port} onChange={e => set('port', +e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Puerto RTSP</Label>
                  <Input type="number" value={form.rtsp_port} onChange={e => set('rtsp_port', +e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Puerto ONVIF</Label>
                  <Input type="number" value={form.onvif_port} onChange={e => set('onvif_port', +e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cloud" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Para dispositivos Hik-Connect, DMSS (Dahua), o similares. Ingrese el número de serie del dispositivo y el código de verificación.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número de Serie *</Label>
                  <Input value={form.cloud_serial} onChange={e => set('cloud_serial', e.target.value)} placeholder="DS-2CD2386G2I20210101AAWRG12345678" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Código de Verificación</Label>
                  <Input value={form.cloud_code} onChange={e => set('cloud_code', e.target.value)} placeholder="ABCDEF" className="font-mono text-xs uppercase" maxLength={12} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>IP (opcional si tiene acceso LAN)</Label>
                  <Input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="192.168.1.100" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Puerto RTSP</Label>
                  <Input type="number" value={form.rtsp_port} onChange={e => set('rtsp_port', +e.target.value)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input value={form.username} onChange={e => set('username', e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña {isEdit && <span className="text-xs text-muted-foreground">(dejar vacío para no cambiar)</span>}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={isEdit ? '••••••••' : 'Contraseña del dispositivo'}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Número de Serie</Label>
              <Input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="SN del equipo" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Firmware</Label>
              <Input value={form.firmware_version} onChange={e => set('firmware_version', e.target.value)} placeholder="V5.7.21" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Canales</Label>
              <Input type="number" value={form.channels} onChange={e => set('channels', +e.target.value)} min={1} max={128} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Etiquetas <span className="text-xs text-muted-foreground">(separadas por coma)</span></Label>
            <Input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="exterior, lobby, perimetral, alta-resolución" />
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas operativas del dispositivo..." rows={2} maxLength={500} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Agregar Dispositivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
