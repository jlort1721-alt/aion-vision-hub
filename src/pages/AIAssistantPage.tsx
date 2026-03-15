import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_MODELS, DEFAULT_AI_CONFIG } from '@/services/ai-provider';
import { useI18n } from '@/contexts/I18nContext';
import { Bot, Send, Sparkles, RotateCcw, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export default function AIAssistantPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState(DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(DEFAULT_AI_CONFIG.model);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const QUICK_PROMPTS = [
    { label: t('ai.summarize_alerts'), prompt: t('ai.summarize_alerts_prompt') },
    { label: t('ai.device_status'), prompt: t('ai.device_status_prompt') },
    { label: t('ai.draft_report'), prompt: t('ai.draft_report_prompt') },
    { label: t('ai.generate_sop'), prompt: t('ai.generate_sop_prompt') },
  ];

  // Update model when provider changes
  useEffect(() => {
    const models = AI_MODELS[provider];
    if (models?.length) setModel(models[0].id);
  }, [provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: allMessages,
          config: { provider, model },
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: 'AI Error', description: errData.error || `Error ${resp.status}`, variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (!resp.body) throw new Error('No response body');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';
      const assistantId = `msg-${Date.now()}-resp`;
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
            }
          } catch { textBuffer = line + '\n' + textBuffer; break; }
        }
      }
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      console.error('Stream error:', err);
      toast({ title: 'Connection error', description: err.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <Bot className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-sm font-bold">{t('ai.title')}</h1>
          <p className="text-[10px] text-muted-foreground">{t('ai.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
            <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lovable">Lovable AI</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(AI_MODELS[provider] || []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold mb-1">{t('ai.welcome')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">{t('ai.welcome_desc')}</p>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              {QUICK_PROMPTS.map(qp => (
                <Button key={qp.label} variant="outline" className="h-auto py-2 px-3 text-xs text-left justify-start" onClick={() => sendMessage(qp.prompt)}>
                  <Sparkles className="h-3 w-3 mr-2 shrink-0 text-primary" />{qp.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' && "justify-end")}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
            )}
            <div className={cn("max-w-[70%] rounded-lg p-3", msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted")}>
              <div className="text-sm whitespace-pre-wrap">{msg.content || '...'}</div>
              {msg.role === 'assistant' && msg.content && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(msg.content)}><Copy className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsUp className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsDown className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary animate-pulse" /></div>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-card p-4">
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder={t('ai.placeholder')} className="flex-1" disabled={isLoading} />
          <Button type="submit" disabled={!input.trim() || isLoading}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
