/**
 * Cloud Platform Integration Service
 *
 * Integrates with Hikvision (EZVIZ/Hik-Connect) and Dahua (IMOU/DMSS)
 * cloud platforms to import devices and get live stream URLs.
 *
 * Both platforms use a similar pattern:
 * 1. Authenticate with appKey/appSecret to get accessToken
 * 2. List devices bound to the account
 * 3. Get live stream URLs (HLS) for each device
 */

// ═══════════════════════════════════════════════════════════
// EZVIZ / HIK-CONNECT INTEGRATION
// ═══════════════════════════════════════════════════════════

const EZVIZ_API = 'https://open.ezviz.com/api';

interface EzvizToken {
  accessToken: string;
  expireTime: number;
  areaDomain: string;
}

interface EzvizDevice {
  deviceSerial: string;
  deviceName: string;
  deviceType: string;
  status: number; // 1=online, 2=offline
  defence: number;
  deviceCategory: string;
  isEncrypt: number;
  model: string;
  supportTalk: number;
  supportPTZ: string;
}

interface EzvizCamera {
  deviceSerial: string;
  channelNo: number;
  channelName: string;
  status: number;
  isShared: string;
  picUrl: string;
  isEncrypt: number;
  videoLevel: number;
}

export class EzvizService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private areaDomain: string = EZVIZ_API;

  /**
   * Authenticate with EZVIZ Open Platform.
   * Requires appKey and appSecret from https://open.ezviz.com
   */
  async authenticate(appKey: string, appSecret: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${EZVIZ_API}/lapp/token/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `appKey=${encodeURIComponent(appKey)}&appSecret=${encodeURIComponent(appSecret)}`,
      });

      const data = await response.json() as { code: string; msg: string; data?: EzvizToken };

      if (data.code !== '200' || !data.data) {
        return { success: false, error: data.msg || `Error code: ${data.code}` };
      }

      this.accessToken = data.data.accessToken;
      this.tokenExpiry = data.data.expireTime;
      if (data.data.areaDomain) {
        this.areaDomain = `https://${data.data.areaDomain}/api`;
      }

      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `EZVIZ connection failed: ${msg}` };
    }
  }

  /**
   * List all devices bound to the authenticated account.
   */
  async listDevices(): Promise<{ devices: EzvizDevice[]; error?: string }> {
    if (!this.accessToken) return { devices: [], error: 'Not authenticated' };

    try {
      const response = await fetch(`${this.areaDomain}/lapp/device/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `accessToken=${this.accessToken}&pageStart=0&pageSize=200`,
      });

      const data = await response.json() as { code: string; msg: string; data?: EzvizDevice[] };

      if (data.code !== '200') {
        return { devices: [], error: data.msg };
      }

      return { devices: data.data || [] };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { devices: [], error: msg };
    }
  }

  /**
   * List cameras on a specific device (useful for NVRs with multiple channels).
   */
  async listCameras(deviceSerial: string): Promise<{ cameras: EzvizCamera[]; error?: string }> {
    if (!this.accessToken) return { cameras: [], error: 'Not authenticated' };

    try {
      const response = await fetch(`${this.areaDomain}/lapp/device/camera/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `accessToken=${this.accessToken}&deviceSerial=${deviceSerial}`,
      });

      const data = await response.json() as { code: string; msg: string; data?: EzvizCamera[] };

      if (data.code !== '200') {
        return { cameras: [], error: data.msg };
      }

      return { cameras: data.data || [] };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { cameras: [], error: msg };
    }
  }

  /**
   * Get live stream URL for a device channel.
   * Returns HLS URL that can be played directly in the browser.
   */
  async getLiveStreamUrl(deviceSerial: string, channelNo: number = 1, quality: number = 1): Promise<{ url: string | null; error?: string }> {
    if (!this.accessToken) return { url: null, error: 'Not authenticated' };

    try {
      const response = await fetch(`${this.areaDomain}/lapp/v2/live/address/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: [
          `accessToken=${this.accessToken}`,
          `deviceSerial=${deviceSerial}`,
          `channelNo=${channelNo}`,
          `protocol=2`,       // 1=ezopen, 2=HLS, 3=RTMP, 4=FLV
          `quality=${quality}`, // 1=HD, 2=smooth
          `expireTime=86400`,
        ].join('&'),
      });

      const data = await response.json() as { code: string; msg: string; data?: { url: string } };

      if (data.code !== '200' || !data.data) {
        return { url: null, error: data.msg };
      }

      return { url: data.data.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { url: null, error: msg };
    }
  }

  /**
   * Capture a snapshot from a device.
   */
  async captureSnapshot(deviceSerial: string, channelNo: number = 1): Promise<{ url: string | null; error?: string }> {
    if (!this.accessToken) return { url: null, error: 'Not authenticated' };

    try {
      const response = await fetch(`${this.areaDomain}/lapp/device/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `accessToken=${this.accessToken}&deviceSerial=${deviceSerial}&channelNo=${channelNo}`,
      });

      const data = await response.json() as { code: string; msg: string; data?: { picUrl: string } };

      if (data.code !== '200' || !data.data) {
        return { url: null, error: data.msg };
      }

      return { url: data.data.picUrl };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { url: null, error: msg };
    }
  }

  /**
   * Control PTZ (pan-tilt-zoom) on a device.
   */
  async ptzControl(deviceSerial: string, channelNo: number, direction: number, speed: number = 1): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch(`${this.areaDomain}/lapp/device/ptz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: [
          `accessToken=${this.accessToken}`,
          `deviceSerial=${deviceSerial}`,
          `channelNo=${channelNo}`,
          `direction=${direction}`, // 0=up,1=down,2=left,3=right,4=lu,5=ru,6=ld,7=rd,8=zin,9=zout
          `speed=${speed}`,
        ].join('&'),
      });

      const data = await response.json() as { code: string; msg: string };
      return { success: data.code === '200', error: data.code !== '200' ? data.msg : undefined };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async ptzStop(deviceSerial: string, channelNo: number, direction: number = 0): Promise<void> {
    if (!this.accessToken) return;
    try {
      await fetch(`${this.areaDomain}/lapp/device/ptz/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `accessToken=${this.accessToken}&deviceSerial=${deviceSerial}&channelNo=${channelNo}&direction=${direction}`,
      });
    } catch { /* best effort */ }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  }
}

