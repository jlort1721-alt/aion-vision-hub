/**
 * Hikvision ISAPI Service — Direct device control via HTTP Digest Auth
 *
 * Uses the ISAPIClient from device-adapters for digest authentication.
 * Device credentials are loaded from the database, never hardcoded.
 *
 * Capabilities:
 * - Device info & health (model, serial, firmware, HDD status)
 * - Channel enumeration
 * - Snapshot capture
 * - PTZ control (move, preset, stop)
 * - Door/relay control
 * - Event subscription (long-poll alertStream)
 * - go2rtc stream URL generation
 */
import { ISAPIClient } from '@aion/device-adapters';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'hikvision-isapi' });

export interface HikDeviceInfo {
  online: boolean;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  macAddress?: string;
  channelCount?: number;
}

export interface HikChannel {
  id: number;
  name: string;
  enabled: boolean;
}

export interface HikHDD {
  id: string;
  capacityMB: number;
  freeSpaceMB: number;
  status: string;
}

function extractXml(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
  return match?.[1];
}

export class HikvisionISAPIService {
  /** Create an ISAPIClient from database device record */
  private async getClient(deviceId: string, tenantId: string): Promise<{ client: ISAPIClient; device: Record<string, unknown> }> {
    const results = await db.execute(sql`
      SELECT id, name, ip_address, port, username, password, brand, model, site_id
      FROM devices
      WHERE id = ${deviceId} AND tenant_id = ${tenantId}
      LIMIT 1
    `);
    const device = (results as unknown as Record<string, unknown>[])[0];
    if (!device) throw new Error(`Device ${deviceId} not found`);
    if (!device.ip_address) throw new Error(`Device ${deviceId} has no IP address`);

    const client = new ISAPIClient({
      ip: device.ip_address as string,
      port: (device.port as number) || 8000,
      username: (device.username as string) || 'admin',
      password: (device.password as string) || '',
      brand: 'hikvision',
      useTls: false,
    }, 8000);

    return { client, device };
  }

