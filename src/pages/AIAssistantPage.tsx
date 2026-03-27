import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AI_MODELS, DEFAULT_AI_CONFIG } from '@/services/ai-provider';
import { useI18n } from '@/contexts/I18nContext';
import {
  Bot, Send, Sparkles, RotateCcw, Copy, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2,
  Zap, Shield, Radio, DoorOpen, AlertTriangle, Activity, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────

type AgentStatus = 'ready' | 'thinking' | 'executing' | 'error';

interface ToolCallEvent {
  type: 'tool_call';
  tool: string;
  params: Record<string, unknown>;
}

interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: unknown;
  success: boolean;
  executionMs: number;
}

interface ToolExecution {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  result?: unknown;
  executionMs?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolExecutions?: ToolExecution[];
}

// ── Constants ──────────────────────────────────────────────

const CHAT_URL = `${import.meta.env.VITE_API_URL || ''}/ai/chat`;

const HISTORY_KEY = 'aion-agent-history';
const MAX_STORED_MESSAGES = 50;

// Tools that affect physical systems — require operator confirmation
const PHYSICAL_ACTION_TOOLS = [
  'open_gate', 'reboot_device', 'toggle_relay',
  'send_alert', 'send_whatsapp', 'broadcast_emergency',
] as const;

interface StoredHistory {
  sessionTimestamp: string;
  messages: Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const stored: StoredHistory = JSON.parse(raw);
    return (stored.messages || []).slice(-MAX_STORED_MESSAGES).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch { return []; }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    const stored: StoredHistory = {
      sessionTimestamp: new Date().toISOString(),
      messages: trimmed.map(m => ({ ...m, timestamp: m.timestamp.toISOString() as any })),
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stored));
  } catch { /* storage full or unavailable */ }
}

const QUICK_ACTIONS = [
  { icon: AlertTriangle, label: 'Alertas activas', prompt: '¿Cuáles son las alertas activas ahora?', color: 'text-red-400' },
  { icon: Activity, label: 'Estado dispositivos', prompt: 'Dame el estado de todos los dispositivos', color: 'text-blue-400' },
  { icon: Shield, label: 'Resumen del turno', prompt: 'Genera el resumen ejecutivo del turno actual', color: 'text-emerald-400' },
  { icon: DoorOpen, label: 'Abrir puerta', prompt: 'Necesito abrir una puerta', color: 'text-amber-400' },
] as const;

// ── Helpers ────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// ── Sub-components ─────────────────────────────────────────

function AgentStatusIndicator({ status, toolName }: { status: AgentStatus; toolName?: string }) {
  const config: Record<AgentStatus, { dot: string; label: string; animate?: string }> = {
    ready: { dot: 'bg-emerald-500', label: 'Ready' },
    thinking: { dot: 'bg-yellow-500', label: 'Thinking...', animate: 'animate-pulse' },
    executing: { dot: 'bg-blue-500', label: `Executing: ${toolName || '...'}`, animate: 'animate-spin' },
    error: { dot: 'bg-red-500', label: 'Error' },
  };
  const c = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot, c.animate)} />
      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{c.label}</span>
    </div>
  );
}

