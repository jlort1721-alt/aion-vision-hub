import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bot, Send, Mic, Plus, Volume2, VolumeX } from 'lucide-react';
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

interface AIConversation {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string | null;
  messages: ChatMessage[];
  tools_used: string[];
  token_count: number;
  created_at: string;
  updated_at: string;
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
  const [listening, setListening] = useState(false);
  const [unreadCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('aion-auto-speak') === 'true';
    } catch {
      return false;
    }
  });
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

  // ── Conversation Persistence ─────────────────────────────────
  // Load latest conversation on mount
  useEffect(() => {
    const loadLatestConversation = async () => {
      try {
        const convos = await apiClient.get<AIConversation[]>('/ai/conversations', { limit: 1 });
        if (convos && convos.length > 0) {
          const convo = convos[0];
          setConversationId(convo.id);
          if (convo.messages && convo.messages.length > 0) {
            setMessages(convo.messages);
          }
        }
      } catch {
        // Conversation loading is best-effort; silently ignore errors
      }
    };
    loadLatestConversation();
  }, []);

  // Save messages to the current conversation after each exchange
  const saveConversation = useCallback(async (msgs: ChatMessage[]) => {
    try {
      if (conversationId) {
        await apiClient.patch(`/ai/conversations/${conversationId}`, { messages: msgs });
      } else {
        // Create a new conversation with the first user message as title
        const firstUserMsg = msgs.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.content.slice(0, 100) : 'Nueva conversación';
        const convo = await apiClient.post<AIConversation>('/ai/conversations', {
          title,
          messages: msgs,
        });
        if (convo?.id) {
          setConversationId(convo.id);
        }
      }
    } catch {
      // Saving is best-effort
    }
  }, [conversationId]);

  // ── Voice Recognition ────────────────────────────────────────
  const startVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (win.SpeechRecognition || win.webkitSpeechRecognition) as any;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-CO'; // Spanish Colombia
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setListening(true);
    recognition.start();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const text: string = event.results[0][0].transcript;
      setMessage(text);
      sendMessage(text); // Auto-send the voice command
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
      toast.error('Error en reconocimiento de voz');
    };

    recognition.onend = () => setListening(false);
  };

  // ── Text-to-Speech (TTS) — ElevenLabs (backend) with browser fallback ──
  const speakResponse = useCallback(async (text: string) => {
    // Try ElevenLabs TTS via backend first (higher quality Spanish voice)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/voice/health`);
      if (res.ok) {
        const health = await res.json();
        if (health?.data?.available) {
          const synthRes = await fetch(`${apiUrl}/voice/agent/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice_id: health.data?.voiceId }),
          });
          if (synthRes.ok) {
            const blob = await synthRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            await audio.play();
            return;
          }
        }
      }
    } catch {
      // ElevenLabs unavailable, fall through to browser TTS
    }

    // Fallback: Browser SpeechSynthesis
    if (!('speechSynthesis' in window)) {
      toast.error('TTS no disponible');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => (v.lang || '').startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Persist auto-speak preference
  useEffect(() => {
    try {
      localStorage.setItem('aion-auto-speak', String(autoSpeak));
    } catch {
      // localStorage unavailable
    }
  }, [autoSpeak]);

  // ── New Conversation ─────────────────────────────────────────
  const startNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setMessage('');
    try {
      const convo = await apiClient.post<AIConversation>('/ai/conversations', {
        title: 'Nueva conversación',
        messages: [],
      });
      if (convo?.id) {
        setConversationId(convo.id);
      }
    } catch {
      // Best-effort
    }
  };

  // ── Send Message ─────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setMessage('');
    setLoading(true);

    try {
      const resp = await apiClient.post<Record<string, unknown>>('/ai/chat', {
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        tools: true,
        pageContext: { page: pagePath },
      });
      // Backend returns { success, data: { content, ... } } — extract content
      const data = (resp as any)?.data ?? resp;
      const response: string = (typeof data === 'string' ? data : data?.content ?? data?.response ?? 'Sin respuesta');
      const allMessages = [...updatedMessages, { role: 'assistant' as const, content: response }];
      setMessages(allMessages);
      // Auto-speak new AI response if enabled
      if (autoSpeak) {
        speakResponse(response);
      }
      // Persist after successful exchange
      await saveConversation(allMessages);
    } catch {
      toast.error('Error al comunicarse con AION');
      const allMessages = [...updatedMessages, { role: 'assistant' as const, content: 'Error de conexión. Intenta de nuevo.' }];
      setMessages(allMessages);
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4" /> AION Assistant
            </h3>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={autoSpeak ? 'default' : 'outline'}
                onClick={() => setAutoSpeak(prev => !prev)}
                className="h-7 text-xs gap-1"
                aria-label={autoSpeak ? 'Desactivar lectura automática' : 'Activar lectura automática'}
                title={autoSpeak ? 'Auto-lectura activada' : 'Auto-lectura desactivada'}
              >
                {autoSpeak ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={startNewConversation}
                className="h-7 text-xs gap-1"
                aria-label="Nueva conversación"
              >
                <Plus className="h-3 w-3" />
                Nueva
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pregúntame sobre {pagePath.slice(1) || 'la plataforma'}
          </p>
        </div>

        {/* Voice listening indicator */}
        {listening && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Escuchando...
            </span>
          </div>
        )}

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
              {m.role === 'assistant' && (
                <button
                  onClick={() => speakResponse(m.content)}
                  className="mt-1 text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Volume2 className="h-3 w-3 inline" /> Escuchar
                </button>
              )}
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
          <Button
            size="icon"
            variant="ghost"
            onClick={startVoiceInput}
            className={`shrink-0 ${listening ? 'text-red-500 animate-pulse' : ''}`}
            aria-label="Entrada de voz"
          >
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
