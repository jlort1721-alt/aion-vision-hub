// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Centralized Date Formatting Utilities
// Use these functions everywhere instead of raw toLocaleString()
// ═══════════════════════════════════════════════════════════

/**
 * Format a date as a full date+time string.
 * Example: "Mar 25, 2026, 04:30 PM"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Format a date as a date-only string.
 * Example: "Mar 25, 2026"
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Format a date as a time-only string.
 * Example: "04:30 PM"
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Format a date as a relative time string.
 * Example: "5m ago", "2h ago", "3d ago"
 */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();

    if (diff < 0) return formatDateTime(date); // future dates

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return formatDate(date);
  } catch {
    return '—';
  }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * Example: "12ms", "1.5s", "2m 30s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
