/**
 * Dahua REGISTRO Monitor — Detects Dahua devices connected via Active Registration (dvrip)
 *
 * Polls go2rtc API to find dvrip-connected devices, matches them against
 * the devices table by serial number, and auto-registers their channels
 * as go2rtc streams for live viewing.
 *
 * Replaces IMOU Cloud P2P dependency with self-hosted REGISTRO protocol.
 */
import { createLogger } from "@aion/common-utils";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { go2rtcManager } from "./go2rtc-manager.js";

const logger = createLogger({ name: "dahua-registro-monitor" });

const GO2RTC_URL = process.env.GO2RTC_URL || "http://localhost:1984";
const POLL_INTERVAL = parseInt(
  process.env.REGISTRO_POLL_INTERVAL || "30000",
  10,
);

interface RegistroDevice {
  serial: string;
  deviceId: string;
  name: string;
  channels: number;
  username: string;
  password: string;
  siteId: string;
  connectionType: string;
}

interface Go2rtcStream {
  producers?: Array<{ url?: string; medias?: unknown[] }>;
  consumers?: Array<unknown>;
}

export class DahuaRegistroMonitor {
  private pollTimer: NodeJS.Timeout | null = null;
  private running = false;
  private cycleCount = 0;
  private lastPollAt: Date | null = null;
  private connectedDevices = new Map<
    string,
    { serial: string; channels: number; registeredAt: Date }
  >();
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPollResult: {
    total: number;
    connected: number;
    streams: number;
    errors: number;
  } | null = null;

  /** Check if REGISTRO mode is enabled */
  isEnabled(): boolean {
    const mode = process.env.DAHUA_MODE || "registro";
    return mode === "registro" || mode === "hybrid";
  }

