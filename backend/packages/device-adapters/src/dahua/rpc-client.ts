import { request } from 'undici';
import type { DeviceConnectionConfig } from '@aion/shared-contracts';

export interface CGIResponse {
  statusCode: number;
  data: Record<string, string>;
  raw: string;
}

/**
 * Dahua CGI/RPC HTTP client.
 * Parses Dahua's key=value response format.
 */
export class DahuaRPCClient {
  private baseUrl: string;
  private authHeader: string;
  private timeoutMs: number;

  constructor(config: DeviceConnectionConfig, timeoutMs = 5000) {
    const protocol = config.useTls ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.ip}:${config.port}`;
    this.authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    this.timeoutMs = timeoutMs;
  }

  async get(path: string): Promise<CGIResponse> {
    const url = `${this.baseUrl}${path}`;
    const { body, statusCode } = await request(url, {
      method: 'GET',
      headers: { Authorization: this.authHeader },
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const raw = await body.text();

    if (statusCode === 401) {
      throw new Error('Authentication failed: invalid credentials');
    }
    if (statusCode !== 200) {
      throw new Error(`Dahua CGI ${path} returned ${statusCode}`);
    }

    return { statusCode, data: this.parseKeyValue(raw), raw };
  }

  private parseKeyValue(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }
}
