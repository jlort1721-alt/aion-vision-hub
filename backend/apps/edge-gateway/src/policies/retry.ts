import { withRetry, createRetryPolicy, type RetryOptions } from '@aion/common-utils';

export { withRetry, createRetryPolicy };
export type { RetryOptions };

// Pre-configured retry policies for common operations
export const DEVICE_CONNECT_RETRY: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true,
};

export const HEALTH_CHECK_RETRY: Partial<RetryOptions> = {
  maxAttempts: 2,
  baseDelayMs: 500,
  maxDelayMs: 3000,
  backoffFactor: 2,
  jitter: false,
};

export const EVENT_FORWARD_RETRY: Partial<RetryOptions> = {
  maxAttempts: 5,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  backoffFactor: 3,
  jitter: true,
};
