import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSites } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface DeviceFormData {
  name: string;
  type: string;
  brand: string;
  model: string;
  ip_address: string;
  port: number;
  rtsp_port: number;
  onvif_port: number;
  site_id: string;
  channels: number;
  notes: string;
}

const EMPTY: DeviceFormData = {
  name: '', type: 'camera', brand: 'hikvision', model: '', ip_address: '',
  port: 80, rtsp_port: 554, onvif_port: 80, site_id: '', channels: 1, notes: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: any; // edit mode
}

export default function DeviceFormDialog({ open, onOpenChange, device }: Props) {
  const [form, setForm] = useState<DeviceFormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isEdit = !!device;

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name, type: device.type, brand: device.brand, model: device.model || '',
        ip_address: device.ip_address, port: device.port, rtsp_port: device.rtsp_port || 554,
        onvif_port: device.onvif_port || 80, site_id: device.site_id, channels: device.channels,
        notes: device.notes || '',
      });
    } else {
      setForm({ ...EMPTY, site_id: sites[0]?.id || '' });
    }
  }, [device, open, sites]);

  const set = (key: keyof DeviceFormData, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required';
    if (form.name.length > 100) return 'Name must be under 100 characters';
    if (!form.ip_address.trim()) return 'IP address is required';
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(form.ip_address)) return 'Invalid IP address format';
    if (!form.site_id) return 'Site is required';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast({ title: 'Validation Error', description: err, variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), type: form.type, brand: form.brand, model: form.model.trim(),
        ip_address: form.ip_address.trim(), port: form.port, rtsp_port: form.rtsp_port,
        onvif_port: form.onvif_port, site_id: form.site_id, channels: form.channels,
        notes: form.notes.trim() || null, tenant_id: profile?.tenant_id || '',
      };

      if (isEdit) {
        const { error } = await supabase.from('devices').update(payload).eq('id', device.id);
        if (error) throw error;
        toast({ title: 'Device updated' });
      } else {
        const { error } = await supabase.from('devices').insert(payload);
        if (error) throw error;
        toast({ title: 'Device added' });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Device' : 'Add Device'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="CAM-LOBBY-01" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Site *</Label>
              <Select value={form.site_id} onValueChange={v => set('site_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="nvr">NVR</SelectItem>
                  <SelectItem value="dvr">DVR</SelectItem>
                  <SelectItem value="encoder">Encoder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={form.brand} onValueChange={v => set('brand', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hikvision">Hikvision</SelectItem>
                  <SelectItem value="dahua">Dahua</SelectItem>
                  <SelectItem value="generic_onvif">ONVIF Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="DS-2CD2386G2" maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>IP Address *</Label>
              <Input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="192.168.1.100" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={e => set('port', +e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>RTSP Port</Label>
              <Input type="number" value={form.rtsp_port} onChange={e => set('rtsp_port', +e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Channels</Label>
              <Input type="number" value={form.channels} onChange={e => set('channels', +e.target.value)} min={1} max={128} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." rows={2} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Add Device'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
