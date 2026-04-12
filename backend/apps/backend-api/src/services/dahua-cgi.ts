/**
 * Dahua CGI Service — Direct device control via HTTP Digest Auth
 *
 * Uses the DahuaRPCClient from device-adapters for digest authentication.
 * Device credentials are loaded from the database, never hardcoded.
 *
 * Capabilities:
 * - Device info & health (model, serial, firmware, storage status)
 * - Channel enumeration
 * - Snapshot capture
 * - PTZ control (move, preset, stop)
 * - Device reboot
 * - go2rtc stream URL generation (RTSP or dvrip for REGISTRO)
 */
import { DahuaRPCClient } from "@aion/device-adapters";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "dahua-cgi" });

export interface DahuaDeviceInfo {
  online: boolean;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  channelCount?: number;
  deviceType?: string;
}

export interface DahuaChannel {
  id: number;
  name: string;
  enabled: boolean;
}

export interface DahuaHDD {
  id: string;
  capacityMB: number;
  freeSpaceMB: number;
  status: string;
}

export class DahuaCGIService {
  /** Create a DahuaRPCClient from database device record */
  private async getClient(
    deviceId: string,
    tenantId: string,
  ): Promise<{ client: DahuaRPCClient; device: Record<string, unknown> }> {
    const results = await db.execute(sql`
      SELECT id, name, ip_address, port, http_port, username, password, brand, model,
             site_id, channels, connection_type, serial_number
      FROM devices
      WHERE id = ${deviceId} AND tenant_id = ${tenantId}
      LIMIT 1
    `);
    const device = (results as unknown as Record<string, unknown>[])[0];
    if (!device) throw new Error(`Device ${deviceId} not found`);
    if (!device.ip_address)
      throw new Error(`Device ${deviceId} has no IP address`);

    const client = new DahuaRPCClient(
      {
        ip: device.ip_address as string,
        port: (device.http_port as number) || (device.port as number) || 80,
        username: (device.username as string) || "admin",
        password: (device.password as string) || "",
        brand: "dahua",
        useTls: false,
      },
      8000,
    );

    return { client, device };
  }

