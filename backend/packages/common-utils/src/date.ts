export function toISO(date: Date): string {
  return date.toISOString();
}

export function fromISO(iso: string): Date {
  return new Date(iso);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt * 1000;
}

export function secondsFromNow(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
