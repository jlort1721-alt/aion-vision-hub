// ============================================================
// AION AGENT — Frontend Type Definitions
// ============================================================

export interface AgentConversation {
  id: string;
  user_id: string;
  site_id: string | null;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  context_mode: ContextMode;
  metadata: Record<string, any>;
  message_count: number;
  token_usage: { input: number; output: number; total: number };
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  content_type: string;
  tool_calls: Array<{ id: string; name: string; input: Record<string, any> }> | null;
  tool_results: any[] | null;
  metadata: Record<string, any>;
  tokens_used: number;
  latency_ms: number;
  feedback: 'positive' | 'negative' | null;
  created_at: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  prompt: string;
  icon: string;
  is_global: boolean;
  usage_count: number;
}

export interface ToolExecution {
  tool_name: string;
  input: Record<string, any>;
  output: Record<string, any>;
  status: 'success' | 'error' | 'denied';
  execution_ms: number;
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_start' | 'tool_result' | 'done' | 'error' | 'status';
  content?: string;
  tool_call?: { id: string; name: string; input: Record<string, any> };
  tool_result?: { tool_use_id: string; content: any; is_error?: boolean };
  usage?: { input: number; output: number; total: number };
  error?: string;
  status?: string;
}

export interface ChatResponse {
  content: string;
  conversation_id: string;
  model: string;
  usage: { input: number; output: number; total: number };
}

export type ContextMode =
  | 'general' | 'cameras' | 'iot' | 'access'
  | 'residents' | 'vehicles' | 'incidents'
  | 'analytics' | 'config';

export interface ContextModeConfig {
  id: ContextMode;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const CONTEXT_MODES: ContextModeConfig[] = [
  { id: 'general', label: 'General', icon: '🏠', color: '#D4A017', description: 'Asistente general' },
  { id: 'cameras', label: 'Cámaras', icon: '📹', color: '#3B82F6', description: 'Videovigilancia' },
  { id: 'iot', label: 'IoT', icon: '💡', color: '#10B981', description: 'Dispositivos inteligentes' },
  { id: 'access', label: 'Acceso', icon: '🚪', color: '#F59E0B', description: 'Control de acceso' },
  { id: 'residents', label: 'Residentes', icon: '👥', color: '#8B5CF6', description: 'Gestión de residentes' },
  { id: 'vehicles', label: 'Vehículos', icon: '🚗', color: '#EF4444', description: 'Control vehicular' },
  { id: 'incidents', label: 'Incidentes', icon: '⚠️', color: '#F97316', description: 'Gestión de incidentes' },
  { id: 'analytics', label: 'Analytics', icon: '📊', color: '#06B6D4', description: 'Reportes y análisis' },
  { id: 'config', label: 'Sistema', icon: '⚙️', color: '#6B7280', description: 'Configuración' },
];
