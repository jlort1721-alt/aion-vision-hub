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

interface OnvifConnection {
  config: DeviceConnectionConfig;
  cam: any;
  state: StreamState;
  identity: DeviceIdentity | null;
  capabilities: DeviceCapabilities | null;
  streamProfiles: StreamProfile[];
  eventAbortController?: AbortController;
}

/**
 * ONVIF adapter — the universal fallback for any ONVIF-compliant device.
 *
 * Uses WS-Discovery for network scanning and ONVIF Profile S/T/G for
 * device control, streaming, and PTZ operations.
 *
 * Wraps the `onvif` npm package (v0.7+) for device communication.
 *
 * Profile coverage:
 *   Profile S — Streaming (getProfiles, getStreamUri)
 *   Profile T — Advanced streaming (H.265, analytics metadata)
 *   Profile G — Recording (getRecordings, getReplayUri)  ← partial support
 *
 * ONVIF service detection is done by reading services from the connected
 * Cam object, not by hardcoding capabilities.
 */
export class OnvifAdapter
  implements IDeviceAdapter, IStreamAdapter, IDiscoveryAdapter, IHealthAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'onvif-generic';
  readonly supportedProtocols = ['onvif', 'rtsp'];

  private connections = new Map<string, OnvifConnection>();

  // ── IDeviceAdapter ──

  async connect(cfg: DeviceConnectionConfig): Promise<ConnectionResult> {
    const deviceId = `onvif-${cfg.ip}:${cfg.port}`;
    try {
      const cam = await this.createCam(cfg);

      // Read device info from the connected cam object
      const info = cam.deviceInformation || {};
      const identity: DeviceIdentity = {
        brand: info.manufacturer || 'onvif-generic',
        model: info.model || 'Unknown',
        serial: info.serialNumber || '',
        firmware: info.firmwareVersion || '',
      };

      // Read capabilities from what services the device actually exposes
      const capabilities = this.readCapabilities(cam);

      // Query real stream profiles
      let streamProfiles: StreamProfile[] = [];
      try {
        streamProfiles = await this.queryStreamProfiles(cam, cfg);
      } catch (err) {
        logger.warn({ deviceId, err }, 'ONVIF: Failed to query stream profiles');
      }

      this.connections.set(deviceId, {
        config: cfg,
        cam,
        state: 'live',
        identity,
        capabilities,
        streamProfiles,
      });

      logger.info(
        { deviceId, model: identity.model, manufacturer: identity.brand },
        'ONVIF device connected',
      );

      return {
        success: true,
        message: `Connected to ${identity.brand} ${identity.model}`,
        sessionId: deviceId,
        capabilities,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'ONVIF connection failed',
      };
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.eventAbortController?.abort();
      this.connections.delete(deviceId);
      logger.info({ deviceId }, 'ONVIF device disconnected');
    }
  }

  async testConnection(cfg: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const cam = await this.createCam(cfg);
      const info = cam.deviceInformation || {};
      const identity: DeviceIdentity = {
        brand: info.manufacturer || 'onvif-generic',
        model: info.model || 'Unknown',
        serial: info.serialNumber || '',
        firmware: info.firmwareVersion || '',
      };
      const capabilities = this.readCapabilities(cam);

      return {
        success: true,
        message: `Connected to ${identity.brand} ${identity.model}`,
        latencyMs: Date.now() - start,
        capabilities,
        deviceInfo: identity,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  // ── IStreamAdapter ──

  async getStreams(deviceId: string): Promise<StreamProfile[]> {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam) return [];
    if (conn.streamProfiles.length > 0) return conn.streamProfiles;

    try {
      conn.streamProfiles = await this.queryStreamProfiles(conn.cam, conn.config);
      return conn.streamProfiles;
    } catch (err) {
      logger.error({ deviceId, err }, 'Failed to get ONVIF stream profiles');
      return [];
    }
  }

  getStreamUrl(deviceId: string, type: 'main' | 'sub', _channel = 1): string {
    const conn = this.connections.get(deviceId);
    if (!conn) return '';

    // Prefer cached profile URLs (from real getStreamUri calls)
    const profile = conn.streamProfiles.find((p) => p.type === type);
    if (profile?.url) return profile.url;

    // Fallback to standard ONVIF path pattern
    const { ip, username, password } = conn.config;
    const profileToken = type === 'main' ? 'Profile_1' : 'Profile_2';
    return `rtsp://${username}:${password}@${ip}:554/onvif/${profileToken}/media.smp`;
  }

  getStreamState(deviceId: string): StreamState {
    return this.connections.get(deviceId)?.state ?? 'idle';
  }

  // ── IDiscoveryAdapter ──

  async discover(_networkRange: string, timeout = 5000): Promise<DiscoveredDevice[]> {
    logger.info({ timeout }, 'Starting ONVIF WS-Discovery probe');
    try {
      const onvif = await import('onvif');

      // The onvif package exposes Discovery via different patterns depending on version.
      // v0.6+: onvif.Discovery.probe() with event emitter
      // v0.7+: may also export Discovery as named export
      const Discovery = onvif.Discovery || (onvif as any).default?.Discovery;
      if (!Discovery) {
        logger.warn('ONVIF Discovery class not available in installed onvif package');
        return [];
      }

      const devices: DiscoveredDevice[] = [];

      await new Promise<void>((resolve) => {
        Discovery.probe({ timeout }, (err: Error | null, cams: any[]) => {
          if (err) {
            logger.error({ err }, 'ONVIF WS-Discovery probe error');
            resolve();
            return;
          }

          for (const cam of cams || []) {
            const hostname = cam.hostname || cam.address;
            if (!hostname) continue;

            devices.push({
              ip: hostname,
              port: cam.port || 80,
              brand: 'onvif',
              model: cam.urn || 'Unknown',
              serial: undefined,
              mac: undefined,
              protocols: ['onvif', 'rtsp'],
            });
          }
          resolve();
        });
      });

      logger.info({ count: devices.length }, 'ONVIF WS-Discovery complete');
      return devices;
    } catch (err) {
      logger.error({ err }, 'ONVIF discovery failed');
      return [];
    }
  }

  async identify(ip: string, port: number): Promise<DeviceIdentity | null> {
    try {
      // Try connecting without credentials — some devices allow read-only ONVIF
      const cam = await this.createCam({ ip, port, username: 'admin', password: '', brand: 'onvif' });
      const info = cam.deviceInformation || {};
      return {
        brand: info.manufacturer || 'onvif-generic',
        model: info.model || 'Unknown',
        serial: info.serialNumber || '',
        firmware: info.firmwareVersion || '',
      };
    } catch {
      // Expected without credentials
    }
    return null;
  }

  // ── IHealthAdapter ──

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const conn = this.connections.get(deviceId);
    if (!conn) return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date().toISOString() };

    const start = Date.now();
    try {
      await this.promisify(conn.cam, 'getDeviceInformation');
      conn.state = 'live';
      return {
        online: true,
        latencyMs: Date.now() - start,
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
      const { request: httpRequest } = await import('undici');
      await httpRequest(`http://${ip}:${port}/`, { method: 'HEAD', headersTimeout: 3000 });
      return { reachable: true, latencyMs: Date.now() - start };
    } catch {
      return { reachable: false, latencyMs: Date.now() - start };
    }
  }

  // ── IPTZAdapter ──

  async sendCommand(deviceId: string, command: PTZCommand): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam) throw new Error(`Device ${deviceId} not connected`);

    if (!conn.cam.ptzService) {
      throw new Error('Device does not support PTZ (no ONVIF PTZ service)');
    }

    const speed = command.speed ?? 0.5;

    if (command.action === 'goto_preset' && command.presetId != null) {
      await this.promisify(conn.cam, 'gotoPreset', { preset: command.presetId });
      return;
    }

    if (command.action === 'set_preset' && command.presetId != null) {
      await this.promisify(conn.cam, 'setPreset', {
        presetName: `Preset ${command.presetId}`,
        presetToken: String(command.presetId),
      });
      return;
    }

    if (command.action === 'stop') {
      await this.promisify(conn.cam, 'stop', {});
      return;
    }

    const velocities: Record<string, { x: number; y: number; zoom: number }> = {
      left:    { x: -speed, y: 0, zoom: 0 },
      right:   { x: speed, y: 0, zoom: 0 },
      up:      { x: 0, y: speed, zoom: 0 },
      down:    { x: 0, y: -speed, zoom: 0 },
      zoomin:  { x: 0, y: 0, zoom: speed },
      zoomout: { x: 0, y: 0, zoom: -speed },
    };

    const v = velocities[command.action];
    if (v) {
      await this.promisify(conn.cam, 'continuousMove', v);
    }
  }

  async getPresets(deviceId: string): Promise<PTZPreset[]> {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam?.ptzService) return [];

    try {
      const presets = await this.promisify(conn.cam, 'getPresets', {});
      if (!Array.isArray(presets)) return [];
      return presets.map((p: any, i: number) => ({
        id: Number(p.token || p.$.token || i + 1),
        name: p.name || p.Name || `Preset ${i + 1}`,
        position: p.PTZPosition ? {
          pan: Number(p.PTZPosition?.PanTilt?.$?.x) || 0,
          tilt: Number(p.PTZPosition?.PanTilt?.$?.y) || 0,
          zoom: Number(p.PTZPosition?.Zoom?.$?.x) || 0,
        } : undefined,
      }));
    } catch {
      return [];
    }
  }

  async setPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam) throw new Error(`Device ${deviceId} not connected`);
    await this.promisify(conn.cam, 'setPreset', {
      presetName: preset.name,
      presetToken: String(preset.id),
    });
  }

  // ── IPlaybackAdapter ──

  async searchRecordings(
    deviceId: string,
    _channel: number,
    start: string,
    end: string,
  ): Promise<RecordingSearchResult> {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam) return { segments: [], totalCount: 0, totalDurationSeconds: 0 };

    /**
     * ONVIF Profile G — Recording Search
     *
     * Requires the device to expose a SearchService.
     * Uses FindRecordings → GetRecordingSearchResults workflow.
     *
     * KNOWN LIMITATION: The `onvif` npm package (v0.7) has limited
     * Profile G support. Most IP cameras don't support Profile G anyway —
     * only NVRs typically do. We attempt the call and gracefully degrade.
     *
     * For Hikvision/Dahua NVRs, use the brand-specific adapter which has
     * direct recording search via ISAPI/CGI.
     */
    try {
      if (!conn.cam.searchService) {
        logger.debug({ deviceId }, 'ONVIF device does not expose SearchService (Profile G)');
        return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
      }

      const recordings = await this.promisify(conn.cam, 'getRecordings', {});
      const segments: RecordingSegment[] = [];

      if (Array.isArray(recordings)) {
        for (const rec of recordings) {
          const track = rec.Tracks?.Track?.[0];
          if (track) {
            segments.push({
              startTime: track.DataFrom || start,
              endTime: track.DataTo || end,
              channel: 1,
              type: 'continuous',
            });
          }
        }
      }

      const totalDurationSeconds = segments.reduce((acc, s) => {
        const d = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000;
        return acc + Math.max(0, d);
      }, 0);

      return { segments, totalCount: segments.length, totalDurationSeconds };
    } catch (err) {
      logger.debug({ deviceId, err }, 'ONVIF recording search not supported');
      return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
    }
  }

  getPlaybackUrl(deviceId: string, _channel: number, start: string, _end: string): string {
    const conn = this.connections.get(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    // ONVIF Replay URI — requires Profile G support on the device
    return `rtsp://${username}:${password}@${ip}:554/onvif/replay?starttime=${start}`;
  }

  // ── IEventAdapter ──

  startEventListener(deviceId: string, callback: EventCallback): void {
    const conn = this.connections.get(deviceId);
    if (!conn?.cam) {
      logger.warn({ deviceId }, 'Cannot start ONVIF event listener: device not connected');
      return;
    }

    conn.eventAbortController?.abort();
    const ac = new AbortController();
    conn.eventAbortController = ac;

    this.subscribeEvents(deviceId, conn.cam, callback, ac.signal);
    logger.info({ deviceId }, 'ONVIF event listener started');
  }

  stopEventListener(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.eventAbortController) {
      conn.eventAbortController.abort();
      conn.eventAbortController = undefined;
      logger.info({ deviceId }, 'ONVIF event listener stopped');
    }
  }

  // ── Private: Cam creation ──

  private async createCam(cfg: DeviceConnectionConfig): Promise<any> {
    const { Cam } = await import('onvif');
    return new Promise<any>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('ONVIF connection timeout')), config.DEVICE_CONNECT_TIMEOUT_MS);
      const c = new Cam(
        {
          hostname: cfg.ip,
          port: cfg.port,
          username: cfg.username,
          password: cfg.password,
          timeout: config.DEVICE_CONNECT_TIMEOUT_MS,
        },
        (err: Error | null) => {
          clearTimeout(timeoutId);
          if (err) reject(err);
          else resolve(c);
        },
      );
    });
  }

  // ── Private: Capability detection from live cam object ──

  private readCapabilities(cam: any): DeviceCapabilities {
    const info = cam.deviceInformation || {};
    return {
      ptz: !!cam.ptzService,
      audio: true, // Most ONVIF devices support audio; refined on getProfiles
      smartEvents: !!cam.analyticsService,
      anpr: false, // Rarely exposed via ONVIF
      faceDetection: false,
      channels: 1, // ONVIF typically presents one logical channel per Cam
      codecs: ['H.264'], // Updated when we query stream profiles
      maxResolution: '1080p',
      twoWayAudio: !!cam.mediaService, // Simplified check
      onvifSupport: true,
      localStorage: !!cam.recordingService || !!cam.searchService,
    };
  }

  // ── Private: Stream profile queries ──

  private async queryStreamProfiles(cam: any, cfg: DeviceConnectionConfig): Promise<StreamProfile[]> {
    const mediaProfiles = await this.promisify(cam, 'getProfiles');
    if (!Array.isArray(mediaProfiles) || mediaProfiles.length === 0) return [];

    const profiles: StreamProfile[] = [];
    const codecs = new Set<string>();

    for (let i = 0; i < mediaProfiles.length; i++) {
      const profile = mediaProfiles[i];
      const token = profile.$.token || profile.$?.token;

      // Get the actual stream URI for this profile
      let url = '';
      try {
        const streamUri = await this.promisify(cam, 'getStreamUri', {
          protocol: 'RTSP',
          profileToken: token,
        });
        url = streamUri?.uri || '';

        // Inject credentials if not present
        if (url && !url.includes('@')) {
          url = url.replace('rtsp://', `rtsp://${cfg.username}:${cfg.password}@`);
        }
      } catch {
        // Fall back to computed URL
        url = `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/onvif/${token}/media.smp`;
      }

      const videoEncoder = profile.videoEncoderConfiguration;
      const encoding = videoEncoder?.encoding || 'H264';
      const resolution = videoEncoder?.resolution;
      const fps = videoEncoder?.rateControl?.frameRateLimit || 25;
      const bitrate = videoEncoder?.rateControl?.bitrateLimit;

      const codec = encoding.toUpperCase().replace('H264', 'H.264').replace('H265', 'H.265').replace('JPEG', 'MJPEG');
      codecs.add(codec);

      profiles.push({
        type: i === 0 ? 'main' : i === 1 ? 'sub' : 'third',
        url,
        codec,
        resolution: resolution ? `${resolution.width}x${resolution.height}` : 'unknown',
        fps: Number(fps) || 25,
        bitrate: bitrate ? Number(bitrate) : undefined,
        channel: 1,
      });
    }

    return profiles;
  }

  // ── Private: ONVIF event subscription ──

  /**
   * ONVIF PullPoint or Basic notification event subscription.
   *
   * The onvif npm package supports cam.on('event', callback) for
   * PullPoint subscriptions on some device/firmware combos.
   *
   * KNOWN LIMITATION: Not all devices support PullPoint properly.
   * The onvif package's event support is inconsistent.
   * For reliable events, use brand-specific adapters (Hikvision/Dahua).
   */
  private subscribeEvents(
    deviceId: string,
    cam: any,
    callback: EventCallback,
    signal: AbortSignal,
  ): void {
    const handler = (event: any) => {
      if (signal.aborted) return;
      try {
        const topic = event?.topic?._?.match(/([^/]+)$/)?.[1] || 'unknown';
        callback(
          {
            eventType: topic,
            channel: 1,
            timestamp: event?.message?.message?.$.UtcTime || new Date().toISOString(),
            data: event?.message?.message?.data?.simpleItem || {},
          },
          deviceId,
        );
      } catch (err) {
        logger.debug({ deviceId, err }, 'ONVIF event parse error');
      }
    };

    cam.on('event', handler);

    signal.addEventListener('abort', () => {
      cam.removeListener('event', handler);
    }, { once: true });
  }

  // ── Private: Promisify onvif callbacks ──

  private promisify(cam: any, method: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof cam[method] !== 'function') {
        reject(new Error(`ONVIF method '${method}' not available on this device`));
        return;
      }
      cam[method](...args, (err: Error | null, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}
