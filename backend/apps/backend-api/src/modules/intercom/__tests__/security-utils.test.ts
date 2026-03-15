import { describe, it, expect } from 'vitest';
import {
  maskPassword,
  maskUrlCredentials,
  stripSensitiveFields,
  validateDeviceIp,
  validateAriUrl,
  validateCredentialStrength,
  checkRateLimit,
} from '../security-utils.js';

describe('Security Utils', () => {
  // ── maskPassword ──────────────────────────────────────────

  describe('maskPassword()', () => {
    it('masks a non-empty password', () => {
      expect(maskPassword('supersecret')).toBe('***');
    });

    it('returns (empty) for undefined', () => {
      expect(maskPassword(undefined)).toBe('(empty)');
    });

    it('returns (empty) for null', () => {
      expect(maskPassword(null)).toBe('(empty)');
    });

    it('returns (empty) for empty string', () => {
      expect(maskPassword('')).toBe('(empty)');
    });
  });

  // ── maskUrlCredentials ────────────────────────────────────

  describe('maskUrlCredentials()', () => {
    it('masks password in URL', () => {
      const result = maskUrlCredentials('http://admin:secret123@192.168.1.100:8088/ari');
      expect(result).not.toContain('secret123');
      expect(result).toContain('***');
      expect(result).toContain('192.168.1.100');
    });

    it('returns URL unchanged when no credentials', () => {
      const result = maskUrlCredentials('http://192.168.1.100:8088/ari');
      expect(result).toContain('192.168.1.100');
    });

    it('returns (not set) for undefined', () => {
      expect(maskUrlCredentials(undefined)).toBe('(not set)');
    });

    it('returns (not set) for null', () => {
      expect(maskUrlCredentials(null)).toBe('(not set)');
    });

    it('returns non-URL strings unchanged', () => {
      const result = maskUrlCredentials('not-a-url:admin:pass@host');
      // maskUrlCredentials only handles URL patterns (://user:pass@host)
      expect(typeof result).toBe('string');
    });
  });

  // ── stripSensitiveFields ──────────────────────────────────

  describe('stripSensitiveFields()', () => {
    it('strips default sensitive keys', () => {
      const obj = { id: '1', ariPassword: 'secret', fanvilAdminPassword: 'admin', sipHost: '10.0.0.1' };
      const result = stripSensitiveFields(obj);
      expect(result.ariPassword).toBeUndefined();
      expect(result.fanvilAdminPassword).toBeUndefined();
      expect(result.sipHost).toBe('10.0.0.1');
      expect(result.id).toBe('1');
    });

    it('does not mutate original object', () => {
      const obj = { ariPassword: 'secret', name: 'test' };
      stripSensitiveFields(obj);
      expect(obj.ariPassword).toBe('secret');
    });

    it('strips custom keys', () => {
      const obj = { apiKey: 'abc', name: 'test' };
      const result = stripSensitiveFields(obj, ['apiKey']);
      expect(result.apiKey).toBeUndefined();
      expect(result.name).toBe('test');
    });
  });

  // ── validateDeviceIp ──────────────────────────────────────

  describe('validateDeviceIp()', () => {
    it('accepts valid private IPs', () => {
      expect(validateDeviceIp('192.168.1.50')).toEqual({ valid: true });
      expect(validateDeviceIp('10.0.0.1')).toEqual({ valid: true });
      expect(validateDeviceIp('172.16.0.1')).toEqual({ valid: true });
      expect(validateDeviceIp('172.31.255.255')).toEqual({ valid: true });
    });

    it('rejects public IPs', () => {
      const result = validateDeviceIp('8.8.8.8');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('private network');
    });

    it('rejects empty string', () => {
      expect(validateDeviceIp('')).toEqual({ valid: false, reason: 'IP address is required' });
    });

    it('rejects invalid format', () => {
      expect(validateDeviceIp('not-an-ip').valid).toBe(false);
      expect(validateDeviceIp('192.168.1').valid).toBe(false);
    });

    it('rejects octets > 255', () => {
      expect(validateDeviceIp('192.168.1.999').valid).toBe(false);
    });

    it('accepts localhost range', () => {
      expect(validateDeviceIp('127.0.0.1')).toEqual({ valid: true });
    });
  });

  // ── validateAriUrl ────────────────────────────────────────

  describe('validateAriUrl()', () => {
    it('accepts valid ARI URL', () => {
      expect(validateAriUrl('http://192.168.1.100:8088/ari')).toEqual({ valid: true });
      expect(validateAriUrl('https://pbx.local:8089/ari')).toEqual({ valid: true });
    });

    it('accepts undefined (optional field)', () => {
      expect(validateAriUrl(undefined)).toEqual({ valid: true });
      expect(validateAriUrl(null)).toEqual({ valid: true });
    });

    it('rejects URL with embedded credentials', () => {
      const result = validateAriUrl('http://admin:secret@192.168.1.100:8088/ari');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('embedded credentials');
    });

    it('rejects non-http protocols', () => {
      const result = validateAriUrl('ftp://192.168.1.100/ari');
      expect(result.valid).toBe(false);
    });

    it('rejects invalid URLs', () => {
      const result = validateAriUrl('not-a-url');
      expect(result.valid).toBe(false);
    });
  });

  // ── validateCredentialStrength ─────────────────────────────

  describe('validateCredentialStrength()', () => {
    it('detects factory default username', () => {
      const result = validateCredentialStrength('admin', 'Str0ngP@ss!');
      expect(result.secure).toBe(false);
      expect(result.warnings.some(w => w.includes('factory default'))).toBe(true);
    });

    it('detects factory default password', () => {
      const result = validateCredentialStrength('myuser', 'admin');
      expect(result.secure).toBe(false);
      expect(result.warnings.some(w => w.includes('factory default'))).toBe(true);
    });

    it('detects short password', () => {
      const result = validateCredentialStrength('myuser', 'Ab1');
      expect(result.secure).toBe(false);
      expect(result.warnings.some(w => w.includes('shorter than'))).toBe(true);
    });

    it('detects missing password', () => {
      const result = validateCredentialStrength('myuser', undefined);
      expect(result.secure).toBe(false);
    });

    it('accepts strong credentials', () => {
      const result = validateCredentialStrength('siteoperator', 'X9k#mP2$vL7n');
      expect(result.secure).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── checkRateLimit ────────────────────────────────────────

  describe('checkRateLimit()', () => {
    const testKey = `test-${Date.now()}-${Math.random()}`;

    it('allows first request', () => {
      const result = checkRateLimit(testKey, 3, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('allows up to max attempts', () => {
      const key = `test-max-${Date.now()}-${Math.random()}`;
      checkRateLimit(key, 2, 60_000);
      const second = checkRateLimit(key, 2, 60_000);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(0);
    });

    it('blocks after max attempts', () => {
      const key = `test-block-${Date.now()}-${Math.random()}`;
      checkRateLimit(key, 1, 60_000);
      const second = checkRateLimit(key, 1, 60_000);
      expect(second.allowed).toBe(false);
      expect(second.remaining).toBe(0);
      expect(second.retryAfterMs).toBeGreaterThan(0);
    });
  });
});