// ═══════════════════════════════════════════════════════════
// IMOU / DMSS / DAHUA INTEGRATION
// ═══════════════════════════════════════════════════════════

const IMOU_API = 'https://openapi.easy4ip.com:443/openapi';

interface ImouDevice {
  deviceId: string;
  name: string;
  deviceModel: string;
  status: string; // online/offline
  channels: Array<{
    channelId: string;
    channelName: string;
    channelStatus: string;
    shareStatus: string;
  }>;
  brand: string;
  catalog: string;
  deviceVersion: string;
}

export class ImouService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Authenticate with IMOU Open Platform.
   * Requires appId and appSecret from https://open.imoulife.com
   */
  async authenticate(appId: string, appSecret: string): Promise<{ success: boolean; error?: string }> {
    try {
      const nonce = Math.random().toString(36).substring(2, 15);
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Generate sign: md5("time:" + time + ",nonce:" + nonce + ",appSecret:" + appSecret)
      const signStr = `time:${timestamp},nonce:${nonce},appSecret:${appSecret}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(signStr));
      const sign = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const response = await fetch(`${IMOU_API}/accessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: {
            ver: '1.0',
            appId,
            sign,
            time: parseInt(timestamp),
            nonce,
          },
          params: {},
        }),
      });

      const data = await response.json() as {
        result: { code: string; msg: string };
        data?: { accessToken: string; expireTime: number };
      };

      if (data.result?.code !== '0' || !data.data) {
        return { success: false, error: data.result?.msg || 'IMOU auth failed' };
      }

      this.accessToken = data.data.accessToken;
      this.tokenExpiry = Date.now() + (data.data.expireTime * 1000);

      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `IMOU connection failed: ${msg}` };
    }
  }

  /**
   * List all devices bound to the authenticated account.
   */
  async listDevices(): Promise<{ devices: ImouDevice[]; error?: string }> {
    if (!this.accessToken) return { devices: [], error: 'Not authenticated' };

    try {
      const response = await fetch(`${IMOU_API}/deviceBaseList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: { ver: '1.0' },
          params: {
            token: this.accessToken,
            bindId: '0',
            limit: '200',
            type: 'bindAndShare',
          },
        }),
      });

      const data = await response.json() as {
        result: { code: string; msg: string };
        data?: { devices: ImouDevice[] };
      };

      if (data.result?.code !== '0') {
        return { devices: [], error: data.result?.msg };
      }

      return { devices: data.data?.devices || [] };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { devices: [], error: msg };
    }
  }

  /**
   * Get live stream URL for a device.
   */
  async getLiveStreamUrl(deviceId: string, channelId: string = '0'): Promise<{ url: string | null; error?: string }> {
    if (!this.accessToken) return { url: null, error: 'Not authenticated' };

    try {
      const response = await fetch(`${IMOU_API}/bindDeviceLive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: { ver: '1.0' },
          params: {
            token: this.accessToken,
            deviceId,
            channelId,
            streamId: '0', // 0=main, 1=sub
          },
        }),
      });

      const data = await response.json() as {
        result: { code: string; msg: string };
        data?: { url: string };
      };

      if (data.result?.code !== '0' || !data.data) {
        return { url: null, error: data.result?.msg };
      }

      return { url: data.data.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { url: null, error: msg };
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  }
}

