import { request } from 'undici';
import { digestRequest, clearDigestCache } from '../../utils/digest-auth.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';
import type {
  IDeviceAdapter,
  IStreamAdapter,
  IDiscoveryAdapter,
  IHealthAdapter,
  IPTZAdapter,
  IPlaybackAdapter,
  IEventAdapter,
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  DiscoveredDevice,
  DeviceIdentity,
  DeviceCapabilities,
  StreamProfile,
  StreamState,
  DeviceHealthReport,
  PTZCommand,
  PTZPreset,
  RecordingSearchResult,
  RecordingSegment,
  DeviceEvent,
  EventCallback,
} from '../types.js';

interface HikConnection {
  config: DeviceConnectionConfig;
  state: StreamState;
  identity: DeviceIdentity | null;
  capabilities: DeviceCapabilities | null;
  streamProfiles: StreamProfile[];
  eventAbortController?: AbortController;
}

/**
 * Hikvision ISAPI adapter.
 *
 * Implements real Digest Auth HTTP communication with Hikvision devices.
 * Tested against ISAPI 2.0+ firmware (DS-2CD, DS-7600, DS-7700 series).
 *
 * ISAPI reference endpoints:
 *   GET /ISAPI/System/deviceInfo         → device identity
 *   GET /ISAPI/System/capabilities       → feature matrix
 *   GET /ISAPI/Streaming/channels        → stream profiles (codec, resolution, fps)
 *   GET /ISAPI/System/status             → health (CPU, memory, uptime)
 *   PUT /ISAPI/PTZCtrl/channels/{ch}/continuous → PTZ move
 *   GET /ISAPI/PTZCtrl/channels/{ch}/presets    → PTZ presets
 *   POST /ISAPI/ContentMgmt/search       → recording search
 *   GET /ISAPI/Event/notification/alertStream → server-sent event stream
 */