function ToolExecutionCard({ exec }: { exec: ToolExecution }) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const statusIcon = {
    running: <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  }[exec.status];

  return (
    <div className="my-2 rounded-md border border-border/60 bg-background/50 overflow-hidden text-xs">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
        {statusIcon}
        <span className="font-medium text-foreground">
          {exec.status === 'running' ? 'Executing' : exec.status === 'success' ? 'Executed' : 'Failed'}:
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
          {exec.tool}
        </Badge>
        {exec.executionMs != null && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {exec.executionMs}ms
          </span>
        )}
      </div>

      {/* Parameters collapsible */}
      {exec.params && Object.keys(exec.params).length > 0 && (
        <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 px-3 py-1.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors border-t border-border/40">
              {paramsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-[10px] uppercase tracking-wider font-medium">Parameters</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(exec.params, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Result collapsible */}
      {exec.result != null && (
        <Collapsible open={resultOpen} onOpenChange={setResultOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 px-3 py-1.5 w-full text-left text-muted-foreground hover:text-foreground transition-colors border-t border-border/40">
              {resultOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-[10px] uppercase tracking-wider font-medium">Result</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
              {typeof exec.result === 'string' ? exec.result : JSON.stringify(exec.result, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function AIAssistantPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState(DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(DEFAULT_AI_CONFIG.model);
  const [enableTools, setEnableTools] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('ready');
  const [activeToolName, setActiveToolName] = useState<string | undefined>();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; tool: string; params: Record<string, unknown> } | null>(null);
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

  // Persist conversation to localStorage on every change
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setAgentStatus('ready');
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* no-op */ }
  }, []);

  // Helper to update a specific message by id
  const updateMessage = useCallback((id: string, updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setAgentStatus('thinking');
    setActiveToolName(undefined);

    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    // When tools are enabled, prepend a system instruction requiring confirmation for physical actions
    if (enableTools) {
      allMessages.unshift({
        role: 'user' as const,
        content: `[SYSTEM INSTRUCTION — do not repeat this to the user] IMPORTANT: For physical actions (${PHYSICAL_ACTION_TOOLS.join(', ')}), you MUST always describe the action and its parameters to the operator and ask for explicit confirmation BEFORE executing the tool. Never execute these tools without the operator typing "confirm", "yes", "si", or "confirmar".`,
      });
    }

    const assistantId = `msg-${Date.now()}-resp`;

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: allMessages,
          config: { provider, model },
          enableTools,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: 'AI Error', description: errData.error || `Error ${resp.status}`, variant: 'destructive' });
        setIsLoading(false);
        setAgentStatus('error');
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';
      let toolExecutions: ToolExecution[] = [];

      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), toolExecutions: [] },
      ]);

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

            // ── Handle tool_call event ──
            if (parsed.type === 'tool_call') {
              const evt = parsed as ToolCallEvent;
              const isPhysical = (PHYSICAL_ACTION_TOOLS as readonly string[]).includes(evt.tool);

              // Show confirmation dialog for physical actions
              if (isPhysical) {
                setConfirmDialog({ open: true, tool: evt.tool, params: evt.params || {} });
              }

              const toolExec: ToolExecution = {
                id: `tool-${Date.now()}-${evt.tool}`,
                tool: evt.tool,
                params: evt.params || {},
                status: 'running',
              };
              toolExecutions = [...toolExecutions, toolExec];
              setAgentStatus('executing');
              setActiveToolName(evt.tool);
              updateMessage(assistantId, m => ({ ...m, toolExecutions: [...toolExecutions] }));
              continue;
            }

            // ── Handle tool_result event ──
            if (parsed.type === 'tool_result') {
              const evt = parsed as ToolResultEvent;
              toolExecutions = toolExecutions.map(te =>
                te.tool === evt.tool && te.status === 'running'
                  ? { ...te, status: evt.success ? 'success' : 'error', result: evt.result, executionMs: evt.executionMs }
                  : te,
              );
              setAgentStatus('thinking');
              setActiveToolName(undefined);
              updateMessage(assistantId, m => ({ ...m, toolExecutions: [...toolExecutions] }));
              continue;
            }

            // ── Handle done event from custom backend ──
            if (parsed.done === true) {
              if (parsed.content) {
                assistantContent += parsed.content;
                updateMessage(assistantId, m => ({ ...m, content: assistantContent }));
              }
              streamDone = true;
              break;
            }

            // ── Handle regular text chunk (custom backend format) ──
            if (parsed.content && parsed.done === false) {
              assistantContent += parsed.content;
              updateMessage(assistantId, m => ({ ...m, content: assistantContent }));
              continue;
            }

            // ── Handle OpenAI-compatible SSE format ──
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              updateMessage(assistantId, m => ({ ...m, content: assistantContent }));
            }
          } catch {
            // Incomplete JSON — put back for next iteration
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Process any remaining buffer
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

            if (parsed.type === 'tool_result') {
              const evt = parsed as ToolResultEvent;
              toolExecutions = toolExecutions.map(te =>
                te.tool === evt.tool && te.status === 'running'
                  ? { ...te, status: evt.success ? 'success' : 'error', result: evt.result, executionMs: evt.executionMs }
                  : te,
              );
              updateMessage(assistantId, m => ({ ...m, toolExecutions: [...toolExecutions] }));
              continue;
            }

            if (parsed.content && typeof parsed.content === 'string') {
              assistantContent += parsed.content;
              updateMessage(assistantId, m => ({ ...m, content: assistantContent }));
              continue;
            }

            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              updateMessage(assistantId, m => ({ ...m, content: assistantContent }));
            }
          } catch { /* ignore incomplete trailing chunk */ }
        }
      }

      setAgentStatus('ready');
    } catch (err: any) {
      console.error('Stream error:', err);
      toast({ title: 'Connection error', description: err.message, variant: 'destructive' });
      setAgentStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              AION Agent
            </h1>
            {enableTools && (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Tools
              </Badge>
            )}
          </div>
          <AgentStatusIndicator status={agentStatus} toolName={activeToolName} />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Agent Mode Toggle */}
          <div className="flex items-center gap-2">
            <label htmlFor="agent-mode" className="text-[10px] text-muted-foreground cursor-pointer select-none">
              Agent Mode
            </label>
            <Switch
              id="agent-mode"
              checked={enableTools}
              onCheckedChange={setEnableTools}
              className="h-5 w-9 data-[state=checked]:bg-primary"
            />
          </div>

          <div className="w-px h-5 bg-border" />

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
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-destructive" onClick={clearHistory}>
              <Trash2 className="h-3 w-3" /> Clear History
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── Messages Area ──────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {t('ai.welcome')}
            </h2>
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
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={cn('max-w-[70%] rounded-lg p-3', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              {/* Tool execution cards (rendered before/between text) */}
              {msg.role === 'assistant' && msg.toolExecutions && msg.toolExecutions.length > 0 && (
                <div className="mb-2">
                  {msg.toolExecutions.map(exec => (
                    <ToolExecutionCard key={exec.id} exec={exec} />
                  ))}
                </div>
              )}

              {/* Message content */}
              <div className="text-sm whitespace-pre-wrap">{msg.content || (msg.toolExecutions?.length ? '' : '...')}</div>

              {/* Action buttons */}
              {msg.role === 'assistant' && msg.content && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(msg.content)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsUp className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsDown className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator (only when no assistant message has been created yet) */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
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

      {/* ── Input Area ─────────────────────────────── */}
      <div className="border-t bg-card p-4 space-y-3">
        {/* Quick action buttons (shown when tools are enabled) */}
        {enableTools && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Radio className="h-3 w-3 text-muted-foreground shrink-0" />
            {QUICK_ACTIONS.map(action => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5 shrink-0 gap-1.5 border-border/60 hover:bg-muted/60"
                disabled={isLoading}
                onClick={() => sendMessage(action.prompt)}
              >
                <action.icon className={cn('h-3 w-3', action.color)} />
                {action.label}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={enableTools ? 'Ask AION Agent... (tools enabled)' : t('ai.placeholder')}
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* ── Physical Action Confirmation Dialog ─── */}
      <AlertDialog open={!!confirmDialog?.open} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar acci&oacute;n: {confirmDialog?.tool}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Esta acci&oacute;n afecta un sistema f&iacute;sico. Revise los par&aacute;metros antes de confirmar.
                </p>
                {confirmDialog?.params && Object.keys(confirmDialog.params).length > 0 && (
                  <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto">
                    {JSON.stringify(confirmDialog.params, null, 2)}
                  </pre>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDialog(null);
              sendMessage(`He cancelado la ejecución de ${confirmDialog?.tool}. No ejecutar.`);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmDialog(null);
            }}>
              Confirmar y Ejecutar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
