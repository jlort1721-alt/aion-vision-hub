// ============================================================
// AION AGENT — React Hooks
// useAgent, useAgentChat, useConversations
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AgentConversation, AgentMessage, ChatResponse,
  StreamChunk, ContextMode, AgentPreset, ToolExecution
} from '../types/agent.types';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─────────────────────────────────────────────────────────
// useAgentChat — Main chat hook with streaming
// ─────────────────────────────────────────────────────────
export function useAgentChat() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [contextMode, setContextMode] = useState<ContextMode>('general');
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('aion_token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, []);

  // ── Send message with streaming ──
  const sendMessage = useCallback(async (
    content: string,
    options?: { siteId?: string; mode?: ContextMode }
  ) => {
    if (!content.trim() || isStreaming) return;

    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingText('');
    setToolExecutions([]);

    // Add user message optimistically
    const userMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || '',
      role: 'user',
      content,
      content_type: 'text',
      tool_calls: null,
      tool_results: null,
      metadata: {},
      tokens_used: 0,
      latency_ms: 0,
      feedback: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    const mode = options?.mode || contextMode;
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/agent/chat/stream`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
          context_mode: mode,
          site_id: options?.siteId,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error de conexión' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      const currentToolExecs: ToolExecution[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));

            switch (chunk.type) {
              case 'status':
                // Capture conversation_id from first status event
                if (chunk.status === 'thinking' && chunk.content) {
                  setConversationId(chunk.content);
                }
                break;

              case 'text_delta':
                accumulated += chunk.content || '';
                setStreamingText(accumulated);
                break;

              case 'tool_start':
                if (chunk.tool_call) {
                  currentToolExecs.push({
                    tool_name: chunk.tool_call.name,
                    input: chunk.tool_call.input,
                    output: {},
                    status: 'success',
                    execution_ms: 0,
                  });
                  setToolExecutions([...currentToolExecs]);
                }
                break;

              case 'tool_result':
                if (chunk.tool_result && currentToolExecs.length > 0) {
                  const last = currentToolExecs[currentToolExecs.length - 1];
                  try {
                    last.output = JSON.parse(
                      typeof chunk.tool_result.content === 'string'
                        ? chunk.tool_result.content
                        : JSON.stringify(chunk.tool_result.content)
                    );
                  } catch { last.output = chunk.tool_result.content; }
                  last.status = chunk.tool_result.is_error ? 'error' : 'success';
                  setToolExecutions([...currentToolExecs]);
                }
                break;

              case 'done':
                if (chunk.usage) {
                  // Could track usage here
                }
                break;

              case 'error':
                setError(chunk.error || 'Error del agente');
                break;
            }
          } catch {}
        }
      }

      // Finalize assistant message
      if (accumulated) {
        const assistantMsg: AgentMessage = {
          id: `msg-${Date.now()}`,
          conversation_id: conversationId || '',
          role: 'assistant',
          content: accumulated,
          content_type: accumulated.includes('|') ? 'table' : 'markdown',
          tool_calls: currentToolExecs.length > 0
            ? currentToolExecs.map(t => ({ id: t.tool_name, name: t.tool_name, input: t.input }))
            : null,
          tool_results: null,
          metadata: {},
          tokens_used: 0,
          latency_ms: 0,
          feedback: null,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }

      setStreamingText('');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        // Remove optimistic user message on error
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [conversationId, contextMode, isStreaming, getAuthHeaders]);

  // ── Stop streaming ──
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  // ── Load conversation ──
  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/agent/conversations/${id}`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json();
      setMessages(data.messages || []);
      setConversationId(data.conversation.id);
      setContextMode(data.conversation.context_mode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // ── New conversation ──
  const newConversation = useCallback((mode?: ContextMode) => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setSuggestions([]);
    setToolExecutions([]);
    setStreamingText('');
    if (mode) setContextMode(mode);
  }, []);

  // ── Send feedback ──
  const sendFeedback = useCallback(async (
    messageId: string, feedback: 'positive' | 'negative'
  ) => {
    try {
      await fetch(`${API_BASE}/api/agent/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ feedback }),
      });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, feedback } : m
      ));
    } catch {}
  }, [getAuthHeaders]);

  return {
    messages, conversationId, isLoading, isStreaming,
    error, suggestions, contextMode, toolExecutions, streamingText,
    sendMessage, stopStreaming, loadConversation,
    newConversation, sendFeedback, setContextMode,
  };
}

// ─────────────────────────────────────────────────────────
// useConversations — Manage conversation list
// ─────────────────────────────────────────────────────────
export function useConversations() {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const getAuthHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('aion_token') || ''}`,
  }), []);

  const fetchConversations = useCallback(async (status = 'active') => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE}/api/agent/conversations?status=${status}&limit=50`,
        { headers: getAuthHeaders() }
      );
      const data = await resp.json();
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch {}
    setIsLoading(false);
  }, [getAuthHeaders]);

  const deleteConversation = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/agent/conversations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    setConversations(prev => prev.filter(c => c.id !== id));
  }, [getAuthHeaders]);

  const updateConversation = useCallback(async (
    id: string, updates: Partial<AgentConversation>
  ) => {
    await fetch(`${API_BASE}/api/agent/conversations/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  }, [getAuthHeaders]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  return {
    conversations, isLoading, total,
    fetchConversations, deleteConversation, updateConversation,
  };
}

// ─────────────────────────────────────────────────────────
// usePresets — Agent command presets
// ─────────────────────────────────────────────────────────
export function usePresets() {
  const [presets, setPresets] = useState<AgentPreset[]>([]);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/agent/presets`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('aion_token') || ''}`,
          },
        });
        const data = await resp.json();
        setPresets(data.presets || []);
      } catch {}
    };
    fetchPresets();
  }, []);

  return { presets };
}
