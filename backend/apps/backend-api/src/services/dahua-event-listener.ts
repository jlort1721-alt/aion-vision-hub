/**
 * Dahua Event Polling Service
 *
 * Periodically queries Dahua DVR/NVR/XVR devices for recent events using the
 * CGI eventManager.cgi endpoint. For devices with direct IP, it can also use
 * HTTP long-poll (action=attach) for real-time event streaming.
 *
 * Supported event types: motion, line_crossing, intrusion, tamper, video_loss,
 * person_detected, vehicle_detected, face_detection, alarm_input.
 *
 * Each device is polled independently on a 10-second interval. Events are
 * normalized and emitted through a callback for persistence and notification.
 */
import { DahuaRPCClient } from "@aion/device-adapters";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "dahua-events" });

// ── Normalized Event Interface ──────────────────────────────────────────────

export interface DahuaNormalizedEvent {
  deviceId: string;
  deviceName: string;
  siteId: string;
  eventType: string;
  channelId: number;
  timestamp: string;
  action: "Start" | "Stop" | "Pulse";
  raw: string;
}

export type DahuaEventCallback = (event: DahuaNormalizedEvent) => void;

// ── Dahua event code → normalized type map ─────────────────────────────────

const DAHUA_EVENT_MAP: Record<string, string> = {
  VideoMotion: "motion",
  VideoMotionInfo: "motion",
  SmartMotionHuman: "person_detected",
  SmartMotionVehicle: "vehicle_detected",
  CrossLineDetection: "line_crossing",
  CrossRegionDetection: "intrusion",
  VideoBlind: "tamper",
  VideoAbnormalDetection: "tamper",
  VideoLoss: "video_loss",
  AlarmLocal: "alarm_input",
  AlarmOutput: "alarm_output",
  StorageNotExist: "device_error",
  StorageFailure: "device_error",
  StorageLowSpace: "device_warning",
  FaceDetection: "face_detection",
  FaceRecognition: "face_recognition",
  NumberStat: "people_counting",
  TrafficJunction: "lpr",
  RioterDetection: "crowd_detection",
  LeftDetection: "abandoned_object",
  TakenAwayDetection: "object_removed",
  ParkingDetection: "parking_violation",
  MoveDetection: "object_moved",
  LoginFailure: "security_alert",
  IPConflict: "device_error",
  NTPAdjustTime: "device_info",
  TimeChange: "device_info",
  Reboot: "device_info",
};

