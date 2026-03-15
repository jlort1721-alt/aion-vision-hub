import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * CredentialStore — encrypts device credentials at rest in memory.
 *
 * Why: Device passwords live in the DeviceManager's Map. If the process
 * memory is ever dumped (core dump, heap snapshot, logging accident),
 * plaintext passwords would be exposed. This store encrypts them with
 * AES-256-GCM using a key derived from the CREDENTIAL_ENCRYPTION_KEY env var.
 *
 * STUB NOTE: This protects memory-at-rest only. For full security,
 * credentials should be stored in Vault/KMS and fetched on demand.
 * That integration is out of scope without a Vault instance to test against.
 */
export class CredentialStore {
  private masterKey: Buffer;

  constructor(encryptionKey: string) {
    if (!encryptionKey || encryptionKey.length < 16) {
      logger.warn('CREDENTIAL_ENCRYPTION_KEY is weak or missing — credentials stored with degraded encryption');
      // Derive a key from whatever we have, even if weak
      encryptionKey = encryptionKey || 'aion-default-key-change-me';
    }
    const salt = Buffer.from('aion-gateway-credential-salt');
    this.masterKey = scryptSync(encryptionKey, salt, KEY_LENGTH);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: base64(iv + tag + ciphertext)
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(encoded: string): string {
    const data = Buffer.from(encoded, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  /**
   * Encrypt a DeviceConnectionConfig's password field.
   * Returns a new config with encrypted password.
   */
  encryptConfig<T extends { password: string }>(config: T): T & { _encrypted: true } {
    return {
      ...config,
      password: this.encrypt(config.password),
      _encrypted: true as const,
    };
  }

  /**
   * Decrypt a DeviceConnectionConfig's password field.
   */
  decryptPassword(encryptedPassword: string): string {
    return this.decrypt(encryptedPassword);
  }
}
