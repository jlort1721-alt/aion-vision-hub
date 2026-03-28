import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'go2rtc-manager' });
const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';

export class Go2RTCManager {
  /** Add a stream to go2rtc */
  async addStream(name: string, source: string): Promise<boolean> {
    try {
      const resp = await fetch(`${GO2RTC_URL}/api/streams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: { name, source } }),
      });
      logger.info({ name, source: source.replace(/:[^@]+@/, ':***@') }, 'Stream added to go2rtc');
      return resp.ok;
    } catch (err) {
      logger.error({ name, error: (err as Error).message }, 'Failed to add stream');
      return false;
    }
  }

  /** Remove a stream */
  async removeStream(name: string): Promise<boolean> {
    try {
      const resp = await fetch(`${GO2RTC_URL}/api/streams?src=${name}`, { method: 'DELETE' });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /** List all active streams */
  async listStreams(): Promise<Record<string, unknown>> {
    try {
      const resp = await fetch(`${GO2RTC_URL}/api/streams`);
      return await resp.json() as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** Register a device as a go2rtc stream using RTSP URL */
  async registerDevice(deviceSlug: string, rtspUrl: string): Promise<boolean> {
    return this.addStream(deviceSlug, rtspUrl);
  }
}

export const go2rtcManager = new Go2RTCManager();
