/**
 * Hikvision ISAPI Event Polling Service
 *
 * Periodically queries Hikvision DVR/NVR devices for recent events using the
 * ISAPI ContentMgmt/search endpoint (simpler than long-polling alertStream).
 *
 * Supported event types: motion, intrusion, videoloss, access, lpr, tamper,
 * line_crossing, face_detected, alarm_input.
 *
 * Each device is polled independently on a 10-second interval. Events are
 * normalized and emitted through a callback, then optionally persisted to the
 * events table.
 */
import { ISAPIClient } from '@aion/device-adapters';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'hikvision-events' });

// ── Normalized Event Interface ──────────────────────────────────────────────

export interface NormalizedEvent {
  deviceId: string;
  deviceName: string;
  siteId: string;
  eventType: string; // 'motion' | 'intrusion' | 'videoloss' | 'access' | 'lpr' | 'tamper' | ...
  channelId: number;
  timestamp: string;
  plateNumber?: string; // populated for LPR events
  raw: string;
}

export type EventCallback = (event: NormalizedEvent) => void;

// ── Hikvision raw event type to normalized type map ─────────────────────────

const EVENT_TYPE_MAP: Record<string, string> = {
  // Motion detection variants
  VMD: 'motion',
  vmd: 'motion',
  VideoMotion: 'motion',
  videomotion: 'motion',
  motiondetection: 'motion',
  PIR: 'motion',

  // Line crossing
  linedetection: 'line_crossing',
  LineDetection: 'line_crossing',
  linecrossingdetection: 'line_crossing',

  // Intrusion / field detection
  fielddetection: 'intrusion',
  FieldDetection: 'intrusion',
  intrusiondetection: 'intrusion',
  regionEntrance: 'intrusion',
  regionExiting: 'intrusion',

  // Tamper / shelter
  shelteralarm: 'tamper',
  ShelterAlarm: 'tamper',
  videotampering: 'tamper',
  VideoTampering: 'tamper',

  // Video loss
  videoloss: 'videoloss',
  VideoLoss: 'videoloss',

  // Access control
  AccessControllerEvent: 'access',
  doorbell: 'access',

  // LPR / ANPR
  ANPR: 'lpr',
  anpr: 'lpr',
  vehicledetection: 'lpr',
  licensePlate: 'lpr',

  // Face detection
  facedetection: 'face_detected',
  FaceDetection: 'face_detected',
  faceSnap: 'face_detected',

  // Alarm / IO
  IO: 'alarm_input',
  io: 'alarm_input',
  alarmInput: 'alarm_input',
  AlarmInput: 'alarm_input',

  // Device / disk
  diskfull: 'device_error',
  diskerror: 'device_error',
  nicbroken: 'device_error',
};