  async start(intervalMs = POLL_INTERVAL): Promise<void> {
    if (!this.isEnabled()) {
      logger.info(
        "REGISTRO monitor disabled (DAHUA_MODE is not registro/hybrid)",
      );
      return;
    }

    this.running = true;
    logger.info(
      { interval: `${intervalMs / 1000}s` },
      "Dahua REGISTRO monitor starting",
    );

    // Initial poll with short delay
    this.initialTimer = setTimeout(() => {
      this.initialTimer = null;
      this.pollRegistroDevices().catch((err) => {
        logger.error(
          { err: (err as Error).message },
          "Initial REGISTRO poll failed",
        );
      });
    }, 5000);

    this.pollTimer = setInterval(() => {
      this.pollRegistroDevices().catch((err) => {
        logger.error(
          { err: (err as Error).message },
          "REGISTRO poll cycle failed",
        );
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    this.connectedDevices.clear();
    logger.info("Dahua REGISTRO monitor stopped");
  }

  /** Main poll cycle: check go2rtc for dvrip streams, match with DB, register channels */
  async pollRegistroDevices(): Promise<{
    total: number;
    connected: number;
    streams: number;
    errors: number;
  }> {
    const startTime = Date.now();
    this.cycleCount++;
    let connected = 0;
    let totalStreams = 0;
    let errorCount = 0;

    try {
      // 1. Get all streams from go2rtc
      const go2rtcStreams = await this.fetchGo2rtcStreams();

      // 2. Find dvrip-connected streams (active producers with dvrip:// source)
      const dvripSerials = this.extractDvripSerials(go2rtcStreams);

      // 3. Load Dahua devices from database
      const dahuaDevices = await this.loadDahuaDevices();
      const dbSerials = new Set(dahuaDevices.map((d) => d.serial));

      // 3b. Clean connectedDevices of entries removed from DB
      for (const serial of this.connectedDevices.keys()) {
        if (!dbSerials.has(serial)) {
          this.connectedDevices.delete(serial);
        }
      }

      // 4. For each connected device, ensure all channels are registered
      for (const device of dahuaDevices) {
        try {
          const isConnected =
            dvripSerials.has(device.serial) ||
            this.hasActiveStreams(go2rtcStreams, device.name);

          if (isConnected) {
            connected++;
            const registered = await this.ensureChannelsRegistered(device);
            totalStreams += registered;

            // Update device status in DB
            await this.updateDeviceStatus(device.deviceId, true);

            if (!this.connectedDevices.has(device.serial)) {
              this.connectedDevices.set(device.serial, {
                serial: device.serial,
                channels: device.channels,
                registeredAt: new Date(),
              });
              logger.info(
                { device: device.name, serial: device.serial },
                "REGISTRO device connected",
              );
            }
          } else {
            // Device not connected via REGISTRO
            if (this.connectedDevices.has(device.serial)) {
              this.connectedDevices.delete(device.serial);
              await this.updateDeviceStatus(device.deviceId, false);
              logger.warn(
                { device: device.name, serial: device.serial },
                "REGISTRO device disconnected",
              );
            }
          }
        } catch (err) {
          errorCount++;
          logger.error(
            { device: device.name, err: (err as Error).message },
            "REGISTRO device processing failed",
          );
        }
      }

      const elapsed = Date.now() - startTime;
      this.lastPollAt = new Date();
      this.lastPollResult = {
        total: dahuaDevices.length,
        connected,
        streams: totalStreams,
        errors: errorCount,
      };

      logger.info(
        {
          cycle: this.cycleCount,
          devices: `${connected}/${dahuaDevices.length}`,
          streams: totalStreams,
          errors: errorCount,
          elapsed: `${elapsed}ms`,
        },
        "REGISTRO poll cycle complete",
      );

      return {
        total: dahuaDevices.length,
        connected,
        streams: totalStreams,
        errors: errorCount,
      };
    } catch (err) {
      logger.error(
        { err: (err as Error).message, cycle: this.cycleCount },
        "REGISTRO poll failed",
      );
      return { total: 0, connected: 0, streams: 0, errors: 1 };
    }
  }

  /** Fetch all streams from go2rtc API */
  private async fetchGo2rtcStreams(): Promise<Record<string, Go2rtcStream>> {
    try {
      const resp = await fetch(`${GO2RTC_URL}/api/streams`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return {};
      return (await resp.json()) as Record<string, Go2rtcStream>;
    } catch {
      return {};
    }
  }

  /** Extract serial numbers from dvrip-connected streams */
  private extractDvripSerials(
    streams: Record<string, Go2rtcStream>,
  ): Set<string> {
    const serials = new Set<string>();
    for (const stream of Object.values(streams)) {
      for (const producer of stream.producers ?? []) {
        const url = producer.url ?? "";
        if (url.startsWith("dvrip://")) {
          // Extract serial from dvrip://user:pass@SERIAL?...
          const match = url.match(/dvrip:\/\/[^@]+@([^?/]+)/);
          if (match) serials.add(match[1]);
        }
      }
    }
    return serials;
  }

  /** Check if a device has active streams by its naming convention (da-{name}-ch*) */
  private hasActiveStreams(
    streams: Record<string, Go2rtcStream>,
    deviceName: string,
  ): boolean {
    const prefix = `da-${deviceName}-`;
    for (const [key, stream] of Object.entries(streams)) {
      if (key.startsWith(prefix) && (stream.producers?.length ?? 0) > 0) {
        return true;
      }
    }
    return false;
  }

  /** Load all Dahua devices from the database */
  private async loadDahuaDevices(): Promise<RegistroDevice[]> {
    const results = await db.execute(sql`
      SELECT id, name, serial_number, channels, username, password, site_id, connection_type
      FROM devices
      WHERE brand ILIKE '%dahua%'
        AND serial_number IS NOT NULL
        AND serial_number != ''
      ORDER BY name
    `);
    const rows = results as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      serial: r.serial_number as string,
      deviceId: r.id as string,
      name: r.name as string,
      channels: (r.channels as number) || 8,
      username: (r.username as string) || "admin",
      password: (r.password as string) || "",
      siteId: r.site_id as string,
      connectionType: (r.connection_type as string) || "registro",
    }));
  }

  /** Register all channels of a device as go2rtc streams + ensure cameras table entries */
  private async ensureChannelsRegistered(
    device: RegistroDevice,
  ): Promise<number> {
    let registered = 0;
    for (let ch = 1; ch <= device.channels; ch++) {
      const streamKey = `da-${device.name}-ch${ch}`;
      // Use subtype=1 (substream) for wall view — lower bandwidth
      const source = `dvrip://${device.username}:${device.password}@${device.serial}?channel=${ch - 1}&subtype=1`;
      const ok = await go2rtcManager.addStream(streamKey, source);
      if (ok) registered++;
    }

    // Auto-sync: ensure cameras exist in the cameras table for frontend display
    await this.ensureCamerasInDB(device);

    return registered;
  }

  /** Ensure all channels of a device have entries in the cameras table */
  private async ensureCamerasInDB(device: RegistroDevice): Promise<void> {
    try {
      // Get tenant_id from the device record
      const tenantResult = await db.execute(sql`
        SELECT tenant_id FROM devices WHERE id = ${device.deviceId} LIMIT 1
      `);
      const tenantRow = (
        tenantResult as unknown as Record<string, unknown>[]
      )[0];
      if (!tenantRow) return;
      const tenantId = tenantRow.tenant_id as string;

      for (let ch = 1; ch <= device.channels; ch++) {
        const streamKey = `da-${device.name}-ch${ch}`;

        // UPSERT: insert if not exists, update status if exists
        await db.execute(sql`
          INSERT INTO cameras (id, tenant_id, device_id, site_id, name, channel_number, stream_key, brand, is_lpr, is_ptz, status, created_at, updated_at)
          VALUES (
            gen_random_uuid(),
            ${tenantId},
            ${device.deviceId},
            ${device.siteId},
            ${device.name} || ' Ch' || ${ch}::text,
            ${ch},
            ${streamKey},
            'dahua',
            false,
            false,
            'online',
            NOW(),
            NOW()
          )
          ON CONFLICT (stream_key) DO UPDATE SET
            status = 'online',
            last_seen = NOW(),
            updated_at = NOW()
        `);
      }
    } catch (err) {
      logger.warn(
        { device: device.name, err: (err as Error).message },
        "Failed to auto-sync cameras in DB",
      );
    }
  }

  /** Update device online status and last_seen in database */
  private async updateDeviceStatus(
    deviceId: string,
    online: boolean,
  ): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE devices
        SET status = ${online ? "online" : "offline"},
            last_seen = ${online ? sql`NOW()` : sql`last_seen`},
            updated_at = NOW()
        WHERE id = ${deviceId}
      `);
    } catch (err) {
      logger.error(
        { deviceId, err: (err as Error).message },
        "Failed to update device status",
      );
    }
  }

  /** Health status for monitoring */
  getStatus(): {
    running: boolean;
    enabled: boolean;
    connectedDevices: number;
    cycleCount: number;
    lastPollAt: string | null;
    lastResult: {
      total: number;
      connected: number;
      streams: number;
      errors: number;
    } | null;
    devices: Array<{ serial: string; channels: number; registeredAt: string }>;
  } {
    return {
      running: this.running,
      enabled: this.isEnabled(),
      connectedDevices: this.connectedDevices.size,
      cycleCount: this.cycleCount,
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
      lastResult: this.lastPollResult,
      devices: Array.from(this.connectedDevices.values()).map((d) => ({
        ...d,
        registeredAt: d.registeredAt.toISOString(),
      })),
    };
  }
}

export const dahuaRegistroMonitor = new DahuaRegistroMonitor();
