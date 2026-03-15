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
import { DahuaRPCClient } from './rpc-client.js';
import { CGI, RTSP, DH_DISCOVERY_PORT } from './constants.js';

/**
 * Dahua HTTP CGI/RPC adapter.
 *
 * Communicates with Dahua cameras, NVRs, and XVRs via the CGI/RPC API
 * over HTTP/HTTPS. Uses key=value response parsing.
 */
export class DahuaAdapter
  extends BaseAdapter
  implements IDiscoveryAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'dahua';
  readonly supportedProtocols = ['dahua-http', 'rtsp', 'onvif'];

  private clients = new Map<string, DahuaRPCClient>();

  constructor(logger: pino.Logger) {
    super(logger);
  }

  // ── Template Method Implementations ───────────────────────

  protected async doConnect(config: DeviceConnectionConfig, deviceId: string): Promise<ConnectionResult> {
    const client = new DahuaRPCClient(config);
    const response = await client.get(CGI.SYSTEM_INFO);
    this.clients.set(deviceId, client);
    const model = response.data.deviceType ?? 'Dahua device';
    return { success: true, message: `Connected to ${model}` };
  }

  protected async doDisconnect(deviceId: string): Promise<void> {
    this.clients.delete(deviceId);
  }

  protected async doTestConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const client = new DahuaRPCClient(config);
    const response = await client.get(CGI.SYSTEM_INFO);
    const model = response.data.deviceType ?? 'Dahua device';
    const channels = parseInt(response.data.videoInputChannels ?? '1', 10) || 1;

    return {
      success: true,
      message: `Connected to ${model}`,
      latencyMs: 0,
      capabilities: {
        ptz: true,
        audio: true,
        smartEvents: true,
        anpr: false,
        faceDetection: false,
        channels,
        codecs: ['H.264', 'H.265'],
        maxResolution: '4K',
        playback: true,
        twoWayAudio: true,
      },
    };
  }

  // ── IStreamAdapter ────────────────────────────────────────

  async getStreams(deviceId: string): Promise<StreamProfile[]> {
    const conn = this.requireConnection(deviceId);
    const { ip, username, password } = conn.config;
    return [
      {
        type: 'main',
        url: RTSP.REALMONITOR(ip, username, password, 1, 0),
        codec: 'H.265',
        resolution: '2560x1440',
        fps: 25,
        channel: 1,
      },
      {
        type: 'sub',
        url: RTSP.REALMONITOR(ip, username, password, 1, 1),
        codec: 'H.264',
        resolution: '640x480',
        fps: 15,
        channel: 1,
      },
    ];
  }

  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel = 1): string {
    const conn = this.getConnection(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    const subtype = type === 'main' ? 0 : 1;
    return RTSP.REALMONITOR(ip, username, password, channel, subtype);
  }

  // ── IHealthAdapter ────────────────────────────────────────

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const conn = this.getConnection(deviceId);
    if (!conn) return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date() };

    const client = this.clients.get(deviceId);
    if (!client) return { online: false, latencyMs: -1, errors: ['No client'], lastChecked: new Date() };

    const start = Date.now();
    try {
      await client.get(CGI.SYSTEM_INFO);
      return { online: true, latencyMs: Date.now() - start, errors: [], lastChecked: new Date() };
    } catch (err) {
      return {
        online: false,
        latencyMs: Date.now() - start,
        errors: [err instanceof Error ? err.message : 'Health check failed'],
        lastChecked: new Date(),
      };
    }
  }

  // ── IConfigAdapter ────────────────────────────────────────

  async getCapabilities(deviceId: string): Promise<DeviceCapabilities> {
    const conn = this.requireConnection(deviceId);
    return {
      ptz: true,
      audio: true,
      smartEvents: true,
      anpr: false,
      faceDetection: false,
      channels: conn.config.channels ?? 1,
      codecs: ['H.264', 'H.265'],
      maxResolution: '4K',
      playback: true,
      twoWayAudio: true,
    };
  }

  async getSystemInfo(deviceId: string): Promise<DeviceSystemInfo> {
    const client = this.clients.get(deviceId);
    if (!client) throw new Error('Not connected');

    const response = await client.get(CGI.SYSTEM_INFO);
    return {
      firmware: response.data.softwareVersion ?? 'unknown',
      uptime: parseInt(response.data.upTime ?? '0', 10),
      model: response.data.deviceType,
      serial: response.data.serialNumber,
    };
  }

  // ── IDiscoveryAdapter ─────────────────────────────────────

  async discover(networkRange: string, timeout = 5000): Promise<DiscoveredDevice[]> {
    this.logger.info({ networkRange, timeout, port: DH_DISCOVERY_PORT }, 'Starting Dahua DH-Discovery scan');
    return [];
  }

  async identify(ip: string, port: number): Promise<DeviceIdentity | null> {
    try {
      const client = new DahuaRPCClient({ ip, port, username: 'admin', password: '', brand: 'dahua' });
      const response = await client.get(CGI.SYSTEM_INFO);
      return {
        brand: 'dahua',
        model: response.data.deviceType ?? 'Unknown',
        serial: response.data.serialNumber ?? '',
        firmware: response.data.softwareVersion ?? '',
      };
    } catch {
      return null;
    }
  }

  // ── IPTZAdapter ───────────────────────────────────────────

  async sendCommand(deviceId: string, command: PTZCommand): Promise<void> {
    this.requireConnection(deviceId);
    const client = this.clients.get(deviceId);
    if (!client) throw new Error('No client');

    const speed = command.speed ?? 5;
    const actions: Record<string, string> = {
      left: 'Left', right: 'Right', up: 'Up', down: 'Down',
      zoomin: 'ZoomTele', zoomout: 'ZoomWide', stop: 'Stop',
      goto_preset: 'GotoPreset',
    };

    const action = actions[command.action];
    if (!action) throw new Error(`Unknown PTZ action: ${command.action}`);

    if (command.action === 'goto_preset' && command.presetId) {
      await client.get(CGI.PTZ_GOTO_PRESET(1, command.presetId));
      return;
    }

    if (command.action === 'stop') {
      await client.get(CGI.PTZ_STOP(1, 'Left'));
      return;
    }

    await client.get(CGI.PTZ_CONTROL(1, action, 0, speed, 0));
  }

  async getPresets(deviceId: string): Promise<PTZPreset[]> {
    this.requireConnection(deviceId);
    const client = this.clients.get(deviceId);
    if (!client) return [];

    try {
      const response = await client.get(CGI.PTZ_PRESETS(1));
      const presets: PTZPreset[] = [];
      for (const [key, value] of Object.entries(response.data)) {
        const match = key.match(/presets\[(\d+)\]\.Name/);
        if (match) {
          presets.push({ id: parseInt(match[1], 10), name: value });
        }
      }
      return presets;
    } catch {
      return [];
    }
  }

  async setPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    this.requireConnection(deviceId);
    const client = this.clients.get(deviceId);
    if (!client) throw new Error('No client');
    await client.get(
      `/cgi-bin/ptz.cgi?action=start&channel=1&code=SetPreset&arg1=0&arg2=${preset.id}&arg3=0`,
    );
  }

  async startPatrol(_deviceId: string, _patrolId: number): Promise<void> {
    this.logger.warn('PTZ patrol not yet implemented for Dahua');
  }

  async stopPatrol(_deviceId: string): Promise<void> {
    this.logger.warn('PTZ patrol stop not yet implemented for Dahua');
  }

  // ── IPlaybackAdapter ──────────────────────────────────────

  async search(params: PlaybackSearchParams): Promise<PlaybackSegment[]> {
    const client = this.clients.get(params.deviceId);
    if (!client) throw new Error('Not connected');

    this.logger.info({ deviceId: params.deviceId, channel: params.channel }, 'Playback search');
    // Dahua uses mediaFileFind.cgi with create/findFile/findNextFile pattern
    return [];
  }

  async startPlayback(params: PlaybackStartParams): Promise<PlaybackSession> {
    const conn = this.requireConnection(params.deviceId);
    const { ip, username, password } = conn.config;
    const start = params.startTime.toISOString().replace(/[-:T]/g, '').substring(0, 14);

    return {
      sessionId: `pb-${params.deviceId}-${Date.now()}`,
      streamUrl: `rtsp://${username}:${password}@${ip}:554/cam/playback?channel=${params.channel}&starttime=${start}`,
      deviceId: params.deviceId,
      channel: params.channel,
    };
  }

  async stopPlayback(_sessionId: string): Promise<void> {}

  async exportClip(params: ClipExportParams): Promise<ExportJob> {
    this.requireConnection(params.deviceId);
    return { jobId: `export-${params.deviceId}-${Date.now()}`, status: 'pending', progress: 0 };
  }

  async getSnapshot(deviceId: string, _timestamp: Date, channel = 1): Promise<Buffer> {
    const client = this.clients.get(deviceId);
    if (!client) throw new Error('Not connected');
    const response = await client.get(`/cgi-bin/snapshot.cgi?channel=${channel}`);
    return Buffer.from(response.raw, 'binary');
  }

  // ── IEventAdapter ─────────────────────────────────────────

  async subscribe(deviceId: string, _callback: (event: DeviceEventPayload) => void): Promise<Unsubscribe> {
    this.requireConnection(deviceId);
    this.logger.info({ deviceId }, 'Event subscription registered');

    let active = true;
    const poll = async () => {
      while (active) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    };
    poll().catch(() => {});

    return () => { active = false; };
  }

  async getEventTypes(_deviceId: string): Promise<string[]> {
    return [
      'motion_detected', 'line_crossing', 'intrusion',
      'tamper', 'video_loss', 'io_alarm',
    ];
  }
}
