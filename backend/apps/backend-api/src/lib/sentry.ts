// ============================================================
// AION — Sentry Error Tracking
// [HIGH-DEVOPS-004] Structured error tracking for backend
// ============================================================

let sentryAvailable = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // Dynamic import to avoid hard dependency
  // @ts-ignore — @sentry/node is optional, installed only in production
  import('@sentry/node').then((Sentry: any) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      sendDefaultPii: true,
    });
    sentryAvailable = true;
    // Sentry initialized successfully
  }).catch(() => {
    // @sentry/node not installed — skipping error tracking
  });
}

export function captureException(error: unknown, context?: Record<string, string>): void {
  if (!sentryAvailable) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    Sentry.captureException(error, context ? { tags: context } : undefined);
  } catch {
    // Sentry not available, silently skip
  }
}
