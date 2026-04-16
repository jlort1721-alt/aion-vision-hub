// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Centralized Date Formatting Utilities
// Use these functions everywhere instead of raw toLocaleString()
// ═══════════════════════════════════════════════════════════

const LOCALE_ES = 'es-CO';
const FALLBACK = '—';

function toSafeDate(date: string | number | Date | null | undefined): Date | null {
  if (date == null) return null;
  try {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Format a date as a full date+time string.
 * Example: "25 mar 2026, 04:30 p.m."
 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  const d = toSafeDate(date);
  if (!d) return FALLBACK;
  return d.toLocaleString(LOCALE_ES, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date as a date-only string.
 * Example: "25 mar 2026"
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  const d = toSafeDate(date);
  if (!d) return FALLBACK;
  return d.toLocaleDateString(LOCALE_ES, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date as a time-only string.
 * Example: "04:30 p.m."
 */
export function formatTime(date: string | number | Date | null | undefined): string {
  const d = toSafeDate(date);
  if (!d) return FALLBACK;
  return d.toLocaleTimeString(LOCALE_ES, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date as a short date string for tables/lists.
 * Example: "25/03/2026"
 */
export function formatShortDate(date: string | number | Date | null | undefined): string {
  const d = toSafeDate(date);
  if (!d) return FALLBACK;
  return d.toLocaleDateString(LOCALE_ES);
}

/**
 * Format a date as a relative time string.
 * Example: "hace 5m", "hace 2h", "hace 3d"
 */
export function formatRelative(date: string | number | Date | null | undefined): string {
  const d = toSafeDate(date);
  if (!d) return FALLBACK;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 0) return formatDateTime(date);

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;

  return formatDate(date);
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * Example: "12ms", "1.5s", "2m 30s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return FALLBACK;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Check if a date value is valid and parseable.
 */
export function isValidDate(date: string | number | Date | null | undefined): boolean {
  return toSafeDate(date) !== null;
}
