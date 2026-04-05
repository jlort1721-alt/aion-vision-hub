import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistant() {
  const [state, setState] = useState<VoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.0;
    utterance.onstart = () => setState('speaking');
    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');
    window.speechSynthesis.speak(utterance);
  }, []);

  const processWithAI = useCallback(async (transcript: string) => {
    setState('processing');
    try {
      const result = await apiClient.post<{ content: string }>('/ai/chat', {
        messages: [{ role: 'user', content: transcript }],
        enableTools: true,
      });
      const answer = result.content || 'No obtuve respuesta';
      speak(answer);
      toast.success(answer.slice(0, 100));
    } catch {
      setState('idle');
      toast.error('Error al procesar con IA');
    }
  }, [speak]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Tu navegador no soporta reconocimiento de voz. Usa Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState('listening');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setLastTranscript(transcript);
      processWithAI(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState('idle');
      if (event.error !== 'no-speech') {
        toast.error(`Error de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (state === 'listening') setState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [processWithAI, state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState('idle');
  }, []);

  const handleClick = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    } else if (state === 'speaking') {
      window.speechSynthesis.cancel();
      setState('idle');
    }
  };

  const stateConfig = {
    idle: { icon: <Mic className="h-4 w-4" />, color: 'bg-muted hover:bg-primary/20', title: 'Hablar con AION' },
    listening: { icon: <MicOff className="h-4 w-4 text-red-400" />, color: 'bg-red-500/20 border-red-500/40 animate-pulse', title: 'Escuchando...' },
    processing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'bg-blue-500/20 border-blue-500/40', title: 'Procesando...' },
    speaking: { icon: <Volume2 className="h-4 w-4 text-green-400" />, color: 'bg-green-500/20 border-green-500/40', title: 'Hablando...' },
  };

  const cfg = stateConfig[state];

  return (
    <Button
      variant="outline"
      size="icon"
      className={`relative rounded-full w-9 h-9 ${cfg.color} transition-all`}
      onClick={handleClick}
      title={cfg.title}
    >
      {cfg.icon}
      {lastTranscript && state === 'processing' && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
          {lastTranscript}
        </span>
      )}
    </Button>
  );
}
