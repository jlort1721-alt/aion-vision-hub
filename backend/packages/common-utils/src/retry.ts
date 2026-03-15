import type pino from 'pino';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: boolean;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitter: true,
};

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponential = options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1);
  const capped = Math.min(exponential, options.maxDelayMs);

  if (!options.jitter) return capped;

  // Full jitter: random value between 0 and capped delay
  return Math.floor(Math.random() * capped);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  logger?: pino.Logger,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (opts.retryableErrors && !opts.retryableErrors(error)) {
        throw error;
      }

      if (attempt === opts.maxAttempts) {
        break;
      }

      const delay = calculateDelay(attempt, opts);
      logger?.warn({ attempt, maxAttempts: opts.maxAttempts, delayMs: delay, error }, 'Retrying after failure');
      opts.onRetry?.(attempt, error, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function createRetryPolicy(options: Partial<RetryOptions>, logger?: pino.Logger) {
  return <T>(fn: () => Promise<T>) => withRetry(fn, options, logger);
}
