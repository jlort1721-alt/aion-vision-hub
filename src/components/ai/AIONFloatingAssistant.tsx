import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bot, Send, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

// ── Page-specific quick action chips ─────────────────────────

const QUICK_ACTIONS: Record<string, string[]> = {
  '/dashboard': ['¿Cuántos dispositivos están offline?', '¿Hay alertas críticas?', 'Genera resumen del turno'],
  '/devices': ['Muestra dispositivos offline', 'Reinicia dispositivo más antiguo offline', '¿Cuántas cámaras hay?'],
  '/events': ['Reconoce todos los eventos informativos', 'Muestra solo eventos críticos', 'Crea incidente del último evento'],
  '/access-control': ['Busca residente por nombre', 'Busca placa de vehículo', 'Abre puerta principal'],
  '/alerts': ['Muestra alertas sin reconocer', 'Reconoce alertas informativas', '¿Cuántas alertas activas hay?'],
  '/incidents': ['Muestra incidentes abiertos', 'Genera resumen del último incidente', 'Cierra incidentes resueltos'],
  '/domotics': ['Lista dispositivos eWeLink', 'Activa sirena de prueba', 'Estado de todas las puertas'],
  '/shifts': ['¿Quién está de turno?', 'Muestra turnos de esta semana', '¿Hay turnos sin cubrir?'],
  '/patrols': ['¿Las patrullas están al día?', 'Muestra checkpoints perdidos', 'Compliance de hoy'],
  '/emergency': ['Lista protocolos de emergencia', 'Contactos de emergencia', 'Activa protocolo de incendio'],
  '/visitors': ['Registrar visitante', 'Buscar visitante', 'Visitantes de hoy'],
  '/sla': ['Compliance de SLA actual', '¿Hay SLA en riesgo?', 'Brechas de esta semana'],
  '/live-view': ['Muestra cámaras offline', 'Cambiar a otra sede', 'Tomar snapshot'],
  '/automation': ['Reglas activas', 'Historial de ejecuciones', 'Desactivar automatización'],
  '/contracts': ['Contratos por vencer', 'Resumen de ingresos', 'Contratos vencidos'],
  '/keys': ['Llaves disponibles', '¿Quién tiene la llave maestra?', 'Historial de préstamos'],
  '/reports': ['Generar reporte diario', 'Reportes pendientes', 'Último reporte generado'],
  '/compliance': ['Estado de cumplimiento', 'Auditorías pendientes', 'Políticas de retención'],
  '/training': ['Certificaciones por vencer', 'Programas activos', 'Estado de capacitación'],
};

const STORAGE_KEY = 'aion-assistant-open';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AIONFloatingAssistant() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const pagePath = '/' + (location.pathname.split('/')[1] || 'dashboard');
  const quickActions = QUICK_ACTIONS[pagePath] || QUICK_ACTIONS['/dashboard'] || [];

  // Persist open/closed state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // localStorage unavailable
    }
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setMessage('');
    setLoading(true);

    try {
      const resp = await apiClient.post<Record<string, unknown>>('/ai/chat', {
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        tools: true,
        pageContext: { page: pagePath },
      });
      const response = (resp as Record<string, unknown>)?.response as string || 'Sin respuesta';
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      toast.error('Error al comunicarse con AION');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }]);
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          aria-label="Abrir AION Assistant"
        >
          <Bot className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-primary/5">
          <h3 className="font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4" /> AION Assistant
          </h3>
          <p className="text-xs text-muted-foreground">
            Pregúntame sobre {pagePath.slice(1) || 'la plataforma'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="p-3 border-b flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors truncate max-w-[200px]"
            >
              {action}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-8">
              ¿En qué puedo ayudarte?
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm p-3 rounded-lg whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary/10 ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse">
              AION está pensando...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t flex gap-2">
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(message)}
            placeholder="Escribe un comando..."
            className="flex-1"
            disabled={loading}
          />
          <Button size="icon" variant="ghost" className="shrink-0" aria-label="Entrada de voz">
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => sendMessage(message)}
            disabled={loading || !message.trim()}
            className="shrink-0"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
