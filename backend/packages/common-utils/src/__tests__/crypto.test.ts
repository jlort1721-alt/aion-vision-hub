import { describe, it, expect } from 'vitest';
import { generateId, generateToken, hashSha256, encrypt, decrypt } from '../crypto.js';

describe('crypto utilities', () => {
  describe('generateId', () => {
    it('should return unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(24); // 12 random bytes = 24 hex chars
    });

    it('should support a prefix', () => {
      const id = generateId('dev');
      expect(id).toMatch(/^dev_[a-f0-9]{24}$/);
    });
  });

  describe('generateToken', () => {
    it('should return a base64url-encoded token of the correct byte length', () => {
      const token = generateToken(32);
      // 32 bytes in base64url is ceil(32 * 4/3) = 43 characters
      expect(token).toHaveLength(43);
    });

    it('should default to 32 bytes when no length is provided', () => {
      const token = generateToken();
      expect(token).toHaveLength(43);
    });

    it('should return unique tokens', () => {
      const t1 = generateToken();
      const t2 = generateToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashSha256', () => {
    it('should be deterministic', () => {
      const hash1 = hashSha256('hello');
      const hash2 = hashSha256('hello');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashSha256('hello');
      const hash2 = hashSha256('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string', () => {
      const hash = hashSha256('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('encrypt / decrypt', () => {
    it('should roundtrip successfully', () => {
      const key = 'my-secret-key';
      const plaintext = 'Hello, AION Vision Hub!';
      const ciphertext = encrypt(plaintext, key);
      const decrypted = decrypt(ciphertext, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext on each call (random IV)', () => {
      const key = 'my-secret-key';
      const plaintext = 'same input';
      const c1 = encrypt(plaintext, key);
      const c2 = encrypt(plaintext, key);
      expect(c1).not.toBe(c2);
    });

    it('should fail to decrypt with the wrong key', () => {
      const ciphertext = encrypt('secret data', 'correct-key');
      expect(() => decrypt(ciphertext, 'wrong-key')).toThrow();
    });
  });
});
