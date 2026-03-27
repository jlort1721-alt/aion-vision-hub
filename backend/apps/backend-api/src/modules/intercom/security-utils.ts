/**
 * VoIP / Intercom Security Utilities
 *
 * Credential sanitization, validation, rate limiting helpers,
 * and audit logging for the intercom subsystem.
 */

// ── Credential Masking ───────────────────────────────────

/**
 * Mask a password for safe logging. Returns '***' if present, '(empty)' if not.
 */
export function maskPassword(password?: string | null): string {
  if (!password) return '(empty)';
  return '***';
}

/**
 * Mask credentials embedded in a URL (e.g., http://user:pass@host:port/path).
 * Returns the URL with password replaced by ***.
 */
export function maskUrlCredentials(url?: string | null): string {
  if (!url) return '(not set)';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    // Not a valid URL — mask anything that looks like user:pass@
    return url.replace(/:([^/@]+)@/, ':***@');
  }
}

/**
 * Strip sensitive fields from an object before returning in API responses.
 * Returns a shallow copy with password/secret fields removed.
 */
export function stripSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys = ['ariPassword', 'fanvilAdminPassword', 'password', 'secret', 'sipPassword'],
): Partial<T> {
  const result = { ...obj };
  for (const key of sensitiveKeys) {
    if (key in result) {
      (result as any)[key] = undefined;
    }
  }
  return result;
}

// ── Validation ────────────────────────────────────────────

const PRIVATE_IP_RANGES = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

/**
 * Validate that an IP address is plausibly a local/private network device.
 * Rejects public IPs for intercom device operations to prevent SSRF.
 */
export function validateDeviceIp(ip: string): { valid: boolean; reason?: string } {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, reason: 'IP address is required' };
  }

  const trimmed = ip.trim();

  // Basic IPv4 format check
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = trimmed.match(ipv4);
  if (!match) {
    return { valid: false, reason: 'Invalid IPv4 format' };
  }

  // Validate each octet
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10);
    if (octet < 0 || octet > 255) {
      return { valid: false, reason: `Invalid octet: ${match[i]}` };
    }
  }

  // In production, intercom devices should be on private networks
  const isPrivate = PRIVATE_IP_RANGES.some(r => r.test(trimmed));
  if (!isPrivate) {
    return { valid: false, reason: 'Device IP must be on a private network (RFC1918). Public IPs are not allowed for intercom devices.' };
  }

  return { valid: true };
}

/**
 * Validate ARI URL format. Must be http(s)://host:port/ari — no embedded credentials.
 */
export function validateAriUrl(url?: string | null): { valid: boolean; reason?: string } {
  if (!url) return { valid: true }; // Optional field

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'ARI URL must use http or https protocol' };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'ARI URL must not contain embedded credentials. Use ariUsername/ariPassword fields instead.' };
    }
    if (!parsed.pathname.includes('ari') && !parsed.pathname.endsWith('/')) {
      // Warning but not a hard failure
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'ARI URL is not a valid URL' };
  }
}

/**
 * Validate that credentials are not factory defaults.
 */
const WEAK_PASSWORDS = ['admin', 'password', '1234', '12345', '123456', 'pass', 'default', 'fanvil', 'root'];
const WEAK_USERNAMES = ['admin', 'root', 'user', 'test'];

export function validateCredentialStrength(
  username?: string,
  password?: string,
): { secure: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (username && WEAK_USERNAMES.includes(username.toLowerCase())) {
    warnings.push(`Username "${username}" is a factory default. Change it before production deployment.`);
  }

  if (password) {
    if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
      warnings.push('Password is a known factory default. Change it immediately.');
    }
    if (password.length < 8) {
      warnings.push('Password is shorter than 8 characters. Use at least 12 characters in production.');
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      warnings.push('Password should contain uppercase letters and numbers.');
    }
  } else {
    warnings.push('Password is empty. Credentials are required for device operations.');
  }

  return { secure: warnings.length === 0, warnings };
}

// ── Rate Limiting (in-memory per-action) ──────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple per-key rate limiter. Returns true if action is allowed.
 *
 * @param key - Unique key (e.g., `door-open:${tenantId}:${deviceId}`)
 * @param maxAttempts - Max attempts within the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ── Structured Logger ─────────────────────────────────────

export type SecurityEventType =
  | 'door.open'
  | 'door.open.denied'
  | 'door.open.rate_limited'
  | 'device.provision'
  | 'device.provision.failed'
  | 'device.test'
  | 'voip.config.update'
  | 'credential.weak_detected'
  | 'credential.default_detected'
  | 'sip.connection.failed'
  | 'sip.connection.success'
  | 'intercom.access.granted'
  | 'intercom.access.denied';

export interface SecurityAuditEntry {
  event: SecurityEventType;
  tenantId: string;
  userId?: string;
  deviceId?: string;
  ipAddress?: string;
  detail?: string;
  timestamp: string;
}

/**
 * Emit a structured security audit log entry.
 * In production, pipe these to a SIEM or append-only audit table.
 */
export function emitSecurityAudit(entry: Omit<SecurityAuditEntry, 'timestamp'>): void {
  const full: SecurityAuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  // Structured JSON output — can be captured by log aggregator
  console.log(JSON.stringify({ level: 'audit', ...full }));
}
