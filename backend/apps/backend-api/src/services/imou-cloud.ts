/**
 * IMOU/Dahua Cloud API Service
 * Connects to Dahua XVR devices via P2P cloud relay
 * API docs: https://open.imoulife.com/book/en/http/develop.html
 */
import { createLogger } from '@aion/common-utils';
import crypto from 'crypto';

const logger = createLogger({ name: 'imou-cloud' });

const IMOU_BASE = 'https://openapi.easy4ip.com'; // or https://openapi-sg.easy4ip.com for Singapore region

interface ImouConfig {
  appId: string;
  appSecret: string;
}

interface ImouDevice {
  deviceId: string;
  name: string;
  channels: number;
  status: string;
  ability: string;
}

export class ImouCloudService {
  private config: ImouConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      appId: process.env.IMOU_APP_ID || '',
      appSecret: process.env.IMOU_APP_SECRET || '',
    };
  }

  isConfigured(): boolean {
    return !!this.config.appId && !!this.config.appSecret;
  }

  /** Generate IMOU API signature */
  private sign(params: Record<string, string>): string {
    // IMOU uses MD5 signature: sort params alphabetically, concat, add appSecret, MD5
    const sorted = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join(',');
    const signStr = `${sorted},appSecret:${this.config.appSecret}`;
    return crypto.createHash('md5').update(signStr).digest('hex');
  }

  /** Get access token (cached, auto-refresh) */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const nonce = crypto.randomBytes(16).toString('hex');
    const time = Math.floor(Date.now() / 1000).toString();
    const id = crypto.randomUUID();

    const params: Record<string, string> = {
      time, nonce, appId: this.config.appId, id,
    };
    params.sign = this.sign(params);

    const resp = await fetch(`${IMOU_BASE}/openapi/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: { ver: '1.0', ...params }, params: {} }),
    });

    const data = await resp.json() as Record<string, unknown>;
    const result = data.result as Record<string, unknown>;
    if (result?.code !== '0') {
      logger.error({ code: result?.code, msg: result?.msg }, 'IMOU token failed');
      throw new Error(`IMOU auth failed: ${result?.msg}`);
    }

    this.accessToken = (result.data as Record<string, unknown>)?.accessToken as string;
    this.tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
    return this.accessToken;
  }

  /** List devices bound to the account */
  async listDevices(): Promise<ImouDevice[]> {
    const token = await this.getAccessToken();
    const nonce = crypto.randomBytes(16).toString('hex');
    const time = Math.floor(Date.now() / 1000).toString();
    const id = crypto.randomUUID();

    const params: Record<string, string> = {
      time, nonce, appId: this.config.appId, id, token,
    };
    params.sign = this.sign(params);

    const resp = await fetch(`${IMOU_BASE}/openapi/deviceBaseList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: { ver: '1.0', ...params },
        params: { bindId: '-1', limit: '100', type: 'bindAndShare' },
      }),
    });

    const data = await resp.json() as Record<string, unknown>;
    const result = data.result as Record<string, unknown>;
    const devices = ((result?.data as Record<string, unknown>)?.deviceList || []) as ImouDevice[];
    logger.info({ count: devices.length }, 'IMOU devices listed');
    return devices;
  }

  /** Get live stream URL for a device channel (P2P cloud relay) */
  async getLiveStreamUrl(deviceId: string, channelId: number = 0): Promise<string> {
    const token = await this.getAccessToken();
    const nonce = crypto.randomBytes(16).toString('hex');
    const time = Math.floor(Date.now() / 1000).toString();
    const id = crypto.randomUUID();

    const params: Record<string, string> = {
      time, nonce, appId: this.config.appId, id, token,
    };
    params.sign = this.sign(params);

    const resp = await fetch(`${IMOU_BASE}/openapi/realTimePlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: { ver: '1.0', ...params },
        params: { deviceId, channelId: channelId.toString(), streamId: '1' }, // 0=main, 1=sub
      }),
    });

    const data = await resp.json() as Record<string, unknown>;
    const result = data.result as Record<string, unknown>;
    const url = (result?.data as Record<string, unknown>)?.url as string;
    if (!url) throw new Error('No stream URL returned');
    return url;
  }
}

export const imouCloud = new ImouCloudService();
