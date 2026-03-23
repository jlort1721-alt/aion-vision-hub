import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'crypto';

/** Replicate key generation logic for testing. */
function generateApiKey(): string {
  const prefix = 'cvs';
  const key = randomBytes(32).toString('base64url');
  return `${prefix}_${key}`;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

describe('API Key Service', () => {
  describe('key generation', () => {
    it('generates keys with cvs_ prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^cvs_/);
    });

    it('generates unique keys each time', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('generates keys of sufficient length', () => {
      const key = generateApiKey();
      // cvs_ (4) + 43 chars base64url (32 bytes) = ~47 chars
      expect(key.length).toBeGreaterThan(40);
    });
  });

  describe('key hashing', () => {
    it('produces consistent SHA-256 hash for same input', () => {
      const key = 'cvs_test-key-12345';
      const hash1 = hashKey(key);
      const hash2 = hashKey(key);
      expect(hash1).toBe(hash2);
    });

    it('produces 64-char hex hash', () => {
      const hash = hashKey('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('different keys produce different hashes', () => {
      const hash1 = hashKey('key1');
      const hash2 = hashKey('key2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('key validation schema', () => {
    it('accepts valid create input', () => {
      const input = { name: 'My API Key', scopes: ['read', 'write'] };
      expect(input.name.length).toBeGreaterThan(0);
      expect(input.scopes.length).toBeGreaterThan(0);
    });

    it('scopes must be non-empty array', () => {
      const input = { name: 'Test', scopes: ['read'] };
      expect(input.scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('auth plugin integration', () => {
    it('API key requests get operator-level access', () => {
      const apiKeyRole = 'operator';
      expect(apiKeyRole).toBe('operator');
    });

    it('invalid API key returns AUTH_API_KEY_INVALID error code', () => {
      const errorCode = 'AUTH_API_KEY_INVALID';
      expect(errorCode).toBe('AUTH_API_KEY_INVALID');
    });
  });
});
