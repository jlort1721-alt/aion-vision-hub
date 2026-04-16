// ============================================================
// AION — Circuit Breaker for External Services
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
// ============================================================

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  threshold?: number;
  /** Time in ms before attempting recovery (OPEN → HALF_OPEN) */
  resetTimeoutMs?: number;
  /** Optional logger for state transitions */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreakerError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is open — request rejected`);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;
  private readonly onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.name = name;
    this.threshold = options?.threshold ?? 3;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 60_000;
    this.onStateChange = options?.onStateChange;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param fn The async operation to protect
   * @param fallback Optional fallback value when circuit is open
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.transitionTo('half_open');
      } else {
        if (fallback) {
          return fallback();
        }
        throw new CircuitBreakerError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Return current circuit state for monitoring */
  getState(): { name: string; state: CircuitState; failures: number } {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
    };
  }

  /** Reset the circuit breaker to closed state */
  reset(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.transitionTo('closed');
    }
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.failures >= this.threshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.onStateChange?.(this.name, oldState, newState);
  }
}

// ── Pre-configured Instances ──────────────────────────────────

const defaultStateLogger = (name: string, from: CircuitState, to: CircuitState): void => {
  const timestamp = new Date().toISOString();
  const logFn = to === 'open' ? console.warn : console.info;
  logFn(`[CircuitBreaker] ${timestamp} "${name}" ${from} → ${to}`);
};

export const openaiCircuitBreaker = new CircuitBreaker('openai', {
  threshold: 3,
  resetTimeoutMs: 60_000,
  onStateChange: defaultStateLogger,
});

export const anthropicCircuitBreaker = new CircuitBreaker('anthropic', {
  threshold: 3,
  resetTimeoutMs: 60_000,
  onStateChange: defaultStateLogger,
});