function normalizeDahuaEventType(code: string): string {
  if (DAHUA_EVENT_MAP[code]) return DAHUA_EVENT_MAP[code];
  const lower = code.toLowerCase();
  for (const [key, value] of Object.entries(DAHUA_EVENT_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  return code.toLowerCase();
}

// ── Device record shape ───────────────────────────────────────────────────

interface DahuaDevice {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  http_port: number;
  username: string;
  password: string;
  site_id: string;
  connection_type: string;
}

// ── Per-device poll state ─────────────────────────────────────────────────

interface DevicePollState {
  timer: ReturnType<typeof setInterval>;
  lastEventIndex: number;
  client: DahuaRPCClient;
  device: DahuaDevice;
  consecutiveErrors: number;
}

// ── Main Service ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;
const MAX_CONSECUTIVE_ERRORS = 10;
const ERROR_BACKOFF_MS = 30_000;

export class DahuaEventService {
  private pollStates = new Map<string, DevicePollState>();
  private running = false;
  private onEvent: DahuaEventCallback | null = null;
  private tenantId: string | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;

  /** Start polling all Dahua devices (all tenants) with default logging callback */
  async start(): Promise<void> {
    return this.startPolling(undefined, (event) => {
      logger.info(
        {
          device: event.deviceName,
          type: event.eventType,
          channel: event.channelId,
        },
        "Dahua event detected",
      );
    });
  }

  /** Start polling all Dahua devices for the given tenant */
  async startPolling(
    tenantId: string | undefined,
    onEvent: DahuaEventCallback,
  ): Promise<void> {
    if (this.running) {
      logger.warn("Dahua event polling already running, stopping first");
      this.stopPolling();
    }

    this.running = true;
    this.onEvent = onEvent;
    this.tenantId = tenantId ?? null;

    logger.info(
      { tenantId: tenantId ?? "all" },
      "Starting Dahua event polling",
    );

    await this.discoverDevices();

    this.discoveryTimer = setInterval(() => {
      this.discoverDevices().catch((err) => {
        logger.error(
          { err: (err as Error).message },
          "Dahua device discovery failed",
        );
      });
    }, 60_000);
  }

  /** Stop all polling */
  stopPolling(): void {
    this.running = false;

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    for (const [deviceId, state] of this.pollStates) {
      clearInterval(state.timer);
      logger.debug({ deviceId }, "Stopped polling Dahua device");
    }

    this.pollStates.clear();
    this.eventIndexes.clear();
    this.onEvent = null;
    this.tenantId = null;

    logger.info("Dahua event polling stopped");
  }

  /** Get status for monitoring */
  getStatus(): { running: boolean; deviceCount: number; devices: string[] } {
    return {
      running: this.running,
      deviceCount: this.pollStates.size,
      devices: Array.from(this.pollStates.values()).map((s) => s.device.name),
    };
  }

  // ── Internal Methods ──────────────────────────────────────────────────

  private async discoverDevices(): Promise<void> {
    const query = this.tenantId
      ? sql`
        SELECT id, name, ip_address, port, http_port, username, password, site_id, connection_type
        FROM devices
        WHERE tenant_id = ${this.tenantId}
          AND brand ILIKE '%dahua%'
          AND ip_address IS NOT NULL
          AND status != 'decommissioned'
        ORDER BY name`
      : sql`
        SELECT id, name, ip_address, port, http_port, username, password, site_id, connection_type
        FROM devices
        WHERE brand ILIKE '%dahua%'
          AND ip_address IS NOT NULL
          AND status != 'decommissioned'
        ORDER BY name`;
    const results = await db.execute(query);

    const devices = results as unknown as DahuaDevice[];
    const currentDeviceIds = new Set(devices.map((d) => d.id));

    // Stop polling for removed devices
    for (const [deviceId, state] of this.pollStates) {
      if (!currentDeviceIds.has(deviceId)) {
        clearInterval(state.timer);
        this.pollStates.delete(deviceId);
        logger.info({ deviceId }, "Dahua device removed, stopped polling");
      }
    }

    // Start polling for new devices (only those with direct IP access for CGI)
    for (const device of devices) {
      if (!this.pollStates.has(device.id)) {
        this.startDevicePoll(device);
      }
    }

    logger.debug(
      { total: devices.length, active: this.pollStates.size },
      "Dahua device discovery complete",
    );
  }

  private createClient(device: DahuaDevice): DahuaRPCClient {
    return new DahuaRPCClient(
      {
        ip: device.ip_address,
        port: device.http_port || device.port || 80,
        username: device.username || "admin",
        password: device.password || "",
        brand: "dahua",
        useTls: false,
      },
      10_000,
    );
  }

  private startDevicePoll(device: DahuaDevice): void {
    const client = this.createClient(device);

    const state: DevicePollState = {
      timer: setInterval(() => this.pollDevice(device.id), POLL_INTERVAL_MS),
      lastEventIndex: 0,
      client,
      device,
      consecutiveErrors: 0,
    };

    this.pollStates.set(device.id, state);

    logger.info(
      { deviceId: device.id, deviceName: device.name, ip: device.ip_address },
      "Started polling Dahua device",
    );
  }

  private async pollDevice(deviceId: string): Promise<void> {
    const state = this.pollStates.get(deviceId);
    if (!state || !this.running) return;

    if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      state.consecutiveErrors = 0;
      logger.warn(
        { deviceId, deviceName: state.device.name },
        `Too many errors, backing off for ${ERROR_BACKOFF_MS / 1000}s`,
      );

      clearInterval(state.timer);
      state.timer = setTimeout(() => {
        if (this.running && this.pollStates.has(deviceId)) {
          state.timer = setInterval(
            () => this.pollDevice(deviceId),
            POLL_INTERVAL_MS,
          );
        }
      }, ERROR_BACKOFF_MS) as unknown as ReturnType<typeof setInterval>;

      return;
    }

    try {
      const events = await this.fetchEvents(state);
      state.consecutiveErrors = 0;

      for (const event of events) {
        try {
          this.onEvent?.(event);
        } catch (cbErr) {
          logger.error(
            { err: (cbErr as Error).message, deviceId },
            "Dahua event callback error",
          );
        }
      }

      if (events.length > 0) {
        logger.debug(
          { deviceId, count: events.length },
          "Dahua events received",
        );
      }
    } catch (err) {
      state.consecutiveErrors++;
      logger.warn(
        {
          deviceId,
          deviceName: state.device.name,
          err: (err as Error).message,
          consecutiveErrors: state.consecutiveErrors,
        },
        "Dahua event poll failed",
      );
    }
  }

  /**
   * Fetch events from Dahua device using eventManager.cgi.
   * Uses getEventIndexes to detect new events since last poll.
   */
  private async fetchEvents(
    state: DevicePollState,
  ): Promise<DahuaNormalizedEvent[]> {
    const events: DahuaNormalizedEvent[] = [];

    // Query event indexes — returns counts per event type
    const resp = await state.client.get(
      "/cgi-bin/eventManager.cgi?action=getEventIndexes",
    );

    // Parse response: each line like "channels[0].EventIndexes.VideoMotion=5"
    for (const [key, value] of Object.entries(resp.data)) {
      const match = key.match(/channels\[(\d+)\]\.EventIndexes\.(\w+)/);
      if (!match) continue;

      const channelIdx = parseInt(match[1], 10);
      const eventCode = match[2];
      const eventIndex = parseInt(value, 10) || 0;

      // Only emit if index has increased (new events occurred)
      const stateKey = `${state.device.id}:${channelIdx}:${eventCode}`;
      const prevIndex = this.getEventIndex(stateKey);

      if (eventIndex > prevIndex) {
        this.setEventIndex(stateKey, eventIndex);

        // Skip on first poll (just baseline the indexes)
        if (prevIndex > 0) {
          events.push({
            deviceId: state.device.id,
            deviceName: state.device.name,
            siteId: state.device.site_id,
            eventType: normalizeDahuaEventType(eventCode),
            channelId: channelIdx + 1,
            timestamp: new Date().toISOString(),
            action: "Start",
            raw: `${eventCode}:index=${eventIndex},channel=${channelIdx}`,
          });
        }
      }
    }

    return events;
  }

  // Simple event index tracking (in-memory)
  private eventIndexes = new Map<string, number>();

  private getEventIndex(key: string): number {
    return this.eventIndexes.get(key) ?? 0;
  }

  private setEventIndex(key: string, value: number): void {
    this.eventIndexes.set(key, value);
  }
}

export const dahuaEvents = new DahuaEventService();
