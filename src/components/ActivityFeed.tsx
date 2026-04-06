import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLog {
  id: string;
  user_name?: string;
  user_email?: string;
  action: string;
  description?: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500',
  incident: 'bg-red-500',
  alert: 'bg-orange-500',
  acknowledge: 'bg-yellow-500',
  gate: 'bg-blue-500',
  door: 'bg-blue-500',
  login: 'bg-indigo-500',
  update: 'bg-cyan-500',
  delete: 'bg-red-400',
};

function actionDotColor(action: string): string {
  const lower = action.toLowerCase();
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'bg-zinc-400';
}

function actionLabel(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('incident') && lower.includes('create')) return 'creo incidente';
  if (lower.includes('acknowledge')) return 'reconocio alerta';
  if (lower.includes('gate') || lower.includes('door')) return 'abrio puerta';
  if (lower.includes('login')) return 'inicio sesion';
  if (lower.includes('create')) return 'creo registro';
  if (lower.includes('update')) return 'actualizo registro';
  if (lower.includes('delete')) return 'elimino registro';
  return action.toLowerCase().replace(/_/g, ' ');
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'hace unos segundos';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `hace ${diffDays}d`;
}

function userInitial(log: AuditLog): string {
  if (log.user_name) return log.user_name.charAt(0).toUpperCase();
  if (log.user_email) return log.user_email.charAt(0).toUpperCase();
  return '?';
}

function userName(log: AuditLog): string {
  if (log.user_name) return log.user_name;
  if (log.user_email) return log.user_email.split('@')[0];
  return 'Sistema';
}

export default function ActivityFeed() {
  const { isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.get<unknown>('/audit/logs', { limit: '20' });
      let items: AuditLog[] = [];
      if (Array.isArray(res)) items = res as AuditLog[];
      else {
        const r = res as Record<string, unknown>;
        if (Array.isArray(r.items)) items = r.items as AuditLog[];
        else if (Array.isArray(r.data)) items = r.data as AuditLog[];
      }
      setLogs(items);
    } catch {
      // silently fail — feed is non-critical
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 30_000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-2.5 w-1/3 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Sin actividad reciente
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {userInitial(log)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${actionDotColor(log.action)}`}
              />
              <span className="text-sm font-medium truncate">
                {userName(log)}
              </span>
              <span className="text-xs text-muted-foreground">
                {actionLabel(log.action)}
              </span>
            </div>
            {log.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {log.description}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {timeAgo(log.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
