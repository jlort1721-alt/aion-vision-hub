/**
 * Hik-Connect Cloud Service -- P2P streaming without port forwarding
 * Requires registration at tpp.hikvision.com for AK/SK credentials
 * API: https://open.hikvision.com/artemis/api/
 */
import crypto from 'crypto';
import { createLogger } from '@aion/common-utils';

const _logger = createLogger({ name: 'hikconnect' });

export class HikConnectService {
  private ak: string;
  private sk: string;
  private baseUrl: string;

  constructor() {
    this.ak = process.env.HIKCONNECT_AK || '';
    this.sk = process.env.HIKCONNECT_SK || '';
    this.baseUrl = process.env.HIKCONNECT_URL || 'https://open.hikvision.com';
  }

  isConfigured(): boolean {
    return !!this.ak && !!this.sk;
  }

  private sign(method: string, path: string, body: string = ''): Record<string, string> {
    const timestamp = Date.now().toString();
    const _nonce = crypto.randomBytes(8).toString('hex');
    const contentMD5 = body ? crypto.createHash('md5').update(body).digest('base64') : '';
    const stringToSign = [method.toUpperCase(), contentMD5, 'application/json', timestamp, path].join('\n');
    const signature = crypto.createHmac('sha256', this.sk).update(stringToSign).digest('base64');
    return { timestamp, Authorization: `HMAC-SHA256 ak=${this.ak}, signature=${signature}` };
  }

  async getDevices(pageNo = 1, pageSize = 100): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) return { error: 'HikConnect not configured. Set HIKCONNECT_AK and HIKCONNECT_SK.' };
    const path = '/api/resource/v2/camera/search';
    const body = JSON.stringify({ pageNo, pageSize });
    const headers = this.sign('POST', path, body);
    try {
      const resp = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      return await resp.json() as Record<string, unknown>;
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async getPreviewURL(cameraIndexCode: string, protocol = 'rtsp'): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const path = '/api/video/v2/cameras/previewURLs';
    const body = JSON.stringify({ cameraIndexCode, protocol, streamType: 0, transmode: 1 });
    const headers = this.sign('POST', path, body);
    try {
      const resp = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      const data = await resp.json() as Record<string, unknown>;
      return ((data as Record<string, unknown>).data as Record<string, unknown>)?.url as string || null;
    } catch {
      return null;
    }
  }

  async ptzControl(cameraIndexCode: string, action: string, speed = 50): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const path = '/api/video/v2/ptzs/controlling';
    const body = JSON.stringify({ cameraIndexCode, action, speed });
    const headers = this.sign('PUT', path, body);
    try {
      await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const hikConnect = new HikConnectService();
