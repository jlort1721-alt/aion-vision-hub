import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MessageSquare, Phone, MessageCircle, History,
  Send, PhoneCall, PhoneOff, Loader2, AlertTriangle,
  DollarSign
} from 'lucide-react';
import { useTwilioPhone } from '@/hooks/use-twilio-phone';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface CommLog {
  id: string;
  channel: string;
  direction: string;
  recipient: string;
  sender: string;
  content: string;
  status: string;
  createdAt: string;
  durationSeconds?: number;
  recordingUrl?: string;
  costEstimate?: string;
  siteName?: string;
  operator?: string;
}

interface CommStats {
  total_messages: number;
  whatsapp_sent: number;
  whatsapp_received: number;
  calls_made: number;
  sms_sent: number;
  failed: number;
  total_cost_usd: number;
  today: number;
  this_month: number;
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CommStats | null>(null);
  const [activeTab, setActiveTab] = useState('whatsapp');

  // Fetch stats via useQuery instead of raw useEffect
  const { data: fetchedStats } = useQuery({
    queryKey: ['twilio-stats'],
    queryFn: () => apiClient.get<CommStats>('/twilio/stats'),
    refetchInterval: 30000,
  });
  useEffect(() => { if (fetchedStats) setStats(fetchedStats); }, [fetchedStats]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicaciones</h1>
          <p className="text-sm text-muted-foreground">WhatsApp, llamadas y SMS via Twilio</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<MessageSquare size={20} />} label="WhatsApp hoy" value={stats.today} color="text-green-400" />
          <StatCard icon={<Phone size={20} />} label="Llamadas" value={stats.calls_made} color="text-blue-400" />
          <StatCard icon={<MessageCircle size={20} />} label="SMS enviados" value={stats.sms_sent} color="text-purple-400" />
          <StatCard icon={<DollarSign size={20} />} label="Costo mes (USD)" value={`$${Number(stats.total_cost_usd || 0).toFixed(2)}`} color="text-yellow-400" />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare size={16} /> WhatsApp</TabsTrigger>
          <TabsTrigger value="calls" className="gap-2"><Phone size={16} /> Llamadas</TabsTrigger>
          <TabsTrigger value="sms" className="gap-2"><MessageCircle size={16} /> SMS</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History size={16} /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
        <TabsContent value="calls"><CallsTab identity={user?.email || 'operator'} /></TabsContent>
        <TabsContent value="sms"><SmsTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Stat Card
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// WhatsApp Tab
// ══════════════════════════════════════════════════════════════

function WhatsAppTab() {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !message) return;
    setSending(true);
    try {
      await apiClient.post('/twilio/whatsapp/send', { to, message });
      toast.success('WhatsApp enviado');
      setMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Error enviando WhatsApp');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <MessageSquare size={20} className="text-green-400" />
          Enviar WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Número destino</label>
          <Input
            placeholder="3001234567"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-background border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground/70 mt-1">Se agrega +57 automáticamente</p>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Mensaje</label>
          <textarea
            placeholder="Escribe tu mensaje..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-background border border-border text-foreground p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !to || !message}
          className="bg-green-600 hover:bg-green-700 text-foreground gap-2"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Enviar WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// Calls Tab
// ══════════════════════════════════════════════════════════════

function CallsTab({ identity }: { identity: string }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const { status, callDuration, makeCall, hangUp, isReady, error } = useTwilioPhone(identity);
  const [apiCalling, setApiCalling] = useState(false);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDialPad = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleCall = async () => {
    if (!phoneNumber) return;
    if (isReady) {
      await makeCall(phoneNumber);
    } else {
      // Fallback: API call (server-initiated)
      setApiCalling(true);
      try {
        await apiClient.post('/twilio/calls/make', { to: phoneNumber });
        toast.success('Llamada iniciada desde el servidor');
      } catch (err: any) {
        toast.error(err.message || 'Error haciendo llamada');
      } finally {
        setApiCalling(false);
      }
    }
  };

  const dialPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Phone size={20} className="text-blue-400" />
          Teléfono
          {isReady && <Badge variant="outline" className="text-green-400 border-green-400 text-xs ml-2">WebRTC Listo</Badge>}
          {error && <Badge variant="destructive" className="text-xs ml-2">{error}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-sm mx-auto">
        {/* Number Display */}
        <div className="text-center">
          <Input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+57 3XX XXX XXXX"
            className="bg-background border-border text-foreground text-center text-xl font-mono tracking-wider"
          />
          {status !== 'idle' && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge className={status === 'in-call' ? 'bg-green-600' : 'bg-yellow-600'}>
                {status === 'connecting' && 'Conectando...'}
                {status === 'ringing' && 'Timbrando...'}
                {status === 'in-call' && `En llamada ${formatDuration(callDuration)}`}
              </Badge>
            </div>
          )}
        </div>

        {/* Dial Pad */}
        <div className="grid grid-cols-3 gap-2">
          {dialPadKeys.map((key) => (
            <Button
              key={key}
              variant="outline"
              onClick={() => handleDialPad(key)}
              className="h-14 text-xl font-semibold bg-background border-border text-foreground hover:bg-muted"
            >
              {key}
            </Button>
          ))}
        </div>

        {/* Call / Hang Up */}
        <div className="flex gap-3 justify-center">
          {status === 'idle' ? (
            <Button
              onClick={handleCall}
              disabled={!phoneNumber || apiCalling}
              className="bg-green-600 hover:bg-green-700 text-foreground gap-2 h-14 px-8 text-lg"
            >
              {apiCalling ? <Loader2 size={20} className="animate-spin" /> : <PhoneCall size={20} />}
              Llamar
            </Button>
          ) : (
            <Button
              onClick={hangUp}
              className="bg-red-600 hover:bg-red-700 text-foreground gap-2 h-14 px-8 text-lg"
            >
              <PhoneOff size={20} /> Colgar
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setPhoneNumber('')}
            className="border-border text-muted-foreground h-14"
          >
            Borrar
          </Button>
        </div>

        {/* Emergency Call */}
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={async () => {
            if (!phoneNumber) {
              toast.error('Ingresa un número');
              return;
            }
            try {
              await apiClient.post('/twilio/calls/emergency', {
                to: phoneNumber,
                siteName: 'Central AION',
                alertType: 'Emergencia manual',
              });
              toast.success('Llamada de emergencia iniciada');
            } catch (err: any) {
              toast.error(err.message || 'Error');
            }
          }}
        >
          <AlertTriangle size={16} /> Llamada de Emergencia
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// SMS Tab
// ══════════════════════════════════════════════════════════════

function SmsTab() {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !message) return;
    setSending(true);
    try {
      await apiClient.post('/twilio/sms/send', { to, message });
      toast.success('SMS enviado');
      setMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Error enviando SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <MessageCircle size={20} className="text-purple-400" />
          Enviar SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Número destino</label>
          <Input
            placeholder="3001234567"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-background border-border text-foreground"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Mensaje (max 1600 caracteres)</label>
          <textarea
            placeholder="Escribe tu mensaje..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1600}
            className="w-full rounded-md bg-background border border-border text-foreground p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-muted-foreground/70 mt-1">{message.length}/1600 caracteres</p>
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !to || !message}
          className="bg-purple-600 hover:bg-purple-700 text-foreground gap-2"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Enviar SMS
        </Button>
        <p className="text-xs text-muted-foreground/70">Los SMS se envían desde el número US +14782238507 (el número colombiano no tiene SMS).</p>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// History Tab
// ══════════════════════════════════════════════════════════════

function HistoryTab() {
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 30 };
      if (filter) params.channel = filter;
      const res = await apiClient.get<{ data: CommLog[]; total: number }>('/twilio/logs', params);
      setLogs(res.data);
      setTotal(res.total);
    } catch {
      toast.error('Error cargando historial');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const channelIcon = (ch: string) => {
    switch (ch) {
      case 'whatsapp': return <MessageSquare size={14} className="text-green-400" />;
      case 'sms': return <MessageCircle size={14} className="text-purple-400" />;
      case 'voice_call': return <Phone size={14} className="text-blue-400" />;
      case 'emergency_call': return <AlertTriangle size={14} className="text-red-400" />;
      default: return <MessageSquare size={14} />;
    }
  };

  const statusColor = (s: string) => {
    if (['sent', 'delivered', 'completed'].includes(s)) return 'text-green-400';
    if (s === 'failed') return 'text-red-400';
    if (['initiated', 'ringing', 'queued'].includes(s)) return 'text-yellow-400';
    return 'text-muted-foreground';
  };
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      sent: 'Enviado', delivered: 'Entregado', completed: 'Completado',
      failed: 'Fallido', initiated: 'Iniciado', ringing: 'Timbrando',
      queued: 'En cola', received: 'Recibido',
    };
    return map[s] || s;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <History size={20} /> Historial de Comunicaciones
          </CardTitle>
          <div className="flex gap-2">
            {['', 'whatsapp', 'sms', 'voice_call'].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => { setFilter(f); setPage(1); }}
                className={filter === f ? 'bg-blue-600' : 'border-border text-muted-foreground'}
              >
                {f === '' ? 'Todos' : f === 'whatsapp' ? 'WhatsApp' : f === 'sms' ? 'SMS' : 'Llamadas'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground/70 py-8">No hay registros</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-3">Canal</th>
                    <th className="text-left py-2 px-3">Destinatario</th>
                    <th className="text-left py-2 px-3">Mensaje</th>
                    <th className="text-left py-2 px-3">Estado</th>
                    <th className="text-left py-2 px-3">Fecha</th>
                    <th className="text-left py-2 px-3">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-3 flex items-center gap-2">
                        {channelIcon(log.channel)}
                        <span className="text-foreground text-xs">{log.direction === 'inbound' ? '← ' : '→ '}</span>
                      </td>
                      <td className="py-2 px-3 text-foreground font-mono text-xs">{log.recipient || log.sender}</td>
                      <td className="py-2 px-3 text-foreground/80 max-w-[200px] truncate">{log.content}</td>
                      <td className={`py-2 px-3 font-medium ${statusColor(log.status)}`}>{statusLabel(log.status)}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {log.costEstimate ? `$${Number(log.costEstimate).toFixed(3)}` : '-'}
                        {log.durationSeconds ? ` (${log.durationSeconds}s)` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <p className="text-xs text-muted-foreground/70">{total} registros</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-border text-muted-foreground">Anterior</Button>
                <Button size="sm" variant="outline" disabled={page * 30 >= total} onClick={() => setPage(page + 1)} className="border-border text-muted-foreground">Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