export class HikvisionAdapter
  implements IDeviceAdapter, IStreamAdapter, IDiscoveryAdapter, IHealthAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'hikvision';
  readonly supportedProtocols = ['isapi', 'rtsp', 'onvif'];

  private connections = new Map<string, HikConnection>();

  // ── IDeviceAdapter ──

  async connect(cfg: DeviceConnectionConfig): Promise<ConnectionResult> {
    const deviceId = `hik-${cfg.ip}:${cfg.port}`;
    const timeoutMs = config.DEVICE_CONNECT_TIMEOUT_MS;

    try {
      // 1. Fetch device identity via Digest Auth
      const infoXml = await this.isapiGet(cfg, '/ISAPI/System/deviceInfo', timeoutMs);
      const identity = this.parseDeviceInfo(infoXml);

      // 2. Query real capabilities
      let capabilities: DeviceCapabilities | null = null;
      try {
        capabilities = await this.queryCapabilities(cfg, timeoutMs);
      } catch (capErr) {
        logger.warn({ deviceId, err: capErr }, 'Failed to query full capabilities, using defaults');
        capabilities = this.defaultCapabilities();
      }

      // 3. Query real stream profiles
      let streamProfiles: StreamProfile[] = [];
      try {
        streamProfiles = await this.queryStreamProfiles(cfg, timeoutMs);
      } catch (streamErr) {
        logger.warn({ deviceId, err: streamErr }, 'Failed to query stream profiles, using computed defaults');
        streamProfiles = this.computeDefaultStreams(cfg);
      }

      this.connections.set(deviceId, {
        config: cfg,
        state: 'live',
        identity,
        capabilities,
        streamProfiles,
      });

      logger.info(
        { deviceId, model: identity.model, serial: identity.serial, channels: capabilities?.channels },
        'Hikvision device connected',
      );

      return {
        success: true,
        message: `Connected to ${identity.model} (${identity.serial})`,
        sessionId: deviceId,
        capabilities: capabilities ?? undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      logger.error({ deviceId, err: msg }, 'Hikvision connection failed');
      this.connections.set(deviceId, {
        config: cfg,
        state: 'failed',
        identity: null,
        capabilities: null,
        streamProfiles: [],
      });
      return { success: false, message: msg };
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.eventAbortController?.abort();
      clearDigestCache(`${conn.config.ip}:${conn.config.port}`, conn.config.username);
      this.connections.delete(deviceId);
      logger.info({ deviceId }, 'Hikvision device disconnected');
    }
  }

  async testConnection(cfg: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const infoXml = await this.isapiGet(cfg, '/ISAPI/System/deviceInfo', config.DEVICE_CONNECT_TIMEOUT_MS);
      const identity = this.parseDeviceInfo(infoXml);

      let capabilities: DeviceCapabilities;
      try {
        capabilities = await this.queryCapabilities(cfg, config.DEVICE_CONNECT_TIMEOUT_MS);
      } catch {
        capabilities = this.defaultCapabilities();
      }

      return {
        success: true,
        message: `Connected to ${identity.model}`,
        latencyMs: Date.now() - start,
        capabilities,
        deviceInfo: identity,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  // ── IStreamAdapter ──

  async getStreams(deviceId: string): Promise<StreamProfile[]> {
    const conn = this.connections.get(deviceId);
    if (!conn) return [];
    if (conn.streamProfiles.length > 0) return conn.streamProfiles;
    try {
      conn.streamProfiles = await this.queryStreamProfiles(conn.config, config.DEVICE_REQUEST_TIMEOUT_MS);
      return conn.streamProfiles;
    } catch {
      return this.computeDefaultStreams(conn.config);
    }
  }

  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel = 1): string {
    const conn = this.connections.get(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    // Hikvision RTSP: Channels/{channel}0{streamType} → 101=ch1main, 102=ch1sub
    const streamNum = type === 'main' ? 1 : 2;
    const ch = `${channel}0${streamNum}`;
    return `rtsp://${username}:${password}@${ip}:554/Streaming/Channels/${ch}`;
  }

  getStreamState(deviceId: string): StreamState {
    return this.connections.get(deviceId)?.state ?? 'idle';
  }

  // ── IDiscoveryAdapter ──

  async discover(_networkRange: string, _timeout = 5000): Promise<DiscoveredDevice[]> {
    /**
     * STUB: Hikvision SADP (Search Active Device Protocol)
     *
     * SADP sends UDP multicast to 239.255.255.250:37020 with a proprietary
     * XML payload. Devices respond with model, serial, MAC, firmware, IP.
     *
     * NOT implemented because:
     *   - Requires same-subnet multicast access (not available in all Docker setups)
     *   - SADP protocol is undocumented / reverse-engineered
     *   - ONVIF WS-Discovery covers 90%+ of Hikvision devices
     *
     * For field testing, use ONVIF discovery as primary.
     */
    logger.debug('SADP discovery not implemented — use ONVIF WS-Discovery');
    return [];
  }

  async identify(ip: string, port: number): Promise<DeviceIdentity | null> {
    try {
      const res = await digestRequest({
        url: `http://${ip}:${port}/ISAPI/System/deviceInfo`,
        method: 'GET',
        username: 'admin',
        password: '',
        timeoutMs: 3000,
      });
      if (res.statusCode === 200) {
        return this.parseDeviceInfo(res.body);
      }
      // 401 means ISAPI responded → it's a Hikvision device, just needs auth
      if (res.statusCode === 401) {
        return { brand: 'hikvision', model: 'Unknown (auth required)', serial: '', firmware: '' };
      }
    } catch {
      // Not a Hikvision device
    }
    return null;
  }

  // ── IHealthAdapter ──

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const conn = this.connections.get(deviceId);
    if (!conn) return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date().toISOString() };

    const start = Date.now();
    try {
      const statusXml = await this.isapiGet(conn.config, '/ISAPI/System/status', config.DEVICE_REQUEST_TIMEOUT_MS);

      const cpuUsage = this.extractXmlNumber(statusXml, 'cpuUtilization');
      const memoryUsage = this.extractXmlNumber(statusXml, 'memoryUsage');

      let storageUsage: number | undefined;
      try {
        const storageXml = await this.isapiGet(conn.config, '/ISAPI/ContentMgmt/Storage', config.DEVICE_REQUEST_TIMEOUT_MS);
        const totalCap = this.extractXmlNumber(storageXml, 'capacity');
        const freeCap = this.extractXmlNumber(storageXml, 'freeSpace');
        if (totalCap && freeCap) {
          storageUsage = Math.round(((totalCap - freeCap) / totalCap) * 100);
        }
      } catch {
        // Storage endpoint may not exist on all devices
      }

      conn.state = 'live';
      return {
        online: true,
        latencyMs: Date.now() - start,
        cpuUsage,
        memoryUsage,
        storageUsage,
        errors: [],
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      conn.state = 'failed';
      return {
        online: false,
        latencyMs: Date.now() - start,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        lastChecked: new Date().toISOString(),
      };
    }
  }

  async ping(ip: string, port: number): Promise<{ reachable: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await request(`http://${ip}:${port}/`, { method: 'HEAD', headersTimeout: 3000, bodyTimeout: 3000 });
      return { reachable: true, latencyMs: Date.now() - start };
    } catch {
      return { reachable: false, latencyMs: Date.now() - start };
    }
  }

  // ── IPTZAdapter ──

  async sendCommand(deviceId: string, command: PTZCommand): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error(`Device ${deviceId} not connected`);

    const ch = command.channel ?? 1;
    const speed = command.speed ?? 50;

    if (command.action === 'goto_preset' && command.presetId != null) {
      await this.isapiPut(
        conn.config,
        `/ISAPI/PTZCtrl/channels/${ch}/presets/${command.presetId}/goto`,
        `<PTZPreset><id>${command.presetId}</id></PTZPreset>`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );
      return;
    }

    if (command.action === 'set_preset' && command.presetId != null) {
      await this.isapiPut(
        conn.config,
        `/ISAPI/PTZCtrl/channels/${ch}/presets/${command.presetId}`,
        `<PTZPreset><id>${command.presetId}</id><presetName>Preset ${command.presetId}</presetName></PTZPreset>`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );
      return;
    }

    if (command.action === 'stop') {
      await this.isapiPut(
        conn.config,
        `/ISAPI/PTZCtrl/channels/${ch}/continuous`,
        `<PTZData><pan>0</pan><tilt>0</tilt><zoom>0</zoom></PTZData>`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );
      return;
    }

    const velocityMap: Record<string, [number, number, number]> = {
      left:      [-speed, 0, 0],
      right:     [speed, 0, 0],
      up:        [0, speed, 0],
      down:      [0, -speed, 0],
      zoomin:    [0, 0, speed],
      zoomout:   [0, 0, -speed],
    };

    const [pan, tilt, zoom] = velocityMap[command.action] ?? [0, 0, 0];
    await this.isapiPut(
      conn.config,
      `/ISAPI/PTZCtrl/channels/${ch}/continuous`,
      `<PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`,
      config.DEVICE_REQUEST_TIMEOUT_MS,
    );
  }

  async getPresets(deviceId: string): Promise<PTZPreset[]> {
    const conn = this.connections.get(deviceId);
    if (!conn) return [];

    try {
      const xml = await this.isapiGet(conn.config, '/ISAPI/PTZCtrl/channels/1/presets', config.DEVICE_REQUEST_TIMEOUT_MS);
      const presets: PTZPreset[] = [];
      const presetBlocks = xml.match(/<PTZPreset>[\s\S]*?<\/PTZPreset>/g) || [];
      for (const block of presetBlocks) {
        const id = this.extractXmlNumber(block, 'id');
        const name = this.extractXmlText(block, 'presetName');
        if (id != null) {
          presets.push({ id, name: name || `Preset ${id}` });
        }
      }
      return presets;
    } catch (err) {
      logger.warn({ deviceId, err }, 'Failed to get PTZ presets');
      return [];
    }
  }

  async setPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error(`Device ${deviceId} not connected`);
    await this.isapiPut(
      conn.config,
      `/ISAPI/PTZCtrl/channels/1/presets/${preset.id}`,
      `<PTZPreset><id>${preset.id}</id><presetName>${this.escapeXml(preset.name)}</presetName></PTZPreset>`,
      config.DEVICE_REQUEST_TIMEOUT_MS,
    );
  }

  // ── IPlaybackAdapter ──

  async searchRecordings(
    deviceId: string,
    channel: number,
    start: string,
    end: string,
  ): Promise<RecordingSearchResult> {
    const conn = this.connections.get(deviceId);
    if (!conn) return { segments: [], totalCount: 0, totalDurationSeconds: 0 };

    const searchXml = `<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription>
  <searchID>${Date.now()}</searchID>
  <trackList><trackID>${channel}01</trackID></trackList>
  <timeSpanList>
    <timeSpan>
      <startTime>${start}</startTime>
      <endTime>${end}</endTime>
    </timeSpan>
  </timeSpanList>
  <maxResults>100</maxResults>
  <searchResultPostion>0</searchResultPostion>
  <metadataList>
    <metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>
  </metadataList>
</CMSearchDescription>`;

    try {
      const responseXml = await this.isapiPost(
        conn.config,
        '/ISAPI/ContentMgmt/search',
        searchXml,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );

      const segments = this.parseSearchResults(responseXml, channel);
      const totalDurationSeconds = segments.reduce((acc, s) => {
        const d = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000;
        return acc + Math.max(0, d);
      }, 0);

      return { segments, totalCount: segments.length, totalDurationSeconds };
    } catch (err) {
      logger.error({ deviceId, err }, 'Hikvision recording search failed');
      return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
    }
  }

  getPlaybackUrl(deviceId: string, channel: number, start: string, end: string): string {
    const conn = this.connections.get(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    const startFmt = start.replace(/[-:T]/g, '').replace('Z', '');
    const endFmt = end.replace(/[-:T]/g, '').replace('Z', '');
    return `rtsp://${username}:${password}@${ip}:554/Streaming/tracks/${channel}01?starttime=${startFmt}&endtime=${endFmt}`;
  }

  // ── IEventAdapter ──

  startEventListener(deviceId: string, callback: EventCallback): void {
    const conn = this.connections.get(deviceId);
    if (!conn) {
      logger.warn({ deviceId }, 'Cannot start event listener: device not connected');
      return;
    }

    conn.eventAbortController?.abort();
    const ac = new AbortController();
    conn.eventAbortController = ac;

    this.pollAlertStream(deviceId, conn.config, callback, ac.signal).catch((err) => {
      if (!ac.signal.aborted) {
        logger.error({ deviceId, err }, 'Hikvision alertStream error');
      }
    });

    logger.info({ deviceId }, 'Hikvision event listener started');
  }

  stopEventListener(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.eventAbortController) {
      conn.eventAbortController.abort();
      conn.eventAbortController = undefined;
      logger.info({ deviceId }, 'Hikvision event listener stopped');
    }
  }

  // ── Private: ISAPI HTTP helpers ──

  private async isapiGet(cfg: DeviceConnectionConfig, path: string, timeoutMs: number): Promise<string> {
    const res = await digestRequest({
      url: `http://${cfg.ip}:${cfg.port}${path}`,
      method: 'GET',
      username: cfg.username,
      password: cfg.password,
      timeoutMs,
    });
    if (res.statusCode !== 200) {
      throw new Error(`ISAPI GET ${path} → ${res.statusCode}`);
    }
    return res.body;
  }

  private async isapiPut(cfg: DeviceConnectionConfig, path: string, xmlBody: string, timeoutMs: number): Promise<string> {
    const res = await digestRequest({
      url: `http://${cfg.ip}:${cfg.port}${path}`,
      method: 'PUT',
      username: cfg.username,
      password: cfg.password,
      body: xmlBody,
      contentType: 'application/xml',
      timeoutMs,
    });
    if (res.statusCode !== 200) {
      throw new Error(`ISAPI PUT ${path} → ${res.statusCode}`);
    }
    return res.body;
  }

  private async isapiPost(cfg: DeviceConnectionConfig, path: string, xmlBody: string, timeoutMs: number): Promise<string> {
    const res = await digestRequest({
      url: `http://${cfg.ip}:${cfg.port}${path}`,
      method: 'POST',
      username: cfg.username,
      password: cfg.password,
      body: xmlBody,
      contentType: 'application/xml',
      timeoutMs,
    });
    if (res.statusCode !== 200) {
      throw new Error(`ISAPI POST ${path} → ${res.statusCode}`);
    }
    return res.body;
  }

  // ── Private: XML parsing ──

  private extractXmlText(xml: string, tag: string): string | undefined {
    const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
    return match ? match[1].trim() : undefined;
  }

  private extractXmlNumber(xml: string, tag: string): number | undefined {
    const text = this.extractXmlText(xml, tag);
    if (text == null) return undefined;
    const num = Number(text);
    return isNaN(num) ? undefined : num;
  }

  private escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private parseDeviceInfo(xml: string): DeviceIdentity {
    return {
      brand: 'hikvision',
      model: this.extractXmlText(xml, 'model') || 'Unknown',
      serial: this.extractXmlText(xml, 'serialNumber') || '',
      firmware: this.extractXmlText(xml, 'firmwareVersion') || '',
      mac: this.extractXmlText(xml, 'macAddress'),
      channels: this.extractXmlNumber(xml, 'videoInputNums'),
    };
  }

  // ── Private: Capability queries ──

  private async queryCapabilities(cfg: DeviceConnectionConfig, timeoutMs: number): Promise<DeviceCapabilities> {
    const caps = this.defaultCapabilities();

    try {
      const videoXml = await this.isapiGet(cfg, '/ISAPI/System/Video/inputs', timeoutMs);
      const inputs = (videoXml.match(/<VideoInputChannel>/g) || []).length;
      if (inputs > 0) caps.channels = inputs;
    } catch { /* fall back to deviceInfo value */ }

    try {
      await this.isapiGet(cfg, '/ISAPI/PTZCtrl/channels/1/capabilities', timeoutMs);
      caps.ptz = true;
    } catch {
      caps.ptz = false;
    }

    try {
      const smartXml = await this.isapiGet(cfg, '/ISAPI/Smart/capabilities', timeoutMs);
      caps.smartEvents = smartXml.includes('linedetection') || smartXml.includes('fielddetection');
      caps.faceDetection = smartXml.includes('faceDetection');
      caps.anpr = smartXml.includes('plateRecog') || smartXml.includes('ANPR');
    } catch { /* Not all devices have /Smart/capabilities */ }

    try {
      await this.isapiGet(cfg, '/ISAPI/System/Audio/channels/1', timeoutMs);
      caps.audio = true;
    } catch {
      caps.audio = false;
    }

    try {
      await this.isapiGet(cfg, '/ISAPI/System/TwoWayAudio/channels/1', timeoutMs);
      caps.twoWayAudio = true;
    } catch {
      caps.twoWayAudio = false;
    }

    try {
      const storageXml = await this.isapiGet(cfg, '/ISAPI/ContentMgmt/Storage', timeoutMs);
      caps.localStorage = storageXml.includes('<hdd>') || storageXml.includes('<sd>');
    } catch {
      caps.localStorage = false;
    }

    return caps;
  }

  private defaultCapabilities(): DeviceCapabilities {
    return {
      ptz: false,
      audio: false,
      smartEvents: false,
      anpr: false,
      faceDetection: false,
      channels: 1,
      codecs: ['H.264'],
      maxResolution: '1080p',
      twoWayAudio: false,
      onvifSupport: true,
      localStorage: false,
    };
  }

  // ── Private: Stream profile queries ──

  private async queryStreamProfiles(cfg: DeviceConnectionConfig, timeoutMs: number): Promise<StreamProfile[]> {
    const profiles: StreamProfile[] = [];
    const channelsXml = await this.isapiGet(cfg, '/ISAPI/Streaming/channels', timeoutMs);

    const channelBlocks = channelsXml.match(/<StreamingChannel>[\s\S]*?<\/StreamingChannel>/g) || [];
    for (const block of channelBlocks) {
      const idStr = this.extractXmlText(block, 'id');
      if (!idStr) continue;

      const id = Number(idStr);
      const channel = Math.floor(id / 100);
      const streamIdx = id % 100;
      const type: StreamProfile['type'] = streamIdx === 1 ? 'main' : streamIdx === 2 ? 'sub' : 'third';

      const codec = this.extractXmlText(block, 'videoCodecType') || 'H.264';
      const width = this.extractXmlNumber(block, 'videoResolutionWidth');
      const height = this.extractXmlNumber(block, 'videoResolutionHeight');
      const fps = this.extractXmlNumber(block, 'maxFrameRate');
      const bitrate = this.extractXmlNumber(block, 'constantBitRate') || this.extractXmlNumber(block, 'vbrUpperCap');

      profiles.push({
        type,
        url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/Streaming/Channels/${idStr}`,
        codec: codec.toUpperCase(),
        resolution: width && height ? `${width}x${height}` : 'unknown',
        fps: fps ? Math.floor(fps / 100) : 25,
        bitrate,
        channel,
      });
    }

    if (profiles.length === 0) {
      return this.computeDefaultStreams(cfg);
    }
    return profiles;
  }

  private computeDefaultStreams(cfg: DeviceConnectionConfig): StreamProfile[] {
    return [
      {
        type: 'main',
        url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/Streaming/Channels/101`,
        codec: 'H.264',
        resolution: '1920x1080',
        fps: 25,
        channel: 1,
      },
      {
        type: 'sub',
        url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/Streaming/Channels/102`,
        codec: 'H.264',
        resolution: '640x480',
        fps: 15,
        channel: 1,
      },
    ];
  }

  // ── Private: Recording search ──

  private parseSearchResults(xml: string, channel: number): RecordingSegment[] {
    const segments: RecordingSegment[] = [];
    const itemBlocks = xml.match(/<searchMatchItem>[\s\S]*?<\/searchMatchItem>/g) || [];
    for (const block of itemBlocks) {
      const startTime = this.extractXmlText(block, 'startTime');
      const endTime = this.extractXmlText(block, 'endTime');
      if (startTime && endTime) {
        segments.push({
          startTime,
          endTime,
          channel,
          type: 'continuous',
          sizeBytes: this.extractXmlNumber(block, 'mediaSegmentDescriptor'),
        });
      }
    }
    return segments;
  }

  // ── Private: Event alertStream ──

  /**
   * Long-poll /ISAPI/Event/notification/alertStream.
   *
   * Returns multipart/x-mixed-replace with XML-encoded events.
   * The connection stays open and the device pushes events as they occur.
   *
   * KNOWN LIMITATION: digestRequest() buffers the full response.
   * For true persistent streaming, we'd need to compute the digest header
   * and open a raw undici readable stream. We fall back to polling every 2s.
   *
   * PRODUCTION TODO: Use undici body.readable with pre-computed digest headers
   * for real-time event delivery without polling.
   */
  private async pollAlertStream(
    deviceId: string,
    cfg: DeviceConnectionConfig,
    callback: EventCallback,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      try {
        const res = await digestRequest({
          url: `http://${cfg.ip}:${cfg.port}/ISAPI/Event/notification/alertStream`,
          method: 'GET',
          username: cfg.username,
          password: cfg.password,
          timeoutMs: 10000,
        });

        if (res.statusCode === 200 && res.body) {
          const events = this.parseAlertStreamChunk(res.body);
          for (const event of events) {
            callback(event, deviceId);
          }
        }

        if (!signal.aborted) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        if (signal.aborted) return;
        logger.warn({ deviceId, err }, 'alertStream poll error, retrying in 5s');
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private parseAlertStreamChunk(body: string): DeviceEvent[] {
    const events: DeviceEvent[] = [];
    const alertBlocks = body.match(/<EventNotificationAlert>[\s\S]*?<\/EventNotificationAlert>/g) || [];
    for (const block of alertBlocks) {
      const eventType = this.extractXmlText(block, 'eventType');
      const channelId = this.extractXmlNumber(block, 'channelID') ?? 1;
      const dateTime = this.extractXmlText(block, 'dateTime') ?? new Date().toISOString();
      if (eventType) {
        events.push({
          eventType,
          channel: channelId,
          timestamp: dateTime,
          data: {
            eventState: this.extractXmlText(block, 'eventState'),
            activePostCount: this.extractXmlNumber(block, 'activePostCount'),
          },
        });
      }
    }
    return events;
  }
}
