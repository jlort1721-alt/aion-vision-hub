import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@aion/common-utils';

describe('Device Credential Encryption (AES-256-GCM)', () => {
  const testKey = 'd7f1279f296dc6f583687e4e11650b4d32849c92dd17ab94d2e7be3b98dfa0f8';

  it('encrypts and decrypts a password correctly (round trip)', () => {
    const original = 'MyCamera!Pass123';
    const encrypted = encrypt(original, testKey);

    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // iv:tag:ciphertext format

    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const value = 'admin';
    const enc1 = encrypt(value, testKey);
    const enc2 = encrypt(value, testKey);

    expect(enc1).not.toBe(enc2); // Different IVs
    expect(decrypt(enc1, testKey)).toBe(value);
    expect(decrypt(enc2, testKey)).toBe(value);
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encrypt('secret', testKey);
    const wrongKey = 'a'.repeat(64);

    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('', testKey);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe('');
  });

  it('handles special characters and unicode', () => {
    const value = 'pässwörd@#$%^&*()日本語';
    const encrypted = encrypt(value, testKey);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(value);
  });

  it('throws on malformed ciphertext', () => {
    expect(() => decrypt('not-encrypted-text', testKey)).toThrow();
  });
});
