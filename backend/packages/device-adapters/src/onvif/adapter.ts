import type pino from 'pino';
import type {
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  DiscoveredDevice,
  DeviceIdentity,
  StreamProfile,
  DeviceHealthReport,
  DeviceCapabilities,
  DeviceSystemInfo,
  PTZCommand,
  PTZPreset,
  PlaybackSearchParams,
  PlaybackSegment,
  PlaybackStartParams,
  PlaybackSession,
  ClipExportParams,
  ExportJob,
  DeviceEventPayload,
  Unsubscribe,
  IDiscoveryAdapter,
  IPTZAdapter,
  IPlaybackAdapter,
  IEventAdapter,
} from '@aion/shared-contracts';
import { BaseAdapter } from '../base-adapter.js';
import { wsDiscovery } from './discovery.js';
import { promisifyCam } from './profiles.js';

interface OnvifConnection {
  cam: Record<string, unknown>;
}

/**
 * Generic ONVIF adapter — universal fallback for any ONVIF-compliant device.
 *
 * Uses WS-Discovery for network scanning and ONVIF Profile S/T for
 * device control, streaming, and PTZ operations.
 */
export class GenericOnvifAdapter
  extends BaseAdapter
  implements IDiscoveryAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'onvif';
  readonly supportedProtocols = ['onvif', 'rtsp'];

  private cams = new Map<string, OnvifConnection>();

  constructor(logger: pino.Logger) {
    super(logger);
  }

  // ── Template Method Implementations ───────────────────────

  protected async doConnect(config: DeviceConnectionConfig, deviceId: string): Promise<ConnectionResult> {
    const { Cam } = await import('onvif');
    const cam = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const c = new Cam(
        {
          hostname: config.ip,
          port: config.port,
          username: config.username,
          password: config.password,
        },
        (err: Error | null) => {
          if (err) reject(err);
          else resolve(c as unknown as Record<string, unknown>);
        },
      );
    });

    this.cams.set(deviceId, { cam });
    const info = cam.deviceInformation as Record<string, string> | undefined;
    return { success: true, message: `Connected to ${info?.model ?? 'ONVIF device'}` };
  }

  protected async doDisconnect(deviceId: string): Promise<void> {
    this.cams.delete(deviceId);
  }

  protected async doTestConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const { Cam } = await import('onvif');
    const cam = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const c = new Cam(
        {
          hostname: config.ip,
          port: config.port,
          username: config.username,
          password: config.password,
        },
        (err: Error | null) => {
          if (err) reject(err);
          else resolve(c as unknown as Record<string, unknown>);
        },
      );
    });

    const info = cam.deviceInformation as Record<string, string> | undefined;
    const hasPtz = !!(cam as Record<string, unknown>).ptzService;

    return {
      success: true,
      message: `Connected to ${info?.model ?? 'ONVIF device'}`,
      latencyMs: 0,
      capabilities: {
        ptz: hasPtz,
        audio: true,
        smartEvents: false,
        anpr: false,
        faceDetection: false,
        channels: 1,
        codecs: ['H.264', 'H.265'],
        maxResolution: '1080p',
        playback: false,
        twoWayAudio: false,
      },
    };
  }

  // ── IStreamAdapter ────────────────────────────────────────

  async getStreams(deviceId: string): Promise<StreamProfile[]> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) return [];

    try {
      const mediaProfiles = await promisifyCam(onvif.cam, 'getProfiles') as Array<Record<string, unknown>>;
      const profiles: StreamProfile[] = [];

      for (const profile of mediaProfiles ?? []) {
        const meta = profile.$ as Record<string, string> | undefined;
        const token = meta?.token;
        if (!token) continue;

        const streamUri = await promisifyCam(onvif.cam, 'getStreamUri', {
          protocol: 'RTSP',
          profileToken: token,
        }) as Record<string, string>;

        const videoEnc = profile.videoEncoderConfiguration as Record<string, unknown> | undefined;
        const resolution = videoEnc?.resolution as { width?: number; height?: number } | undefined;

        profiles.push({
          type: profiles.length === 0 ? 'main' : 'sub',
          url: streamUri?.uri ?? '',
          codec: (videoEnc?.encoding as string) ?? 'H264',
          resolution: resolution ? `${resolution.width}x${resolution.height}` : 'unknown',
          fps: (videoEnc?.rateControl as Record<string, number>)?.frameRateLimit ?? 25,
          channel: 1,
        });
      }
      return profiles;
    } catch (err) {
      this.logger.error({ deviceId, err }, 'Failed to get ONVIF stream profiles');
      return [];
    }
  }

  getStreamUrl(deviceId: string, type: 'main' | 'sub', _channel = 1): string {
    const conn = this.getConnection(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    const profile = type === 'main' ? 'Profile_1' : 'Profile_2';
    return `rtsp://${username}:${password}@${ip}:554/onvif/${profile}/media.smp`;
  }

  // ── IHealthAdapter ────────────────────────────────────────

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date() };

    const start = Date.now();
    try {
      await promisifyCam(onvif.cam, 'getDeviceInformation');
      return { online: true, latencyMs: Date.now() - start, errors: [], lastChecked: new Date() };
    } catch (err) {
      return {
        online: false,
        latencyMs: Date.now() - start,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        lastChecked: new Date(),
      };
    }
  }

  // ── IConfigAdapter ────────────────────────────────────────

  async getCapabilities(deviceId: string): Promise<DeviceCapabilities> {
    const onvif = this.cams.get(deviceId);
    const hasPtz = !!(onvif?.cam as Record<string, unknown> | undefined)?.ptzService;

    return {
      ptz: hasPtz,
      audio: true,
      smartEvents: false,
      anpr: false,
      faceDetection: false,
      channels: 1,
      codecs: ['H.264', 'H.265'],
      maxResolution: '1080p',
      playback: false,
      twoWayAudio: false,
    };
  }

  async getSystemInfo(deviceId: string): Promise<DeviceSystemInfo> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) throw new Error('Not connected');

    const info = await promisifyCam(onvif.cam, 'getDeviceInformation') as Record<string, string>;
    return {
      firmware: info?.firmwareVersion ?? 'unknown',
      uptime: 0,
      model: info?.model,
      serial: info?.serialNumber,
    };
  }

  // ── IDiscoveryAdapter ─────────────────────────────────────

  async discover(networkRange: string, timeout = 5000): Promise<DiscoveredDevice[]> {
    return wsDiscovery(networkRange, timeout, this.logger);
  }

  async identify(ip: string, port: number): Promise<DeviceIdentity | null> {
    try {
      const result = await this.testConnection({
        ip, port, username: 'admin', password: '', brand: 'onvif',
      });
      if (result.success) {
        return { brand: 'onvif', model: result.message, serial: '', firmware: '' };
      }
    } catch {
      // Expected
    }
    return null;
  }

  // ── IPTZAdapter ───────────────────────────────────────────

  async sendCommand(deviceId: string, command: PTZCommand): Promise<void> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) throw new Error(`Device ${deviceId} not connected`);

    const speed = command.speed ?? 0.5;
    const velocities: Record<string, { x: number; y: number; zoom: number }> = {
      left: { x: -speed, y: 0, zoom: 0 },
      right: { x: speed, y: 0, zoom: 0 },
      up: { x: 0, y: speed, zoom: 0 },
      down: { x: 0, y: -speed, zoom: 0 },
      zoomin: { x: 0, y: 0, zoom: speed },
      zoomout: { x: 0, y: 0, zoom: -speed },
      stop: { x: 0, y: 0, zoom: 0 },
    };

    const v = velocities[command.action] ?? velocities.stop;

    if (command.action === 'stop') {
      await promisifyCam(onvif.cam, 'stop', {});
    } else if (command.action === 'goto_preset' && command.presetId) {
      await promisifyCam(onvif.cam, 'gotoPreset', { preset: command.presetId });
    } else {
      await promisifyCam(onvif.cam, 'continuousMove', { x: v.x, y: v.y, zoom: v.zoom });
    }
  }

  async getPresets(deviceId: string): Promise<PTZPreset[]> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) return [];

    try {
      const presets = await promisifyCam(onvif.cam, 'getPresets', {}) as Array<Record<string, string>>;
      return (presets ?? []).map((p, i) => ({
        id: i + 1,
        name: p.name ?? `Preset ${i + 1}`,
      }));
    } catch {
      return [];
    }
  }

  async setPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    const onvif = this.cams.get(deviceId);
    if (!onvif) throw new Error(`Device ${deviceId} not connected`);
    await promisifyCam(onvif.cam, 'setPreset', { presetName: preset.name });
  }

  async startPatrol(_deviceId: string, _patrolId: number): Promise<void> {
    this.logger.warn('PTZ patrol not implemented for generic ONVIF');
  }

  async stopPatrol(_deviceId: string): Promise<void> {
    this.logger.warn('PTZ patrol stop not implemented for generic ONVIF');
  }

  // ── IPlaybackAdapter ──────────────────────────────────────

  async search(_params: PlaybackSearchParams): Promise<PlaybackSegment[]> {
    this.logger.warn('Playback search not supported for generic ONVIF');
    return [];
  }

  async startPlayback(_params: PlaybackStartParams): Promise<PlaybackSession> {
    throw new Error('Playback not supported for generic ONVIF');
  }

  async stopPlayback(_sessionId: string): Promise<void> {}

  async exportClip(_params: ClipExportParams): Promise<ExportJob> {
    throw new Error('Export not supported for generic ONVIF');
  }

  async getSnapshot(_deviceId: string, _timestamp: Date, _channel?: number): Promise<Buffer> {
    throw new Error('Snapshot not supported for generic ONVIF');
  }

  // ── IEventAdapter ─────────────────────────────────────────

  async subscribe(deviceId: string, _callback: (event: DeviceEventPayload) => void): Promise<Unsubscribe> {
    this.logger.info({ deviceId }, 'ONVIF event subscription registered');
    return () => {};
  }

  async getEventTypes(_deviceId: string): Promise<string[]> {
    return ['motion_detected', 'tamper', 'video_loss'];
  }
}
