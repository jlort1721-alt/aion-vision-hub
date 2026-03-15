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

interface DahuaConnection {
  config: DeviceConnectionConfig;
  state: StreamState;
  identity: DeviceIdentity | null;
  capabilities: DeviceCapabilities | null;
  streamProfiles: StreamProfile[];
  eventAbortController?: AbortController;
}

/**
 * Dahua HTTP API adapter.
 *
 * Communicates with Dahua devices via their CGI/RPC HTTP API using Digest Auth.
 *
 * CGI reference endpoints:
 *   GET /cgi-bin/magicBox.cgi?action=getSystemInfo       → device identity
 *   GET /cgi-bin/magicBox.cgi?action=getProductDefinition → capabilities
 *   GET /cgi-bin/configManager.cgi?action=getConfig&name=Encode → stream profiles
 *   GET /cgi-bin/magicBox.cgi?action=getMemoryInfo        → health
 *   GET /cgi-bin/ptz.cgi?action=start&channel=1&code=...  → PTZ control
 *   GET /cgi-bin/mediaFileFind.cgi?action=...              → recording search
 *   GET /cgi-bin/eventManager.cgi?action=attach&codes=[All] → event stream
 */
export class DahuaAdapter
  implements IDeviceAdapter, IStreamAdapter, IDiscoveryAdapter, IHealthAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'dahua';
  readonly supportedProtocols = ['dahua-http', 'rtsp', 'onvif'];

  private connections = new Map<string, DahuaConnection>();

  // ── IDeviceAdapter ──

  async connect(cfg: DeviceConnectionConfig): Promise<ConnectionResult> {
    const deviceId = `dh-${cfg.ip}:${cfg.port}`;
    const timeoutMs = config.DEVICE_CONNECT_TIMEOUT_MS;

    try {
      const info = await this.cgiGet(cfg, '/cgi-bin/magicBox.cgi?action=getSystemInfo', timeoutMs);
      const identity = this.parseDeviceInfo(info);

      let capabilities: DeviceCapabilities | null = null;
      try {
        capabilities = await this.queryCapabilities(cfg, info, timeoutMs);
      } catch {
        capabilities = this.defaultCapabilities();
      }

      let streamProfiles: StreamProfile[] = [];
      try {
        streamProfiles = await this.queryStreamProfiles(cfg, timeoutMs);
      } catch {
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
        { deviceId, model: identity.model, serial: identity.serial },
        'Dahua device connected',
      );

      return {
        success: true,
        message: `Connected to ${identity.model} (${identity.serial})`,
        sessionId: deviceId,
        capabilities: capabilities ?? undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      logger.error({ deviceId, err: msg }, 'Dahua connection failed');
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
      logger.info({ deviceId }, 'Dahua device disconnected');
    }
  }

  async testConnection(cfg: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const info = await this.cgiGet(cfg, '/cgi-bin/magicBox.cgi?action=getSystemInfo', config.DEVICE_CONNECT_TIMEOUT_MS);
      const identity = this.parseDeviceInfo(info);

      let capabilities: DeviceCapabilities;
      try {
        capabilities = await this.queryCapabilities(cfg, info, config.DEVICE_CONNECT_TIMEOUT_MS);
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
    // Dahua RTSP: channel=N&subtype=0(main)|1(sub)
    const subtype = type === 'main' ? 0 : 1;
    return `rtsp://${username}:${password}@${ip}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
  }

  getStreamState(deviceId: string): StreamState {
    return this.connections.get(deviceId)?.state ?? 'idle';
  }

  // ── IDiscoveryAdapter ──

  async discover(_networkRange: string, _timeout = 5000): Promise<DiscoveredDevice[]> {
    /**
     * STUB: Dahua DHDiscover protocol (UDP port 37810)
     *
     * DHDiscover sends a proprietary UDP broadcast.
     * Devices respond with JSON containing model, serial, MAC, firmware, IP.
     *
     * NOT implemented because:
     *   - Proprietary undocumented protocol
     *   - Requires raw UDP socket + same-subnet access
     *   - ONVIF WS-Discovery covers most Dahua devices
     *
     * For field testing, use ONVIF discovery as primary.
     */
    logger.debug('DHDiscover not implemented — use ONVIF WS-Discovery');
    return [];
  }

  async identify(ip: string, port: number): Promise<DeviceIdentity | null> {
    try {
      const info = await this.cgiGet(
        { ip, port, username: 'admin', password: '', brand: 'dahua' },
        '/cgi-bin/magicBox.cgi?action=getSystemInfo',
        3000,
      );
      if (info) return this.parseDeviceInfo(info);
    } catch (err) {
      // 401 with Dahua-specific header indicates a Dahua device
      if (err instanceof Error && err.message.includes('401')) {
        return { brand: 'dahua', model: 'Unknown (auth required)', serial: '', firmware: '' };
      }
    }
    return null;
  }

  // ── IHealthAdapter ──

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const conn = this.connections.get(deviceId);
    if (!conn) return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date().toISOString() };

    const start = Date.now();
    try {
      // Basic health check — getSystemInfo always works if device is responsive
      await this.cgiGet(conn.config, '/cgi-bin/magicBox.cgi?action=getSystemInfo', config.DEVICE_REQUEST_TIMEOUT_MS);

      let cpuUsage: number | undefined;
      let memoryUsage: number | undefined;
      try {
        const memInfo = await this.cgiGet(conn.config, '/cgi-bin/magicBox.cgi?action=getMemoryInfo', config.DEVICE_REQUEST_TIMEOUT_MS);
        const total = Number(memInfo?.total) || 0;
        const free = Number(memInfo?.free) || 0;
        if (total > 0) memoryUsage = Math.round(((total - free) / total) * 100);
      } catch { /* not all devices support this */ }

      try {
        const cpuInfo = await this.cgiGet(conn.config, '/cgi-bin/magicBox.cgi?action=getCPUUsage', config.DEVICE_REQUEST_TIMEOUT_MS);
        cpuUsage = Number(cpuInfo?.usage) || undefined;
      } catch { /* not all devices support this */ }

      let storageUsage: number | undefined;
      try {
        const storageInfo = await this.cgiGet(conn.config, '/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo', config.DEVICE_REQUEST_TIMEOUT_MS);
        const totalBytes = Number(storageInfo?.['info[0].Detail[0].TotalBytes']) || 0;
        const usedBytes = Number(storageInfo?.['info[0].Detail[0].UsedBytes']) || 0;
        if (totalBytes > 0) storageUsage = Math.round((usedBytes / totalBytes) * 100);
      } catch { /* not all devices support this */ }

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
    const speed = command.speed ?? 5; // Dahua uses 1-8 speed range

    if (command.action === 'goto_preset' && command.presetId != null) {
      await this.cgiGet(
        conn.config,
        `/cgi-bin/ptz.cgi?action=start&channel=${ch}&code=GotoPreset&arg1=0&arg2=${command.presetId}&arg3=0`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );
      return;
    }

    if (command.action === 'set_preset' && command.presetId != null) {
      await this.cgiGet(
        conn.config,
        `/cgi-bin/ptz.cgi?action=start&channel=${ch}&code=SetPreset&arg1=0&arg2=${command.presetId}&arg3=0`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );
      return;
    }

    // Dahua PTZ codes
    const codeMap: Record<string, string> = {
      left: 'Left',
      right: 'Right',
      up: 'Up',
      down: 'Down',
      zoomin: 'ZoomTele',
      zoomout: 'ZoomWide',
      stop: 'Stop',
      iris_open: 'IrisLarge',
      iris_close: 'IrisSmall',
      focus_near: 'FocusNear',
      focus_far: 'FocusFar',
      auto_focus: 'AutoFocus',
    };

    const code = codeMap[command.action];
    if (!code) {
      logger.warn({ deviceId, action: command.action }, 'Unknown PTZ action for Dahua');
      return;
    }

    const action = command.action === 'stop' ? 'stop' : 'start';
    await this.cgiGet(
      conn.config,
      `/cgi-bin/ptz.cgi?action=${action}&channel=${ch}&code=${code}&arg1=${speed}&arg2=${speed}&arg3=0`,
      config.DEVICE_REQUEST_TIMEOUT_MS,
    );
  }

  async getPresets(deviceId: string): Promise<PTZPreset[]> {
    const conn = this.connections.get(deviceId);
    if (!conn) return [];

    try {
      const result = await this.cgiGet(
        conn.config,
        '/cgi-bin/ptz.cgi?action=getPresets&channel=1',
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );

      const presets: PTZPreset[] = [];
      // Dahua returns: presets[0].Index=1, presets[0].Name=Preset1, etc.
      for (let i = 0; i < 50; i++) {
        const index = result?.[`presets[${i}].Index`];
        const name = result?.[`presets[${i}].Name`];
        if (index != null) {
          presets.push({ id: Number(index), name: name || `Preset ${index}` });
        } else {
          break;
        }
      }
      return presets;
    } catch (err) {
      logger.warn({ deviceId, err }, 'Failed to get Dahua PTZ presets');
      return [];
    }
  }

  async setPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error(`Device ${deviceId} not connected`);
    await this.cgiGet(
      conn.config,
      `/cgi-bin/ptz.cgi?action=start&channel=1&code=SetPreset&arg1=0&arg2=${preset.id}&arg3=0`,
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

    try {
      // Dahua mediaFileFind — 3-step workflow: factory.create → findFile → findNextFile
      const factoryId = await this.mediaFileFindCreate(conn.config);
      if (!factoryId) throw new Error('Failed to create mediaFileFind session');

      const startDahua = this.toDahuaTime(start);
      const endDahua = this.toDahuaTime(end);

      await this.cgiGet(
        conn.config,
        `/cgi-bin/mediaFileFind.cgi?action=findFile&object=${factoryId}&condition.Channel=${channel}&condition.StartTime=${startDahua}&condition.EndTime=${endDahua}&condition.Types[0]=dav&condition.Types[1]=mp4`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      );

      const segments: RecordingSegment[] = [];
      let hasMore = true;

      while (hasMore) {
        const result = await this.cgiGet(
          conn.config,
          `/cgi-bin/mediaFileFind.cgi?action=findNextFile&object=${factoryId}&count=20`,
          config.DEVICE_REQUEST_TIMEOUT_MS,
        );

        const found = Number(result?.found) || 0;
        if (found === 0) {
          hasMore = false;
          break;
        }

        for (let i = 0; i < found; i++) {
          const segStart = result?.[`items[${i}].StartTime`];
          const segEnd = result?.[`items[${i}].EndTime`];
          const size = Number(result?.[`items[${i}].Length`]) || undefined;
          if (segStart && segEnd) {
            segments.push({
              startTime: this.fromDahuaTime(segStart),
              endTime: this.fromDahuaTime(segEnd),
              channel,
              type: 'continuous',
              sizeBytes: size,
            });
          }
        }

        if (found < 20) hasMore = false;
      }

      // Cleanup
      await this.cgiGet(
        conn.config,
        `/cgi-bin/mediaFileFind.cgi?action=close&object=${factoryId}`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      ).catch(() => { /* best effort */ });
      await this.cgiGet(
        conn.config,
        `/cgi-bin/mediaFileFind.cgi?action=destroy&object=${factoryId}`,
        config.DEVICE_REQUEST_TIMEOUT_MS,
      ).catch(() => { /* best effort */ });

      const totalDurationSeconds = segments.reduce((acc, s) => {
        const d = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000;
        return acc + Math.max(0, d);
      }, 0);

      return { segments, totalCount: segments.length, totalDurationSeconds };
    } catch (err) {
      logger.error({ deviceId, err }, 'Dahua recording search failed');
      return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
    }
  }

  getPlaybackUrl(deviceId: string, channel: number, start: string, end: string): string {
    const conn = this.connections.get(deviceId);
    if (!conn) return '';
    const { ip, username, password } = conn.config;
    const startDahua = this.toDahuaTime(start);
    const endDahua = this.toDahuaTime(end);
    return `rtsp://${username}:${password}@${ip}:554/cam/playback?channel=${channel}&starttime=${startDahua}&endtime=${endDahua}`;
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

    this.pollEventManager(deviceId, conn.config, callback, ac.signal).catch((err) => {
      if (!ac.signal.aborted) {
        logger.error({ deviceId, err }, 'Dahua eventManager error');
      }
    });

    logger.info({ deviceId }, 'Dahua event listener started');
  }

  stopEventListener(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.eventAbortController) {
      conn.eventAbortController.abort();
      conn.eventAbortController = undefined;
      logger.info({ deviceId }, 'Dahua event listener stopped');
    }
  }

  // ── Private: CGI HTTP helpers ──

  private async cgiGet(
    cfg: DeviceConnectionConfig,
    path: string,
    timeoutMs: number,
  ): Promise<Record<string, any>> {
    const res = await digestRequest({
      url: `http://${cfg.ip}:${cfg.port}${path}`,
      method: 'GET',
      username: cfg.username,
      password: cfg.password,
      timeoutMs,
    });
    if (res.statusCode !== 200) {
      throw new Error(`Dahua CGI ${path.split('?')[0]} → ${res.statusCode}`);
    }
    // Dahua CGI returns key=value lines
    return this.parseCgiResponse(res.body);
  }

  private parseCgiResponse(text: string): Record<string, any> {
    const result: Record<string, any> = {};
    for (const line of text.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim();
        result[key] = val;
      }
    }
    return result;
  }

  // ── Private: Device info parsing ──

  private parseDeviceInfo(info: Record<string, any>): DeviceIdentity {
    return {
      brand: 'dahua',
      model: info.deviceType || info.type || 'Unknown',
      serial: info.serialNumber || info.sn || '',
      firmware: info.softwareVersion || info.version || '',
      mac: info.macAddress,
      channels: Number(info.videoInputChannels) || undefined,
    };
  }

  // ── Private: Capability queries ──

  private async queryCapabilities(
    cfg: DeviceConnectionConfig,
    systemInfo: Record<string, any>,
    timeoutMs: number,
  ): Promise<DeviceCapabilities> {
    const caps = this.defaultCapabilities();

    // Channel count from system info
    const channels = Number(systemInfo.videoInputChannels) || 1;
    caps.channels = channels;

    // PTZ check
    try {
      await this.cgiGet(cfg, '/cgi-bin/ptz.cgi?action=getCurrentProtocol&channel=1', timeoutMs);
      caps.ptz = true;
    } catch {
      caps.ptz = false;
    }

    // Audio check
    try {
      const audioInfo = await this.cgiGet(cfg, '/cgi-bin/configManager.cgi?action=getConfig&name=AudioDetect', timeoutMs);
      caps.audio = audioInfo?.['table.AudioDetect[0].MutationDetect'] !== undefined;
    } catch {
      caps.audio = false;
    }

    // Smart events check
    try {
      const ivs = await this.cgiGet(cfg, '/cgi-bin/configManager.cgi?action=getConfig&name=VideoAnalyseRule', timeoutMs);
      caps.smartEvents = Object.keys(ivs).some((k) => k.includes('VideoAnalyseRule'));
    } catch {
      caps.smartEvents = false;
    }

    // Storage check
    try {
      await this.cgiGet(cfg, '/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo', timeoutMs);
      caps.localStorage = true;
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

    try {
      const encodeInfo = await this.cgiGet(
        cfg,
        '/cgi-bin/configManager.cgi?action=getConfig&name=Encode',
        timeoutMs,
      );

      // Parse Dahua Encode config: table.Encode[ch].MainFormat[0].*
      for (let ch = 0; ch < 32; ch++) {
        const mainCodec = encodeInfo[`table.Encode[${ch}].MainFormat[0].Video.Compression`];
        if (!mainCodec) {
          if (ch === 0) continue; // Try ch=0 and ch=1
          break;
        }

        const mainW = Number(encodeInfo[`table.Encode[${ch}].MainFormat[0].Video.Width`]) || 1920;
        const mainH = Number(encodeInfo[`table.Encode[${ch}].MainFormat[0].Video.Height`]) || 1080;
        const mainFps = Number(encodeInfo[`table.Encode[${ch}].MainFormat[0].Video.FPS`]) || 25;
        const mainBitrate = Number(encodeInfo[`table.Encode[${ch}].MainFormat[0].Video.BitRate`]) || undefined;

        profiles.push({
          type: 'main',
          url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/cam/realmonitor?channel=${ch + 1}&subtype=0`,
          codec: mainCodec.replace('H.', 'H.'),
          resolution: `${mainW}x${mainH}`,
          fps: mainFps,
          bitrate: mainBitrate,
          channel: ch + 1,
        });

        // Sub stream
        const subCodec = encodeInfo[`table.Encode[${ch}].ExtraFormat[0].Video.Compression`];
        if (subCodec) {
          const subW = Number(encodeInfo[`table.Encode[${ch}].ExtraFormat[0].Video.Width`]) || 640;
          const subH = Number(encodeInfo[`table.Encode[${ch}].ExtraFormat[0].Video.Height`]) || 480;
          const subFps = Number(encodeInfo[`table.Encode[${ch}].ExtraFormat[0].Video.FPS`]) || 15;

          profiles.push({
            type: 'sub',
            url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/cam/realmonitor?channel=${ch + 1}&subtype=1`,
            codec: subCodec.replace('H.', 'H.'),
            resolution: `${subW}x${subH}`,
            fps: subFps,
            channel: ch + 1,
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to query Dahua Encode config');
    }

    if (profiles.length === 0) return this.computeDefaultStreams(cfg);
    return profiles;
  }

  private computeDefaultStreams(cfg: DeviceConnectionConfig): StreamProfile[] {
    return [
      {
        type: 'main',
        url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/cam/realmonitor?channel=1&subtype=0`,
        codec: 'H.264',
        resolution: '1920x1080',
        fps: 25,
        channel: 1,
      },
      {
        type: 'sub',
        url: `rtsp://${cfg.username}:${cfg.password}@${cfg.ip}:554/cam/realmonitor?channel=1&subtype=1`,
        codec: 'H.264',
        resolution: '640x480',
        fps: 15,
        channel: 1,
      },
    ];
  }

  // ── Private: Recording search helpers ──

  private async mediaFileFindCreate(cfg: DeviceConnectionConfig): Promise<string | null> {
    const result = await this.cgiGet(
      cfg,
      '/cgi-bin/mediaFileFind.cgi?action=factory.create',
      config.DEVICE_REQUEST_TIMEOUT_MS,
    );
    // Response: result=<objectId>
    return result?.result || null;
  }

  private toDahuaTime(iso: string): string {
    // Dahua format: 2024-01-15 14:30:00
    return iso.replace('T', ' ').replace('Z', '').substring(0, 19);
  }

  private fromDahuaTime(dahua: string): string {
    // Dahua: "2024-01-15 14:30:00" → ISO
    return dahua.replace(' ', 'T') + 'Z';
  }

  // ── Private: Event polling ──

  /**
   * Long-poll /cgi-bin/eventManager.cgi?action=attach&codes=[All].
   *
   * Dahua event stream returns multipart content with boundaries like:
   *   --myboundary
   *   Content-Type: text/plain
   *   Content-Length: ...
   *
   *   Code=VideoMotion;action=Start;index=0
   *
   * KNOWN LIMITATION: Same as Hikvision — digestRequest buffers the full response.
   * We poll every 2 seconds as a fallback until we implement raw streaming.
   *
   * PRODUCTION TODO: Use raw undici stream with pre-computed digest headers.
   */
  private async pollEventManager(
    deviceId: string,
    cfg: DeviceConnectionConfig,
    callback: EventCallback,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      try {
        const res = await digestRequest({
          url: `http://${cfg.ip}:${cfg.port}/cgi-bin/eventManager.cgi?action=attach&codes=[All]`,
          method: 'GET',
          username: cfg.username,
          password: cfg.password,
          timeoutMs: 10000,
        });

        if (res.statusCode === 200 && res.body) {
          const events = this.parseEventManagerResponse(res.body);
          for (const event of events) {
            callback(event, deviceId);
          }
        }

        if (!signal.aborted) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        if (signal.aborted) return;
        logger.warn({ deviceId, err }, 'eventManager poll error, retrying in 5s');
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private parseEventManagerResponse(body: string): DeviceEvent[] {
    const events: DeviceEvent[] = [];
    // Parse Dahua event lines: Code=VideoMotion;action=Start;index=0
    const lines = body.split('\n').filter((l) => l.startsWith('Code='));
    for (const line of lines) {
      const params: Record<string, string> = {};
      for (const pair of line.split(';')) {
        const [key, ...val] = pair.split('=');
        if (key?.trim()) params[key.trim()] = val.join('=').trim();
      }

      if (params.Code) {
        events.push({
          eventType: params.Code,
          channel: Number(params.index) + 1 || 1,
          timestamp: new Date().toISOString(),
          data: {
            action: params.action,
            ...params,
          },
        });
      }
    }
    return events;
  }
}
