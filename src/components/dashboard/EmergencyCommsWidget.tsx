import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Phone, MessageSquare, Loader2, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export function EmergencyCommsWidget() {
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [siteName, setSiteName] = useState('');
  const [sending, setSending] = useState(false);

  const handleEmergencyCall = async () => {
    if (!phone || !siteName) return;
    setSending(true);
    try {
      await apiClient.post('/twilio/calls/emergency', {
        to: phone,
        siteName,
        alertType: 'Alerta de emergencia',
      });
      toast.success('Llamada de emergencia iniciada');
      setShowForm(false);
      setPhone('');
      setSiteName('');
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSending(false);
    }
  };

  const handleEmergencyWhatsApp = async () => {
    if (!phone || !siteName) return;
    setSending(true);
    try {
      await apiClient.post('/twilio/whatsapp/send', {
        to: phone,
        message: `🚨 ALERTA DE EMERGENCIA — ${siteName}. El centro de monitoreo ha detectado una situación que requiere atención inmediata. Responda este mensaje o llame al centro.`,
      });
      toast.success('WhatsApp de emergencia enviado');
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-red-950/30 border-red-800/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-red-400 flex items-center gap-2 text-sm">
          <AlertTriangle size={16} />
          Comunicación de Emergencia
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => setShowForm(true)}
          >
            <AlertTriangle size={16} /> Activar Alerta
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-red-300">Datos de emergencia</p>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 h-6 w-6 p-0">
                <X size={14} />
              </Button>
            </div>
            <Input
              placeholder="Número destino"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-slate-900 border-red-800 text-white text-sm"
            />
            <Input
              placeholder="Nombre de la unidad"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="bg-slate-900 border-red-800 text-white text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={sending || !phone || !siteName}
                onClick={handleEmergencyCall}
                className="flex-1 gap-1"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                Llamar
              </Button>
              <Button
                size="sm"
                disabled={sending || !phone || !siteName}
                onClick={handleEmergencyWhatsApp}
                className="flex-1 gap-1 bg-green-700 hover:bg-green-800 text-white"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                WhatsApp
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
