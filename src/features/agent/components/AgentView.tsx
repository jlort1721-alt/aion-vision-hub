// ============================================================
// AION AGENT — Main Chat Component
// Complete UI with sidebar, chat, tools, streaming
// ============================================================

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAgentChat, useConversations, usePresets } from '../hooks/useAgent';
import { CONTEXT_MODES, type ContextMode, type AgentMessage, type ToolExecution } from '../types/agent.types';
import { MarkdownRenderer, ToolCallCard } from './MarkdownRenderer';

// ─── Icons (inline SVG for zero deps) ───
const Icons = {
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  stop: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  ),
  thumbUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
  ),
  thumbDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 17v5M9 3h6l-1 7h4l-7 8 1-6H7l2-9z"/></svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
  sparkle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.4 9.6 22 12 14.4 14.4 12 22 9.6 14.4 2 12 9.6 9.6z"/></svg>
  ),
};

// ═══════════════════════════════════════════════════════════
// MAIN AGENT VIEW
// ═══════════════════════════════════════════════════════════
export function AgentView() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSiteId, setActiveSiteId] = useState<string>('');

  const chat = useAgentChat();
  const convos = useConversations();
  const { presets } = usePresets();

  return (
    <div className="agent-container">
      {/* Sidebar */}
      <aside className={`agent-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">{Icons.sparkle}</span>
            <span className="logo-text">AION Agent</span>
          </div>
          <button className="btn-icon" onClick={() => chat.newConversation()}>
            {Icons.plus}
          </button>
        </div>

        {/* Context Mode Selector */}
        <div className="context-selector">
          <label className="context-label">Modo de contexto</label>
          <div className="context-grid">
            {CONTEXT_MODES.map(mode => (
              <button
                key={mode.id}
                className={`context-chip ${chat.contextMode === mode.id ? 'active' : ''}`}
                onClick={() => chat.setContextMode(mode.id)}
                title={mode.description}
                style={{ '--chip-color': mode.color } as React.CSSProperties}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="conversations-list">
          <h3 className="section-title">Conversaciones</h3>
          {convos.conversations.map(conv => (
            <button
              key={conv.id}
              className={`conv-item ${chat.conversationId === conv.id ? 'active' : ''}`}
              onClick={() => chat.loadConversation(conv.id)}
            >
              <span className="conv-icon">
                {CONTEXT_MODES.find(m => m.id === conv.context_mode)?.icon || '💬'}
              </span>
              <div className="conv-info">
                <span className="conv-title">{conv.title}</span>
                <span className="conv-meta">
                  {new Date(conv.updated_at).toLocaleDateString('es-CO')} · {conv.message_count} msgs
                </span>
              </div>
              {conv.pinned && <span className="conv-pin">{Icons.pin}</span>}
            </button>
          ))}
        </div>

        {/* Presets */}
        {presets.length > 0 && (
          <div className="presets-section">
            <h3 className="section-title">Comandos rápidos</h3>
            {presets.slice(0, 6).map(preset => (
              <button
                key={preset.id}
                className="preset-item"
                onClick={() => chat.sendMessage(preset.prompt)}
              >
                <span className="preset-icon">{Icons.sparkle}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="agent-main">
        {/* Top Bar */}
        <header className="agent-topbar">
          <button className="btn-icon mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {Icons.menu}
          </button>
          <div className="topbar-info">
            <h2 className="topbar-title">
              {chat.conversationId
                ? convos.conversations.find(c => c.id === chat.conversationId)?.title || 'Conversación'
                : 'Nueva conversación'}
            </h2>
            <span className="topbar-mode">
              {CONTEXT_MODES.find(m => m.id === chat.contextMode)?.icon}{' '}
              {CONTEXT_MODES.find(m => m.id === chat.contextMode)?.label}
            </span>
          </div>
          <div className="topbar-actions">
            <button className="btn-icon" onClick={() => chat.newConversation()} title="Nueva conversación">
              {Icons.plus}
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="agent-messages">
          {chat.messages.length === 0 && !chat.isLoading ? (
            <WelcomeScreen
              contextMode={chat.contextMode}
              onPresetClick={chat.sendMessage}
              presets={presets}
            />
          ) : (
            <>
              {chat.messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onFeedback={chat.sendFeedback}
                />
              ))}

              {/* Tool executions in progress */}
              {chat.toolExecutions.length > 0 && chat.isStreaming && (
                <div className="tool-executions">
                  {chat.toolExecutions.map((exec, i) => (
                    <ToolCallCard key={i} execution={exec} />
                  ))}
                </div>
              )}

              {/* Streaming response */}
              {chat.isStreaming && chat.streamingText && (
                <div className="message-bubble assistant streaming">
                  <div className="bubble-avatar">
                    <span className="avatar-icon pulse">{Icons.sparkle}</span>
                  </div>
                  <div className="bubble-content">
                    <MarkdownRenderer content={chat.streamingText} />
                    <span className="typing-cursor">▊</span>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {chat.isLoading && !chat.streamingText && (
                <div className="message-bubble assistant">
                  <div className="bubble-avatar">
                    <span className="avatar-icon pulse">{Icons.sparkle}</span>
                  </div>
                  <div className="bubble-content">
                    <div className="thinking-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}

              <ScrollAnchor />
            </>
          )}
        </div>

        {/* Error Banner */}
        {chat.error && (
          <div className="error-banner">
            <span>⚠️ {chat.error}</span>
            <button onClick={() => chat.sendMessage(chat.messages[chat.messages.length - 1]?.content || '')}>
              Reintentar
            </button>
          </div>
        )}

        {/* Suggestions */}
        {chat.suggestions.length > 0 && !chat.isStreaming && (
          <div className="suggestions-bar">
            {chat.suggestions.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => chat.sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <ChatInput
          onSend={chat.sendMessage}
          onStop={chat.stopStreaming}
          isStreaming={chat.isStreaming}
          isLoading={chat.isLoading}
          contextMode={chat.contextMode}
        />
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════
const MessageBubble = memo(({ message, onFeedback }: {
  message: AgentMessage;
  onFeedback: (id: string, fb: 'positive' | 'negative') => void;
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="bubble-avatar">
        <span className="avatar-icon">
          {isUser ? '👤' : Icons.sparkle}
        </span>
      </div>
      <div className="bubble-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Tool calls display */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="msg-tools">
            {message.tool_calls.map((tc, i) => (
              <span key={i} className="tool-badge">
                🔧 {tc.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {!isUser && (
          <div className="bubble-actions">
            <button
              className={`action-btn ${message.feedback === 'positive' ? 'active' : ''}`}
              onClick={() => onFeedback(message.id, 'positive')}
              title="Útil"
            >{Icons.thumbUp}</button>
            <button
              className={`action-btn ${message.feedback === 'negative' ? 'active' : ''}`}
              onClick={() => onFeedback(message.id, 'negative')}
              title="No útil"
            >{Icons.thumbDown}</button>
            <button
              className="action-btn"
              onClick={handleCopy}
              title="Copiar"
            >{copied ? '✓' : Icons.copy}</button>
          </div>
        )}

        <span className="bubble-time">
          {new Date(message.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// CHAT INPUT
// ═══════════════════════════════════════════════════════════
function ChatInput({ onSend, onStop, isStreaming, isLoading, contextMode }: {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isLoading: boolean;
  contextMode: ContextMode;
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const modeConfig = CONTEXT_MODES.find(m => m.id === contextMode);

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Mensaje a AION ${modeConfig?.icon || ''} ${modeConfig?.label || ''}...`}
          rows={1}
          disabled={isLoading && !isStreaming}
        />
        <button
          className={`btn-send ${isStreaming ? 'streaming' : ''}`}
          onClick={isStreaming ? onStop : handleSubmit}
          disabled={!isStreaming && (!input.trim() || isLoading)}
        >
          {isStreaming ? Icons.stop : Icons.send}
        </button>
      </div>
      <p className="input-hint">
        AION puede ejecutar acciones de seguridad. Las acciones críticas requieren confirmación.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════════════════════
function WelcomeScreen({ contextMode, onPresetClick, presets }: {
  contextMode: ContextMode;
  onPresetClick: (prompt: string) => void;
  presets: any[];
}) {
  const modeConfig = CONTEXT_MODES.find(m => m.id === contextMode);
  const modePresets = presets.filter(p =>
    p.category === contextMode || p.category === 'operations'
  ).slice(0, 4);

  const defaultPrompts: Record<string, string[]> = {
    general: [
      '¿Cuál es el estado general del sistema?',
      'Muéstrame un resumen de hoy',
      '¿Hay cámaras offline?',
      '¿Cuántos incidentes abiertos hay?',
    ],
    cameras: [
      'Lista todas las cámaras y su estado',
      'Diagnóstico completo del sistema de cámaras',
      'Cámaras offline en este momento',
      'Eventos de detección de las últimas 2 horas',
    ],
    iot: [
      'Estado de todos los dispositivos IoT',
      'Dispositivos offline o sin respuesta',
      '¿Qué luces están encendidas?',
      'Programaciones activas',
    ],
    access: [
      'Registros de acceso de hoy',
      'Accesos recientes del portón principal',
      'Buscar placa ABC123',
      'Estadísticas de acceso semanal',
    ],
    incidents: [
      'Incidentes abiertos actualmente',
      'Reportar un nuevo incidente',
      'Resumen de incidentes del mes',
      'Incidentes críticos sin resolver',
    ],
    analytics: [
      'Dashboard del día',
      'Reporte ejecutivo mensual',
      'Análisis de anomalías',
      'Tendencias de acceso de la semana',
    ],
  };

  const prompts = modePresets.length > 0
    ? modePresets.map(p => p.prompt)
    : (defaultPrompts[contextMode] || defaultPrompts.general);

  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <div className="welcome-icon-ring">
          <span className="welcome-sparkle">{Icons.sparkle}</span>
        </div>
        <h1>AION Agent</h1>
        <p className="welcome-subtitle">
          Centro de inteligencia operativa · {modeConfig?.description}
        </p>
      </div>
      <div className="welcome-grid">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            className="welcome-card"
            onClick={() => onPresetClick(prompt)}
          >
            <span className="card-icon">{modeConfig?.icon || '💬'}</span>
            <span className="card-text">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCROLL ANCHOR (auto-scroll to bottom)
// ═══════════════════════════════════════════════════════════
function ScrollAnchor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  });
  return <div ref={ref} />;
}

export default AgentView;