function normalizeEventType(rawType: string): string {
  if (EVENT_TYPE_MAP[rawType]) return EVENT_TYPE_MAP[rawType];

  // Case-insensitive fallback
  const lower = rawType.toLowerCase();
  for (const [key, value] of Object.entries(EVENT_TYPE_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }

  return rawType.toLowerCase();
}

// ── XML helper ──────────────────────────────────────────────────────────────

function extractXml(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim();
}

// ── Device record shape from the query ──────────────────────────────────────

interface HikDevice {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  username: string;
  password: string;
  site_id: string;
}

// ── Per-device poll state ───────────────────────────────────────────────────

interface DevicePollState {
  timer: ReturnType<typeof setInterval>;
  lastPollTime: Date;
  client: ISAPIClient;
  device: HikDevice;
  consecutiveErrors: number;
}

// ── Main Service ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_CONSECUTIVE_ERRORS = 10;
const ERROR_BACKOFF_MS = 30_000; // 30 seconds after too many errors

class HikvisionEventService {
  private pollStates = new Map<string, DevicePollState>();
  private running = false;
  private onEvent: EventCallback | null = null;
  private tenantId: string | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start polling all Hikvision devices for the given tenant.
   * The `onEvent` callback is invoked for each normalized event detected.
   */
  async startPolling(tenantId: string, onEvent: EventCallback): Promise<void> {
    if (this.running) {
      logger.warn('Polling already running, stopping first');
      this.stopPolling();
    }

    this.running = true;
    this.onEvent = onEvent;
    this.tenantId = tenantId;

    logger.info({ tenantId }, 'Starting Hikvision event polling');

    // Initial device discovery
    await this.discoverDevices();

    // Re-discover devices every 60 seconds (handles additions/removals)
    this.discoveryTimer = setInterval(() => {
      this.discoverDevices().catch((err) => {
        logger.error({ err: (err as Error).message }, 'Device discovery failed');
      });
    }, 60_000);
  }

  /**
   * Stop all polling timers and clear state.
   */
  stopPolling(): void {
    this.running = false;

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    for (const [deviceId, state] of this.pollStates) {
      clearInterval(state.timer);
      logger.debug({ deviceId }, 'Stopped polling device');
    }

    this.pollStates.clear();
    this.onEvent = null;
    this.tenantId = null;

    logger.info('Hikvision event polling stopped');
  }

  /**
   * Query recent events from a single device since a given timestamp.
   * Useful for on-demand fetching outside the polling loop.
   */
  async getRecentEvents(
    deviceId: string,
    tenantId: string,
    since: Date,
  ): Promise<NormalizedEvent[]> {
    const device = await this.loadDevice(deviceId, tenantId);
    if (!device) return [];

    const client = this.createClient(device);
    return this.fetchEvents(client, device, since);
  }

  // ── Internal Methods ────────────────────────────────────────────────────

  /**
   * Discover Hikvision devices from the database and start/stop polling
   * for each as needed.
   */
  private async discoverDevices(): Promise<void> {
    if (!this.tenantId) return;

    const results = await db.execute(sql`
      SELECT id, name, ip_address, port, username, password, site_id
      FROM devices
      WHERE tenant_id = ${this.tenantId}
        AND brand ILIKE '%hikvision%'
        AND ip_address IS NOT NULL
        AND status != 'decommissioned'
      ORDER BY name
    `);

    const devices = results as unknown as HikDevice[];
    const currentDeviceIds = new Set(devices.map((d) => d.id));

    // Stop polling for devices no longer present
    for (const [deviceId, state] of this.pollStates) {
      if (!currentDeviceIds.has(deviceId)) {
        clearInterval(state.timer);
        this.pollStates.delete(deviceId);
        logger.info({ deviceId }, 'Device removed, stopped polling');
      }
    }

    // Start polling for new devices
    for (const device of devices) {
      if (!this.pollStates.has(device.id)) {
        this.startDevicePoll(device);
      }
    }

    logger.debug(
      { total: devices.length, active: this.pollStates.size },
      'Device discovery complete',
    );
  }

  /**
   * Load a single device record from the database.
   */
  private async loadDevice(deviceId: string, tenantId: string): Promise<HikDevice | null> {
    const results = await db.execute(sql`
      SELECT id, name, ip_address, port, username, password, site_id
      FROM devices
      WHERE id = ${deviceId} AND tenant_id = ${tenantId}
      LIMIT 1
    `);
    const rows = results as unknown as HikDevice[];
    return rows[0] ?? null;
  }

  /**
   * Create an ISAPIClient for a device record.
   */
  private createClient(device: HikDevice): ISAPIClient {
    return new ISAPIClient(
      {
        ip: device.ip_address,
        port: device.port || 8000,
        username: device.username || 'admin',
        password: device.password || '',
        brand: 'hikvision',
        useTls: false,
      },
      10_000, // 10s timeout for event queries
    );
  }

  /**
   * Start the periodic poll loop for a single device.
   */
  private startDevicePoll(device: HikDevice): void {
    const client = this.createClient(device);

    const state: DevicePollState = {
      timer: setInterval(() => this.pollDevice(device.id), POLL_INTERVAL_MS),
      lastPollTime: new Date(),
      client,
      device,
      consecutiveErrors: 0,
    };

    this.pollStates.set(device.id, state);

    logger.info(
      { deviceId: device.id, deviceName: device.name, ip: device.ip_address },
      'Started polling device',
    );
  }

  /**
   * Execute a single poll cycle for a device.
   */
  private async pollDevice(deviceId: string): Promise<void> {
    const state = this.pollStates.get(deviceId);
    if (!state || !this.running) return;

    // Back off if too many consecutive errors
    if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      // Reset error count and skip this cycle — effectively waiting for the
      // next interval plus backoff time
      state.consecutiveErrors = 0;
      logger.warn(
        { deviceId, deviceName: state.device.name },
        `Too many errors, backing off for ${ERROR_BACKOFF_MS / 1000}s`,
      );

      // Replace the timer with a slower one temporarily
      clearInterval(state.timer);
      state.timer = setTimeout(() => {
        // Restore normal polling interval
        if (this.running && this.pollStates.has(deviceId)) {
          state.timer = setInterval(
            () => this.pollDevice(deviceId),
            POLL_INTERVAL_MS,
          );
        }
      }, ERROR_BACKOFF_MS) as unknown as ReturnType<typeof setInterval>;

      return;
    }

    const since = state.lastPollTime;
    state.lastPollTime = new Date();

    try {
      const events = await this.fetchEvents(state.client, state.device, since);
      state.consecutiveErrors = 0;

      for (const event of events) {
        try {
          this.onEvent?.(event);
        } catch (cbErr) {
          logger.error(
            { err: (cbErr as Error).message, deviceId },
            'Event callback error',
          );
        }
      }

      if (events.length > 0) {
        logger.debug(
          { deviceId, count: events.length },
          'Events received from device',
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
        'Event poll failed',
      );
    }
  }

  /**
   * Query a device for events since a given timestamp using ISAPI ContentMgmt/search.
   *
   * The ISAPI search endpoint accepts an XML body with search criteria and returns
   * matching events in XML format. We parse each <searchMatchItem> to extract
   * event details.
   */
  private async fetchEvents(
    client: ISAPIClient,
    device: HikDevice,
    since: Date,
  ): Promise<NormalizedEvent[]> {
    const startTime = since.toISOString().replace('Z', '+00:00');
    const endTime = new Date().toISOString().replace('Z', '+00:00');

    // ISAPI event search request body
    const searchXml = `<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription>
  <searchID>search-${Date.now()}</searchID>
  <trackList>
    <trackID>0</trackID>
  </trackList>
  <timeSpanList>
    <timeSpan>
      <startTime>${startTime}</startTime>
      <endTime>${endTime}</endTime>
    </timeSpan>
  </timeSpanList>
  <maxResults>50</maxResults>
  <searchResultPostion>0</searchResultPostion>
  <metadataList>
    <metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>
  </metadataList>
</CMSearchDescription>`;

    const resp = await client.post('/ISAPI/ContentMgmt/search', searchXml);

    if (resp.statusCode !== 200) {
      // Some devices don't support ContentMgmt/search — try the event
      // notification log as a fallback
      return this.fetchEventsFromLog(client, device, since);
    }

    return this.parseSearchResults(resp.body, device);
  }

  /**
   * Fallback: query the event notification log instead of ContentMgmt/search.
   * Uses GET /ISAPI/Event/notification/httpHosts which lists recent events on
   * many Hikvision devices.
   *
   * A second fallback queries the alertStream snapshot if the device supports it.
   */
  private async fetchEventsFromLog(
    client: ISAPIClient,
    device: HikDevice,
    since: Date,
  ): Promise<NormalizedEvent[]> {
    try {
      const startTime = since.toISOString().replace('Z', '+00:00');
      const endTime = new Date().toISOString().replace('Z', '+00:00');

      // Try the event log search endpoint available on most NVRs
      const searchXml = `<?xml version="1.0" encoding="UTF-8"?>
<EventSearchDescription>
  <searchID>evtsearch-${Date.now()}</searchID>
  <startTime>${startTime}</startTime>
  <endTime>${endTime}</endTime>
  <maxResults>50</maxResults>
  <searchResultPostion>0</searchResultPostion>
</EventSearchDescription>`;

      const resp = await client.post('/ISAPI/Event/notification/alertStream', searchXml);

      if (resp.statusCode === 200 && resp.body.length > 0) {
        return this.parseAlertStreamChunks(resp.body, device);
      }
    } catch {
      // Device does not support this endpoint — that's expected for some models
    }

    return [];
  }

  /**
   * Parse XML results from ContentMgmt/search.
   * Each <searchMatchItem> contains event details.
   */
  private parseSearchResults(xml: string, device: HikDevice): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];

    // Match each searchMatchItem block
    const itemRegex = /<searchMatchItem>([\s\S]*?)<\/searchMatchItem>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const eventType = extractXml(itemXml, 'eventType')
        ?? extractXml(itemXml, 'metadataType')
        ?? 'unknown';
      const channelStr = extractXml(itemXml, 'trackID')
        ?? extractXml(itemXml, 'channelID')
        ?? '1';
      const timeStr = extractXml(itemXml, 'timeSpan')
        ? extractXml(
            extractXml(itemXml, 'timeSpan') ?? '',
            'startTime',
          )
        : extractXml(itemXml, 'startTime');

      const normalized = normalizeEventType(eventType);
      const channelId = parseInt(channelStr, 10) || 1;
      const timestamp = timeStr ?? new Date().toISOString();

      const event: NormalizedEvent = {
        deviceId: device.id,
        deviceName: device.name,
        siteId: device.site_id,
        eventType: normalized,
        channelId,
        timestamp,
        raw: itemXml.trim(),
      };

      // Extract plate number for LPR events
      if (normalized === 'lpr') {
        event.plateNumber =
          extractXml(itemXml, 'plateNumber')
          ?? extractXml(itemXml, 'licensePlate')
          ?? undefined;
      }

      events.push(event);
    }

    return events;
  }

  /**
   * Parse multipart/mixed alertStream response chunks.
   * Hikvision alertStream sends XML event notifications separated by boundary
   * markers like "--boundary" within the response body.
   */
  private parseAlertStreamChunks(body: string, device: HikDevice): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];

    // Split on XML event blocks — each event is wrapped in <EventNotificationAlert>
    const alertRegex = /<EventNotificationAlert>([\s\S]*?)<\/EventNotificationAlert>/g;
    let match: RegExpExecArray | null;

    while ((match = alertRegex.exec(body)) !== null) {
      const alertXml = match[1];

      const eventType = extractXml(alertXml, 'eventType') ?? 'unknown';
      const channelStr = extractXml(alertXml, 'channelID')
        ?? extractXml(alertXml, 'dynChannelID')
        ?? '1';
      const dateTime = extractXml(alertXml, 'dateTime')
        ?? extractXml(alertXml, 'activePostCount')
        ?? new Date().toISOString();

      const normalized = normalizeEventType(eventType);
      const channelId = parseInt(channelStr, 10) || 1;

      const event: NormalizedEvent = {
        deviceId: device.id,
        deviceName: device.name,
        siteId: device.site_id,
        eventType: normalized,
        channelId,
        timestamp: dateTime,
        raw: alertXml.trim(),
      };

      // Extract plate number for LPR events
      if (normalized === 'lpr') {
        event.plateNumber =
          extractXml(alertXml, 'plateNumber')
          ?? extractXml(alertXml, 'licensePlate')
          ?? undefined;
      }

      events.push(event);
    }

    return events;
  }
}

export const hikvisionEvents = new HikvisionEventService();
