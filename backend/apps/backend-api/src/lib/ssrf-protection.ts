// ============================================================
// AION — SSRF Protection Utility
// [HIGH-BACK-004/005] Prevent Server-Side Request Forgery
// ============================================================

import { isIP } from 'net';
import dns from 'dns/promises';

const BLOCKED_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/,
];

/** Check if an IP address is in a private or loopback range */
export function isPrivateOrLoopback(ip: string): boolean {
  return BLOCKED_RANGES.some(r => r.test(ip));
}

/**
 * Validate that a target host resolves to a public IP address.
 * Prevents SSRF by blocking private/loopback/link-local addresses.
 * Also prevents DNS rebinding by resolving the hostname first.
 */
export async function validateExternalTarget(host: string): Promise<string> {
  let ip = host;
  if (!isIP(host)) {
    const addresses = await dns.resolve4(host);
    if (addresses.length === 0) throw new Error(`DNS resolution failed for ${host}`);
    ip = addresses[0];
  }
  if (isPrivateOrLoopback(ip)) {
    throw new Error(`Blocked: target resolves to private/loopback address ${ip}`);
  }
  return ip;
}

/** Whitelist of allowed proxy paths for remote device access */
export const ALLOWED_PROXY_PATHS = [
  /^\/ISAPI\//,
  /^\/cgi-bin\//,
  /^\/onvif\//,
  /^\/api\//,
  /^\/SDK\//,
  /^\/doc\//,
];

export function isAllowedProxyPath(path: string): boolean {
  return ALLOWED_PROXY_PATHS.some(r => r.test(path));
}
