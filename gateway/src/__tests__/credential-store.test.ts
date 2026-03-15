import { describe, it, expect } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { vi } from 'vitest';
import { CredentialStore } from '../utils/credential-store.js';

describe('CredentialStore', () => {
  it('encrypts and decrypts a password', () => {
    const store = new CredentialStore('test-encryption-key-1234');
    const password = 'SuperSecret@123!';
    const encrypted = store.encrypt(password);
    expect(encrypted).not.toBe(password);
    expect(encrypted.length).toBeGreaterThan(0);
    const decrypted = store.decrypt(encrypted);
    expect(decrypted).toBe(password);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const store = new CredentialStore('test-key-for-iv-test');
    const a = store.encrypt('same-password');
    const b = store.encrypt('same-password');
    expect(a).not.toBe(b); // Different IVs → different output
  });

  it('encryptConfig wraps a config object', () => {
    const store = new CredentialStore('test-key-config');
    const cfg = { ip: '192.168.1.100', port: 80, username: 'admin', password: 'secret', brand: 'hikvision' };
    const encrypted = store.encryptConfig(cfg);
    expect(encrypted._encrypted).toBe(true);
    expect(encrypted.password).not.toBe('secret');
    expect(encrypted.ip).toBe('192.168.1.100');
    const decrypted = store.decryptPassword(encrypted.password);
    expect(decrypted).toBe('secret');
  });

  it('handles weak/missing encryption key with degraded mode', () => {
    const store = new CredentialStore('');
    const password = 'test123';
    const encrypted = store.encrypt(password);
    const decrypted = store.decrypt(encrypted);
    expect(decrypted).toBe(password);
  });
});