  /** Test connectivity and get device info */
  async getDeviceInfo(deviceId: string, tenantId: string): Promise<HikDeviceInfo> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.get('/ISAPI/System/deviceInfo');
      return {
        online: true,
        model: extractXml(resp.body, 'model'),
        serialNumber: extractXml(resp.body, 'serialNumber'),
        firmwareVersion: extractXml(resp.body, 'firmwareVersion'),
        macAddress: extractXml(resp.body, 'macAddress'),
      };
    } catch (err) {
      logger.warn({ deviceId, err: (err as Error).message }, 'ISAPI device info failed');
      return { online: false };
    }
  }

  /** Get number of video input channels */
  async getChannels(deviceId: string, tenantId: string): Promise<HikChannel[]> {
    const { client } = await this.getClient(deviceId, tenantId);
    const resp = await client.get('/ISAPI/System/Video/inputs/channels');
    const channels: HikChannel[] = [];
    const matches = resp.body.matchAll(
      /<VideoInputChannel>.*?<id>(\d+)<\/id>.*?<inputPort>(\d+)<\/inputPort>.*?<name>(.*?)<\/name>.*?<\/VideoInputChannel>/gs
    );
    for (const m of matches) {
      channels.push({ id: parseInt(m[1]), name: m[3] || `Channel ${m[2]}`, enabled: true });
    }
    return channels;
  }

  /** Get snapshot from a specific channel (returns JPEG buffer) */
  async getSnapshot(deviceId: string, tenantId: string, channel = 1): Promise<Buffer | null> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.get(`/ISAPI/Streaming/channels/${channel}01/picture`);
      return Buffer.from(resp.body, 'binary');
    } catch (err) {
      logger.warn({ deviceId, channel, err: (err as Error).message }, 'Snapshot failed');
      return null;
    }
  }

  /** PTZ continuous move */
  async ptzMove(deviceId: string, tenantId: string, channel: number, direction: string, speed = 4): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const pan = direction === 'left' ? -speed * 10 : direction === 'right' ? speed * 10 : 0;
      const tilt = direction === 'up' ? speed * 10 : direction === 'down' ? -speed * 10 : 0;
      const zoom = direction === 'zoomIn' ? speed * 10 : direction === 'zoomOut' ? -speed * 10 : 0;

      await client.put(
        `/ISAPI/PTZCtrl/channels/${channel}/continuous`,
        `<PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`
      );
      return true;
    } catch (err) {
      logger.warn({ deviceId, direction, err: (err as Error).message }, 'PTZ move failed');
      return false;
    }
  }

  /** PTZ stop */
  async ptzStop(deviceId: string, tenantId: string, channel: number): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.put(
        `/ISAPI/PTZCtrl/channels/${channel}/continuous`,
        '<PTZData><pan>0</pan><tilt>0</tilt><zoom>0</zoom></PTZData>'
      );
      return true;
    } catch {
      return false;
    }
  }

  /** PTZ go to preset */
  async ptzPreset(deviceId: string, tenantId: string, channel: number, preset: number): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.put(
        `/ISAPI/PTZCtrl/channels/${channel}/presets/${preset}/goto`,
        '<PTZData><AbsoluteHigh/></PTZData>'
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Open door / trigger relay (for access control devices) */
  async openDoor(deviceId: string, tenantId: string, doorId = 1): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.put(
        `/ISAPI/AccessControl/RemoteControl/door/${doorId}`,
        '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>'
      );
      logger.info({ deviceId, doorId }, 'ISAPI door opened');
      return true;
    } catch (err) {
      logger.warn({ deviceId, doorId, err: (err as Error).message }, 'Door open failed');
      return false;
    }
  }

  /** Get HDD status */
  async getHDDStatus(deviceId: string, tenantId: string): Promise<HikHDD[]> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.get('/ISAPI/ContentMgmt/Storage');
      const hdds: HikHDD[] = [];
      const matches = resp.body.matchAll(
        /<hdd>.*?<id>(\d+)<\/id>.*?<capacity>(.*?)<\/capacity>.*?<freeSpace>(.*?)<\/freeSpace>.*?<status>(.*?)<\/status>.*?<\/hdd>/gs
      );
      for (const m of matches) {
        hdds.push({
          id: m[1],
          capacityMB: parseInt(m[2]) || 0,
          freeSpaceMB: parseInt(m[3]) || 0,
          status: m[4],
        });
      }
      return hdds;
    } catch {
      return [];
    }
  }

  /** Reboot the device */
  async reboot(deviceId: string, tenantId: string): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.put('/ISAPI/System/reboot', '<Reboot/>');
      logger.info({ deviceId }, 'ISAPI device rebooted');
      return true;
    } catch {
      return false;
    }
  }

  /** Generate go2rtc ISAPI stream URL for a device channel */
  async getStreamUrl(deviceId: string, tenantId: string, channel = 1, substream = true): Promise<string | null> {
    try {
      const { device } = await this.getClient(deviceId, tenantId);
      const stream = substream ? '02' : '01';
      const user = device.username as string || 'admin';
      const pass = device.password as string || '';
      const ip = device.ip_address as string;
      const port = device.port as number || 8000;
      return `isapi://${user}:${pass}@${ip}:${port}/Streaming/Channels/${channel}${stream}`;
    } catch {
      return null;
    }
  }

  /** Batch test all Hikvision devices for a tenant */
  async testAllDevices(tenantId: string): Promise<Array<{ id: string; name: string; online: boolean; model?: string }>> {
    const results = await db.execute(sql`
      SELECT id, name FROM devices
      WHERE tenant_id = ${tenantId}
        AND (brand ILIKE '%hikvision%' OR brand ILIKE '%hik%' OR manufacturer ILIKE '%hikvision%')
      ORDER BY name
    `);
    const devices = results as unknown as Array<{ id: string; name: string }>;

    const statuses = await Promise.allSettled(
      devices.map(async (d) => {
        const info = await this.getDeviceInfo(d.id, tenantId);
        return { id: d.id, name: d.name, ...info };
      })
    );

    return statuses.map((s, i) =>
      s.status === 'fulfilled'
        ? s.value
        : { id: devices[i].id, name: devices[i].name, online: false }
    );
  }
}

export const hikvisionISAPI = new HikvisionISAPIService();