  /** Test connectivity and get device info */
  async getDeviceInfo(
    deviceId: string,
    tenantId: string,
  ): Promise<DahuaDeviceInfo> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.get(
        "/cgi-bin/magicBox.cgi?action=getSystemInfo",
      );
      return {
        online: true,
        model: resp.data.deviceType,
        serialNumber: resp.data.serialNumber,
        firmwareVersion: resp.data.softwareVersion,
        channelCount:
          parseInt(resp.data.videoInputChannels ?? "0", 10) || undefined,
        deviceType: resp.data.deviceType,
      };
    } catch (err) {
      logger.warn(
        { deviceId, err: (err as Error).message },
        "Dahua CGI device info failed",
      );
      return { online: false };
    }
  }

  /** Get video input channels */
  async getChannels(
    deviceId: string,
    tenantId: string,
  ): Promise<DahuaChannel[]> {
    try {
      const { client, device } = await this.getClient(deviceId, tenantId);
      const resp = await client.get(
        "/cgi-bin/magicBox.cgi?action=getProductDefinition",
      );
      const videoIn = parseInt(
        resp.data.MaxVideoInputChannels ?? resp.data.videoInputChannels ?? "0",
        10,
      );
      const channelCount = videoIn || (device.channels as number) || 1;

      const channels: DahuaChannel[] = [];
      for (let i = 1; i <= channelCount; i++) {
        channels.push({ id: i, name: `Channel ${i}`, enabled: true });
      }

      // Try to get channel titles
      try {
        const titleResp = await client.get(
          "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle",
        );
        for (const [key, value] of Object.entries(titleResp.data)) {
          const match = key.match(/table\.ChannelTitle\[(\d+)\]\.Name/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const ch = channels.find((c) => c.id === idx + 1);
            if (ch && value) ch.name = value;
          }
        }
      } catch {
        // Channel titles not available on all models
      }

      return channels;
    } catch (err) {
      logger.warn(
        { deviceId, err: (err as Error).message },
        "Dahua channels query failed",
      );
      return [];
    }
  }

  /** Get snapshot from a specific channel (returns JPEG buffer) */
  async getSnapshot(
    deviceId: string,
    tenantId: string,
    channel = 1,
  ): Promise<Buffer | null> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.getBuffer(
        `/cgi-bin/snapshot.cgi?channel=${channel}`,
      );
      if (resp.statusCode !== 200) return null;
      return resp.buffer;
    } catch (err) {
      logger.warn(
        { deviceId, channel, err: (err as Error).message },
        "Dahua snapshot failed",
      );
      return null;
    }
  }

  /** PTZ continuous move */
  async ptzMove(
    deviceId: string,
    tenantId: string,
    channel: number,
    direction: string,
    speed = 5,
  ): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const actions: Record<string, string> = {
        left: "Left",
        right: "Right",
        up: "Up",
        down: "Down",
        zoomIn: "ZoomTele",
        zoomOut: "ZoomWide",
      };
      const action = actions[direction];
      if (!action) throw new Error(`Unknown PTZ direction: ${direction}`);

      await client.get(
        `/cgi-bin/ptz.cgi?action=start&channel=${channel}&code=${action}&arg1=0&arg2=${speed}&arg3=0`,
      );
      return true;
    } catch (err) {
      logger.warn(
        { deviceId, direction, err: (err as Error).message },
        "Dahua PTZ move failed",
      );
      return false;
    }
  }

  /** PTZ stop */
  async ptzStop(
    deviceId: string,
    tenantId: string,
    channel: number,
  ): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.get(
        `/cgi-bin/ptz.cgi?action=stop&channel=${channel}&code=Left`,
      );
      return true;
    } catch {
      return false;
    }
  }

  /** PTZ go to preset */
  async ptzPreset(
    deviceId: string,
    tenantId: string,
    channel: number,
    preset: number,
  ): Promise<boolean> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      await client.get(
        `/cgi-bin/ptz.cgi?action=start&channel=${channel}&code=GotoPreset&arg1=0&arg2=${preset}&arg3=0`,
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Get HDD/storage status */
  async getHDDStatus(deviceId: string, tenantId: string): Promise<DahuaHDD[]> {
    try {
      const { client } = await this.getClient(deviceId, tenantId);
      const resp = await client.get(
        "/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo",
      );
      const hdds: DahuaHDD[] = [];
      for (const [key, value] of Object.entries(resp.data)) {
        const matchCap = key.match(/info\[(\d+)\]\.Detail\[0\]\.TotalBytes/);
        if (matchCap) {
          const idx = matchCap[1];
          const totalBytes = parseInt(value, 10) || 0;
          const usedBytes =
            parseInt(
              resp.data[`info[${idx}].Detail[0].UsedBytes`] ?? "0",
              10,
            ) || 0;
          const status = resp.data[`info[${idx}].State`] ?? "unknown";
          hdds.push({
            id: idx,
            capacityMB: Math.round(totalBytes / (1024 * 1024)),
            freeSpaceMB: Math.round((totalBytes - usedBytes) / (1024 * 1024)),
            status,
          });
        }
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
      await client.get("/cgi-bin/magicBox.cgi?action=reboot");
      logger.info({ deviceId }, "Dahua device rebooted");
      return true;
    } catch {
      return false;
    }
  }

  /** Generate stream URL for a device channel */
  async getStreamUrl(
    deviceId: string,
    tenantId: string,
    channel = 1,
    substream = true,
  ): Promise<string | null> {
    try {
      const { device } = await this.getClient(deviceId, tenantId);
      const user = (device.username as string) || "admin";
      const pass = (device.password as string) || "";
      const ip = device.ip_address as string;
      const connectionType = device.connection_type as string;
      const subtype = substream ? 1 : 0;

      if (connectionType === "registro") {
        // REGISTRO devices: use dvrip:// protocol through go2rtc
        const serial = device.serial_number as string;
        return serial
          ? `dvrip://${user}:${pass}@${serial}?channel=${channel - 1}&subtype=${subtype}`
          : null;
      }

      // Direct/port-forwarded: use RTSP
      const port = (device.port as number) || 554;
      return `rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
    } catch {
      return null;
    }
  }

  /** Batch test all Dahua devices for a tenant */
  async testAllDevices(
    tenantId: string,
  ): Promise<
    Array<{ id: string; name: string; online: boolean; model?: string }>
  > {
    const results = await db.execute(sql`
      SELECT id, name FROM devices
      WHERE tenant_id = ${tenantId}
        AND brand ILIKE '%dahua%'
      ORDER BY name
    `);
    const devices = results as unknown as Array<{ id: string; name: string }>;

    const statuses = await Promise.allSettled(
      devices.map(async (d) => {
        const info = await this.getDeviceInfo(d.id, tenantId);
        return { id: d.id, name: d.name, ...info };
      }),
    );

    return statuses.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : { id: devices[i].id, name: devices[i].name, online: false },
    );
  }
}

export const dahuaCGI = new DahuaCGIService();
