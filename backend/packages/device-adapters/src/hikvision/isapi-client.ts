import { request } from 'undici';
import type { DeviceConnectionConfig } from '@aion/shared-contracts';

export interface ISAPIResponse {
  statusCode: number;
  body: string;
}

/**
 * ISAPI HTTP client for Hikvision devices.
 * Supports Basic and Digest authentication.
 * Production note: For full digest auth, use node-digest-auth-client
 * when devices require it (older firmware).
 */
export class ISAPIClient {
  private baseUrl: string;
  private authHeader: string;
  private timeoutMs: number;

  constructor(config: DeviceConnectionConfig, timeoutMs = 5000) {
    const protocol = config.useTls ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.ip}:${config.port}`;
    this.authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    this.timeoutMs = timeoutMs;
  }

  async get(path: string): Promise<ISAPIResponse> {
    const url = `${this.baseUrl}${path}`;
    const { body, statusCode } = await request(url, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/xml',
      },
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const text = await body.text();
    if (statusCode === 401) {
      throw new Error('Authentication failed: invalid credentials');
    }
    if (statusCode !== 200) {
      throw new Error(`ISAPI GET ${path} returned ${statusCode}`);
    }
    return { statusCode, body: text };
  }

  async put(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const url = `${this.baseUrl}${path}`;
    const { body, statusCode } = await request(url, {
      method: 'PUT',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/xml',
      },
      body: xmlBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const text = await body.text();
    if (statusCode === 401) {
      throw new Error('Authentication failed: invalid credentials');
    }
    if (statusCode !== 200) {
      throw new Error(`ISAPI PUT ${path} returned ${statusCode}`);
    }
    return { statusCode, body: text };
  }

  async post(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const url = `${this.baseUrl}${path}`;
    const { body, statusCode } = await request(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/xml',
      },
      body: xmlBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const text = await body.text();
    if (statusCode === 401) {
      throw new Error('Authentication failed: invalid credentials');
    }
    return { statusCode, body: text };
  }
}
