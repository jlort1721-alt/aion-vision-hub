// ============================================================
// AION AGENT — Sub-Components
// MarkdownRenderer + ToolCallCard
// ============================================================

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { ToolExecution } from '../types/agent.types';

// ─────────────────────────────────────────────────────────
// MARKDOWN RENDERER (lightweight, no dependencies)
// ─────────────────────────────────────────────────────────
export function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => {
    const rendered = renderMarkdown(content);
    // SECURITY: DOMPurify as defense-in-depth (renderMarkdown already escapes HTML)
    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: ['h2', 'h3', 'h4', 'strong', 'em', 'a', 'code', 'pre', 'ul', 'ol', 'li', 'hr', 'p', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br'],
      ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
    });
  }, [content]);
  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Links (sanitize href to prevent javascript: protocol)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      const safeHref = href.replace(/&amp;/g, '&');
      if (/^(https?:\/\/|mailto:|#)/i.test(safeHref)) {
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return text; // Strip unsafe links
    })
    // Status indicators
    .replace(/🟢/g, '<span class="status-dot online">🟢</span>')
    .replace(/🔴/g, '<span class="status-dot offline">🔴</span>')
    .replace(/🟡/g, '<span class="status-dot warning">🟡</span>');

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_, header, separator, body) => {
      const headers = header.split('|').filter(Boolean).map((h: string) =>
        `<th>${h.trim()}</th>`
      ).join('');
      const rows = body.trim().split('\n').map((row: string) => {
        const cells = row.split('|').filter(Boolean).map((c: string) =>
          `<td>${c.trim()}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<div class="table-wrapper"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  );

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[234]|<pre|<ul|<ol|<div|<hr|<table)/g, '$1');
  html = html.replace(/(<\/h[234]>|<\/pre>|<\/ul>|<\/ol>|<\/div>|<hr\/>|<\/table>)<\/p>/g, '$1');

  return html;
}

// ─────────────────────────────────────────────────────────
// TOOL CALL CARD
// ─────────────────────────────────────────────────────────
export function ToolCallCard({ execution }: { execution: ToolExecution }) {
  const [expanded, setExpanded] = React.useState(false);

  const toolLabels: Record<string, { icon: string; label: string }> = {
    camera_list: { icon: '📹', label: 'Listar Cámaras' },
    camera_snapshot: { icon: '📸', label: 'Snapshot' },
    camera_stream_url: { icon: '🎥', label: 'Stream URL' },
    camera_ptz: { icon: '🕹️', label: 'Control PTZ' },
    camera_playback: { icon: '⏪', label: 'Reproducción' },
    camera_events: { icon: '📋', label: 'Eventos de Cámara' },
    camera_health: { icon: '🩺', label: 'Diagnóstico' },
    iot_list_devices: { icon: '💡', label: 'Dispositivos IoT' },
    iot_control: { icon: '🔌', label: 'Control IoT' },
    iot_scene_execute: { icon: '🎬', label: 'Escena IoT' },
    iot_schedule: { icon: '⏰', label: 'Programación' },
    access_open_gate: { icon: '🚪', label: 'Abrir Puerta' },
    access_logs: { icon: '📝', label: 'Registros de Acceso' },
    access_face_register: { icon: '🧑', label: 'Registro Facial' },
    access_lpr_search: { icon: '🚗', label: 'Buscar Placa' },
    resident_search: { icon: '🔍', label: 'Buscar Residente' },
    resident_directory: { icon: '📒', label: 'Directorio' },
    vehicle_search: { icon: '🚘', label: 'Buscar Vehículo' },
    incident_create: { icon: '⚠️', label: 'Crear Incidente' },
    incident_list: { icon: '📋', label: 'Listar Incidentes' },
    incident_update: { icon: '✏️', label: 'Actualizar Incidente' },
    analytics_dashboard: { icon: '📊', label: 'Dashboard' },
    analytics_report: { icon: '📄', label: 'Generar Reporte' },
    analytics_anomaly: { icon: '🔮', label: 'Anomalías' },
    system_status: { icon: '⚙️', label: 'Estado del Sistema' },
    system_service_restart: { icon: '🔄', label: 'Reiniciar Servicio' },
    comms_send_notification: { icon: '📢', label: 'Notificación' },
    comms_intercom: { icon: '📞', label: 'Intercomunicador' },
  };

  const meta = toolLabels[execution.tool_name] || { icon: '🔧', label: execution.tool_name };
  const statusIcon = execution.status === 'success' ? '✅' : execution.status === 'error' ? '❌' : '⏳';

  return (
    <div className={`tool-card ${execution.status}`} onClick={() => setExpanded(!expanded)}>
      <div className="tool-card-header">
        <span className="tool-card-icon">{meta.icon}</span>
        <span className="tool-card-name">{meta.label}</span>
        <span className="tool-card-status">{statusIcon}</span>
        {execution.execution_ms > 0 && (
          <span className="tool-card-time">{execution.execution_ms}ms</span>
        )}
        <span className={`tool-card-chevron ${expanded ? 'expanded' : ''}`}>▸</span>
      </div>
      {expanded && (
        <div className="tool-card-body">
          <div className="tool-detail">
            <span className="detail-label">Entrada:</span>
            <pre>{JSON.stringify(execution.input, null, 2)}</pre>
          </div>
          {execution.output && Object.keys(execution.output).length > 0 && (
            <div className="tool-detail">
              <span className="detail-label">Resultado:</span>
              <pre>{JSON.stringify(execution.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
