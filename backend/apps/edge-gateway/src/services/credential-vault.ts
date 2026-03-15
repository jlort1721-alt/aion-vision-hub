import type pino from 'pino';
import { encrypt, decrypt } from '@aion/common-utils';
import { config } from '../config/env.js';

/**
 * Secure credential vault for device credentials.
 * Stores encrypted credential references — never exposes plaintext passwords
 * in API responses or logs.
 */
export class CredentialVault {
  private credentials = new Map<string, string>();
  private encryptionKey: string;
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'credential-vault' });
    this.encryptionKey = config.CREDENTIAL_ENCRYPTION_KEY ?? config.JWT_SECRET;
  }

  store(deviceId: string, username: string, password: string): string {
    const plaintext = JSON.stringify({ username, password });
    const encrypted = encrypt(plaintext, this.encryptionKey);
    const ref = `cred:${deviceId}`;
    this.credentials.set(ref, encrypted);
    this.logger.debug({ deviceId, ref }, 'Credentials stored');
    return ref;
  }

  retrieve(ref: string): { username: string; password: string } | null {
    const encrypted = this.credentials.get(ref);
    if (!encrypted) return null;

    try {
      const plaintext = decrypt(encrypted, this.encryptionKey);
      return JSON.parse(plaintext);
    } catch (err) {
      this.logger.error({ ref, err }, 'Failed to decrypt credentials');
      return null;
    }
  }

  revoke(ref: string): void {
    this.credentials.delete(ref);
    this.logger.debug({ ref }, 'Credentials revoked');
  }

  has(ref: string): boolean {
    return this.credentials.has(ref);
  }
}