// ═══════════════════════════════════════════════════════════
// UNIFIED CLOUD DEVICE INTERFACE
// ═══════════════════════════════════════════════════════════

export interface CloudDevice {
  platform: 'ezviz' | 'imou';
  serialOrId: string;
  name: string;
  model: string;
  type: string; // camera, nvr, dvr, doorbell, accesscontrol
  status: 'online' | 'offline';
  channels: number;
  channelList: Array<{
    id: string | number;
    name: string;
    status: string;
  }>;
  capabilities: {
    ptz: boolean;
    talk: boolean;
    video: boolean;
  };
}

/**
 * Normalize EZVIZ devices to unified format.
 */
export function normalizeEzvizDevices(devices: EzvizDevice[]): CloudDevice[] {
  return devices.map(d => {
    const typeMap: Record<string, string> = {
      IPC: 'camera',
      NVR: 'nvr',
      DVR: 'dvr',
      CS: 'camera', // doorbell/cam
      DL: 'accesscontrol', // door lock
      DOORBELL: 'intercom',
    };

    return {
      platform: 'ezviz',
      serialOrId: d.deviceSerial,
      name: d.deviceName || d.deviceSerial,
      model: d.model || d.deviceType || 'Unknown',
      type: typeMap[d.deviceCategory?.toUpperCase()] || typeMap[d.deviceType?.toUpperCase()] || 'camera',
      status: d.status === 1 ? 'online' : 'offline',
      channels: 1, // will be updated from camera list
      channelList: [],
      capabilities: {
        ptz: d.supportPTZ === '1' || d.supportPTZ === 'true',
        talk: d.supportTalk === 1,
        video: true,
      },
    };
  });
}

/**
 * Normalize IMOU devices to unified format.
 */
export function normalizeImouDevices(devices: ImouDevice[]): CloudDevice[] {
  return devices.map(d => {
    const typeMap: Record<string, string> = {
      IPC: 'camera',
      NVR: 'nvr',
      DVR: 'dvr',
      CRB: 'camera', // doorbell
      DB: 'intercom',
    };

    return {
      platform: 'imou',
      serialOrId: d.deviceId,
      name: d.name || d.deviceId,
      model: d.deviceModel || 'Unknown',
      type: typeMap[d.catalog?.toUpperCase()] || 'camera',
      status: d.status === 'online' ? 'online' : 'offline',
      channels: d.channels?.length || 1,
      channelList: (d.channels || []).map(ch => ({
        id: ch.channelId,
        name: ch.channelName || `Canal ${ch.channelId}`,
        status: ch.channelStatus,
      })),
      capabilities: {
        ptz: false,
        talk: false,
        video: true,
      },
    };
  });
}

// Singleton instances per session (will be replaced by per-tenant instances)
const ezvizInstances = new Map<string, EzvizService>();
const imouInstances = new Map<string, ImouService>();

export function getEzvizInstance(tenantId: string): EzvizService {
  if (!ezvizInstances.has(tenantId)) {
    ezvizInstances.set(tenantId, new EzvizService());
  }
  return ezvizInstances.get(tenantId)!;
}

export function getImouInstance(tenantId: string): ImouService {
  if (!imouInstances.has(tenantId)) {
    imouInstances.set(tenantId, new ImouService());
  }
  return imouInstances.get(tenantId)!;
}
