import type pino from 'pino';
import type { StreamProfile, StreamState, StreamType } from '@aion/shared-contracts';
import { DEFAULT_STREAM_POLICY, VALID_STREAM_TRANSITIONS, type StreamContext, type StreamPolicyConfig, type StreamRegistration } from '@aion/shared-contracts';
import { generateToken, secondsFromNow } from '@aion/common-utils';
import { config } from '../config/env.js';
import type { DeviceManager } from './device-manager.js';

/**
 * Manages stream lifecycle, policy enforcement, and URL generation.
 * Integrates with MediaMTX for RTSP→WebRTC bridging.
 */
export class StreamManager {
  private registrations = new Map<string, StreamRegistration>();
  private logger: pino.Logger;
  private deviceManager: DeviceManager;
  private policy: StreamPolicyConfig;

  constructor(deviceManager: DeviceManager, logger: pino.Logger) {
    this.deviceManager = deviceManager;
    this.logger = logger.child({ service: 'stream-manager' });
    this.policy = { ...DEFAULT_STREAM_POLICY };
  }

  async registerStreams(deviceId: string, profiles: StreamProfile[]): Promise<StreamRegistration> {
    this.deviceManager.getDevice(deviceId);
    const registration: StreamRegistration = {
      deviceId,
      gatewayId: config.GATEWAY_ID,
      siteId: config.SITE_ID ?? '',
      profiles,
      activeProfile: 'sub',
      state: 'idle',
      registeredAt: new Date(),
      lastStateChange: new Date(),
    };

    this.registrations.set(deviceId, registration);
    this.logger.info({ deviceId, profileCount: profiles.length }, 'Streams registered');

    // Register with MediaMTX
    for (const profile of profiles) {
      await this.registerWithMediaMTX(deviceId, profile).catch((err) => {
        this.logger.warn({ deviceId, type: profile.type, err }, 'MediaMTX registration failed');
      });
    }

    return registration;
  }

  getRegistration(deviceId: string): StreamRegistration | undefined {
    return this.registrations.get(deviceId);
  }

  listRegistrations(): StreamRegistration[] {
    return Array.from(this.registrations.values());
  }

  selectStream(deviceId: string, context: StreamContext): StreamProfile | undefined {
    const reg = this.registrations.get(deviceId);
    if (!reg) return undefined;

    const preferredType = this.policy[context];
    let profile = reg.profiles.find((p) => p.type === preferredType);

    // Fallback logic
    if (!profile) {
      for (const fallbackType of this.policy.fallbackOrder) {
        profile = reg.profiles.find((p) => p.type === fallbackType);
        if (profile) break;
      }
    }

    return profile;
  }

  getStreamUrl(deviceId: string, type: StreamType): string | undefined {
    const reg = this.registrations.get(deviceId);
    if (!reg) return undefined;

    const profile = reg.profiles.find((p) => p.type === type);
    return profile?.url;
  }

  generateSignedUrl(deviceId: string, type: StreamType, protocol: 'rtsp' | 'webrtc' | 'hls' = 'webrtc') {
    const reg = this.registrations.get(deviceId);
    if (!reg) return null;

    const profile = reg.profiles.find((p) => p.type === type);
    if (!profile) return null;

    const token = generateToken(24);
    const expiresAt = secondsFromNow(3600);

    let url: string;
    if (protocol === 'webrtc') {
      const path = `${deviceId}-${type}`;
      url = `${config.MEDIAMTX_API_URL.replace('9997', '8889')}/${path}/`;
    } else if (protocol === 'hls') {
      const path = `${deviceId}-${type}`;
      url = `${config.MEDIAMTX_API_URL.replace('9997', '8888')}/${path}/`;
    } else {
      url = profile.url;
    }

    return { url, token, expiresAt, protocol, deviceId, streamType: type };
  }

  transitionState(deviceId: string, newState: StreamState, reason: string): boolean {
    const reg = this.registrations.get(deviceId);
    if (!reg) return false;

    const validTransitions = VALID_STREAM_TRANSITIONS[reg.state];
    if (!validTransitions?.includes(newState)) {
      this.logger.warn({ deviceId, from: reg.state, to: newState }, 'Invalid stream state transition');
      return false;
    }

    this.logger.info({ deviceId, from: reg.state, to: newState, reason }, 'Stream state transition');
    reg.state = newState;
    reg.lastStateChange = new Date();
    return true;
  }

  unregister(deviceId: string): void {
    this.registrations.delete(deviceId);
    this.logger.info({ deviceId }, 'Streams unregistered');
  }

  updatePolicy(updates: Partial<StreamPolicyConfig>): void {
    this.policy = { ...this.policy, ...updates };
    this.logger.info({ policy: this.policy }, 'Stream policy updated');
  }

  private async registerWithMediaMTX(deviceId: string, profile: StreamProfile): Promise<void> {
    const path = `${deviceId}-${profile.type}`;
    const { request } = await import('undici');

    try {
      await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/add/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: profile.url,
          sourceProtocol: 'tcp',
          readTimeout: '10s',
          writeTimeout: '10s',
        }),
        headersTimeout: 5000,
      });
      this.logger.info({ path, source: '***' }, 'MediaMTX path registered');
    } catch (err) {
      this.logger.debug({ path, err }, 'MediaMTX registration skipped (may not be running)');
    }
  }
}
